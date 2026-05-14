/**
 * @module calendar-reminder.service
 * @description Dịch vụ tự động quét và gửi thông báo nhắc nhở cho các sự kiện lịch gia đình.
 *
 * Cơ chế hoạt động:
 *  - Scheduler chạy định kỳ mỗi SCAN_INTERVAL_MS (60 giây)
 *  - Mỗi lần quét, tìm tất cả sự kiện chưa được nhắc nhở và sắp diễn ra
 *    trong vòng REMINDER_WINDOW_MIN phút tới (30 phút)
 *  - Gửi thông báo đến tất cả thành viên của gia đình sở hữu sự kiện đó
 *  - Đánh dấu `reminderSent = true` để không gửi lại lần tiếp theo
 *
 * Vòng đời:
 *  - `startCalendarReminderScheduler()` được gọi khi server khởi động
 *  - `stopCalendarReminderScheduler()` được gọi khi server tắt để giải phóng timer
 */

import { prisma } from '../config/database'
import { createNotification } from './notification.service'

/** Số phút trước sự kiện để gửi thông báo nhắc nhở */
const REMINDER_WINDOW_MIN = 30

/** Khoảng thời gian giữa các lần quét (milliseconds) */
const SCAN_INTERVAL_MS = 60_000

/**
 * Định dạng Date thành chuỗi ngày giờ theo múi giờ Việt Nam (vi-VN).
 * Ví dụ kết quả: "14:30 15/05"
 *
 * @param d - Đối tượng Date cần định dạng
 * @returns Chuỗi ngày giờ theo định dạng HH:MM DD/MM
 */
function formatTime(d: Date) {
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

/**
 * Quét database và gửi thông báo nhắc nhở cho các sự kiện sắp diễn ra.
 *
 * Điều kiện để một sự kiện được nhắc nhở:
 *  1. `reminderSent` = false (chưa được nhắc nhở lần nào)
 *  2. `startDate` nằm trong khoảng [now, now + REMINDER_WINDOW_MIN phút]
 *
 * Sau khi gửi thông báo xong, cập nhật `reminderSent = true` để tránh gửi lại.
 * Sử dụng Promise.all để gửi thông báo song song cho tất cả thành viên,
 * tối ưu thời gian xử lý khi gia đình có nhiều thành viên.
 *
 * @returns Promise<void> - Không trả về giá trị; lỗi sẽ được log ở tầng scheduler
 */
export async function scanAndSendReminders() {
  const now = new Date()
  // Cửa sổ thời gian kết thúc: các sự kiện bắt đầu trước thời điểm này sẽ được nhắc nhở
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000)

  // Lấy tất cả sự kiện trong cửa sổ nhắc nhở, kèm thông tin thành viên gia đình
  const events = await prisma.familyEvent.findMany({
    where: {
      reminderSent: false,
      startDate: { gte: now, lte: windowEnd },
    },
    include: {
      // Lấy danh sách userId của tất cả thành viên gia đình để gửi thông báo
      family: { include: { members: { select: { userId: true } } } },
    },
  })

  for (const ev of events) {
    // Tính số phút còn lại; dùng Math.max(1, ...) để tránh hiển thị "0 phút"
    const minutesAway = Math.max(1, Math.round((ev.startDate.getTime() - now.getTime()) / 60_000))

    // Gửi thông báo song song đến tất cả thành viên gia đình để tiết kiệm thời gian
    await Promise.all(
      ev.family.members.map((m) =>
        createNotification({
          userId: m.userId,
          type: 'CALENDAR_REMINDER',
          title: `⏰ Sắp đến: ${ev.title}`,
          body: `Bắt đầu lúc ${formatTime(ev.startDate)} (còn ~${minutesAway} phút)`,
          metadata: { eventId: ev.id, startDate: ev.startDate.toISOString() },
        }),
      ),
    )

    // Đánh dấu đã gửi nhắc nhở để không gửi lại trong các lần quét tiếp theo
    await prisma.familyEvent.update({ where: { id: ev.id }, data: { reminderSent: true } })
  }
}

/**
 * Biến lưu tham chiếu đến timer setInterval để có thể dừng scheduler khi cần.
 * null nghĩa là scheduler chưa được khởi động.
 */
let timer: NodeJS.Timeout | null = null

/**
 * Khởi động scheduler nhắc nhở lịch.
 * Idempotent: gọi nhiều lần chỉ tạo một timer duy nhất.
 * Thực hiện quét ngay lập tức khi khởi động, sau đó định kỳ theo SCAN_INTERVAL_MS.
 *
 * Nên gọi hàm này một lần duy nhất khi server khởi động.
 */
export function startCalendarReminderScheduler() {
  // Guard: không tạo nhiều timer nếu scheduler đã chạy
  if (timer) return

  const tick = () => {
    // Bắt lỗi riêng để một lần quét thất bại không làm dừng scheduler
    scanAndSendReminders().catch((err) => console.error('[calendar-reminder] scan failed:', err))
  }

  // Quét ngay khi khởi động để không phải chờ đến chu kỳ đầu tiên
  tick()
  timer = setInterval(tick, SCAN_INTERVAL_MS)
  console.log(`⏰ Calendar reminder scheduler started (every ${SCAN_INTERVAL_MS / 1000}s, window ${REMINDER_WINDOW_MIN}m)`)
}

/**
 * Dừng scheduler nhắc nhở lịch và giải phóng timer.
 * Nên gọi khi server tắt (process.on('SIGTERM'/'SIGINT')) để tránh memory leak
 * và tránh quét DB khi server đang trong quá trình shutdown.
 */
export function stopCalendarReminderScheduler() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
