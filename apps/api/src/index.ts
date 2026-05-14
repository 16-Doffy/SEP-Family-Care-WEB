/**
 * Điểm khởi động chính (entry point) của ứng dụng API.
 * Kết nối cơ sở dữ liệu, seed dữ liệu mặc định, khởi động HTTP server và các scheduler nền.
 */
import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './config/database'
import { startCalendarReminderScheduler } from './services/calendar-reminder.service'
import { ensureDefaultPlans } from './services/subscription-plan.service'
import { startSubscriptionExpiryScheduler } from './services/payment.service'

/**
 * Hàm khởi động bất đồng bộ — thực hiện theo thứ tự:
 * 1. Kiểm tra kết nối Prisma tới cơ sở dữ liệu.
 * 2. Đảm bảo các gói đăng ký (subscription plans) mặc định đã tồn tại trong DB.
 * 3. Tạo và khởi động HTTP server (Express + Socket.IO).
 * 4. Sau khi server sẵn sàng, kích hoạt các background scheduler:
 *    - `calendarReminderScheduler`: gửi nhắc nhở lịch theo định kỳ.
 *    - `subscriptionExpiryScheduler`: kiểm tra và xử lý đăng ký hết hạn.
 */
async function main() {
  // Xác minh kết nối database trước khi tiếp tục — ném lỗi ngay nếu không kết nối được
  await prisma.$connect()
  console.log('✅ Database connected')

  // Seed dữ liệu mặc định — không để lỗi này chặn server khởi động
  await ensureDefaultPlans().catch((err) => console.error('Plan seed failed:', err))

  const { httpServer } = createApp()

  httpServer.listen(env.API_PORT, () => {
    console.log(`🚀 API running on http://localhost:${env.API_PORT}`)
    console.log(`   Environment: ${env.NODE_ENV}`)

    // Khởi động các background job sau khi server đã lắng nghe thành công
    startCalendarReminderScheduler()
    startSubscriptionExpiryScheduler()
  })
}

// Bắt lỗi khởi động không mong đợi — thoát tiến trình với exit code 1 để process manager có thể restart
main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
