/**
 * @module notification.controller
 * @description Controller xử lý các yêu cầu HTTP liên quan đến thông báo của người dùng.
 * Cung cấp các endpoint để xem danh sách thông báo, đánh dấu một thông báo đã đọc,
 * và đánh dấu tất cả thông báo đã đọc.
 */

import type { Request, Response, NextFunction } from 'express'
import * as notificationService from '../services/notification.service'

/**
 * Lấy danh sách thông báo và số thông báo chưa đọc của người dùng hiện tại.
 * Trả về cả hai trong một lần gọi để client không phải gọi hai endpoint riêng lẻ.
 *
 * @route GET /notifications
 * @param req - Express Request; `req.user.userId` xác định người dùng đang đăng nhập
 * @param res - Express Response; trả về `{ notifications: Notification[], unreadCount: number }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationService.getNotifications(req.user.userId)
    const unreadCount = await notificationService.getUnreadCount(req.user.userId)
    res.json({ notifications, unreadCount })
  } catch (e) { next(e) }
}

/**
 * Đánh dấu một thông báo cụ thể là đã đọc.
 * Service sẽ kiểm tra rằng thông báo này thuộc về người dùng đang đăng nhập
 * trước khi cập nhật, ngăn người dùng đánh dấu thông báo của người khác.
 *
 * @route PATCH /notifications/:id/read
 * @param req - Express Request; `req.params.id` là ID của thông báo cần đánh dấu
 * @param res - Express Response; trả về `{ message: 'Marked as read' }` khi thành công
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {PrismaClientKnownRequestError} Nếu thông báo không tồn tại hoặc không thuộc người dùng này
 */
export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markRead(req.params.id, req.user.userId)
    res.json({ message: 'Marked as read' })
  } catch (e) { next(e) }
}

/**
 * Đánh dấu tất cả thông báo chưa đọc của người dùng hiện tại là đã đọc.
 * Thường được gọi khi người dùng mở trang thông báo hoặc nhấn "Đọc tất cả".
 *
 * @route PATCH /notifications/read-all
 * @param req - Express Request; `req.user.userId` xác định người dùng
 * @param res - Express Response; trả về `{ message: 'All marked as read' }` khi thành công
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllRead(req.user.userId)
    res.json({ message: 'All marked as read' })
  } catch (e) { next(e) }
}
