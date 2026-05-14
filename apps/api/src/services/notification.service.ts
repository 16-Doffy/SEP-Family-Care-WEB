/**
 * @module notification.service
 * @description Dịch vụ quản lý thông báo trong hệ thống Family Care.
 * Hỗ trợ tạo thông báo mới và phát realtime qua Socket.IO tới người dùng,
 * lấy danh sách thông báo, đánh dấu đã đọc (một hoặc tất cả),
 * và đếm số thông báo chưa đọc.
 *
 * Socket.IO được inject thông qua hàm `setIOGetter` để tránh circular dependency
 * (notification service được import bởi nhiều service khác, nếu import trực tiếp
 * từ socket config có thể gây vòng lặp dependency lúc khởi động).
 */

import { prisma } from '../config/database'
import type { NotificationType } from '@family-care/shared'
import type { Prisma } from '@prisma/client'

/**
 * Dữ liệu đầu vào để tạo một thông báo mới.
 */
interface CreateNotificationInput {
  /** ID của người dùng sẽ nhận thông báo */
  userId: string
  /** Loại thông báo (ví dụ: MONEY_REQUEST, SOS, TASK_DONE, ...) */
  type: NotificationType
  /** Tiêu đề ngắn gọn hiển thị trên thông báo */
  title: string
  /** Nội dung chi tiết của thông báo */
  body: string
  /** Dữ liệu bổ sung tùy theo loại thông báo (ID liên quan, v.v.) */
  metadata?: Record<string, unknown>
}

/**
 * Hàm getter trỏ tới instance Socket.IO Server.
 * Được thiết lập qua `setIOGetter` sau khi Socket.IO khởi động xong.
 * `null` có nghĩa là Socket.IO chưa sẵn sàng.
 */
let ioGetter: (() => import('socket.io').Server) | null = null

/**
 * Thiết lập hàm getter để service này có thể truy cập instance Socket.IO.
 * Cần được gọi một lần trong quá trình khởi động server, sau khi Socket.IO đã init.
 *
 * Lý do dùng getter thay vì import trực tiếp: tránh circular dependency vì
 * notification service được nhiều service khác import, dẫn đến khả năng
 * module chưa được khởi tạo khi import theo vòng tròn.
 *
 * @param getter - Hàm trả về instance `socket.io.Server` đang chạy
 */
export function setIOGetter(getter: () => import('socket.io').Server) {
  ioGetter = getter
}

/**
 * Tạo một thông báo mới trong database và gửi realtime tới người dùng qua Socket.IO.
 *
 * Sau khi tạo thông báo, hàm sẽ:
 * 1. Đếm tổng số thông báo chưa đọc của người dùng.
 * 2. Phát sự kiện `notification:new` kèm số chưa đọc tới room `user:{userId}`.
 *
 * Lỗi Socket.IO được bỏ qua (silent fail) để không làm ảnh hưởng
 * tới luồng chính khi socket chưa kết nối hoặc room chưa tồn tại.
 *
 * @param input - Thông tin thông báo cần tạo
 * @returns Bản ghi `Notification` vừa được tạo trong database.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      // metadata có thể undefined; ép về {} để Prisma không lưu null
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
    },
  })

  // Đếm số thông báo chưa đọc để gửi kèm badge count lên client
  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, isRead: false },
  })

  // Phát realtime tới room cá nhân của người dùng; bỏ qua nếu socket chưa sẵn sàng
  if (ioGetter) {
    try {
      ioGetter().to(`user:${input.userId}`).emit('notification:new', {
        notification,
        unreadCount,
      })
    } catch {
      // Socket.IO chưa sẵn sàng (ví dụ: server vừa khởi động), bỏ qua
    }
  }

  return notification
}

/**
 * Lấy danh sách thông báo của người dùng.
 * Sắp xếp: thông báo chưa đọc lên đầu, trong mỗi nhóm sắp theo mới nhất.
 * Giới hạn 50 thông báo để tránh tải quá nhiều dữ liệu.
 *
 * @param userId - ID của người dùng cần lấy thông báo
 * @returns Mảng tối đa 50 `Notification`, chưa đọc lên trước.
 */
export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    // isRead: 'asc' → false (chưa đọc) lên trước true (đã đọc)
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })
}

/**
 * Đánh dấu một thông báo cụ thể là đã đọc.
 * Kết hợp `notificationId` và `userId` trong điều kiện `where` để đảm bảo
 * người dùng chỉ có thể đánh dấu thông báo của chính mình.
 *
 * @param notificationId - ID của thông báo cần đánh dấu đã đọc
 * @param userId - ID của người dùng sở hữu thông báo (kiểm tra quyền)
 * @returns Bản ghi `Notification` đã được cập nhật.
 * @throws {PrismaClientKnownRequestError} Nếu không tìm thấy thông báo khớp với điều kiện
 */
export async function markRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
}

/**
 * Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.
 * Dùng `updateMany` để cập nhật hàng loạt trong một truy vấn duy nhất.
 *
 * @param userId - ID của người dùng cần đánh dấu tất cả thông báo đã đọc
 * @returns Kết quả `updateMany` của Prisma gồm `{ count: number }` (số bản ghi đã cập nhật).
 */
export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

/**
 * Đếm số lượng thông báo chưa đọc của người dùng.
 * Thường được dùng để hiển thị badge số đỏ trên icon chuông thông báo.
 *
 * @param userId - ID của người dùng cần đếm
 * @returns Số lượng thông báo chưa đọc (kiểu `number`).
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } })
}
