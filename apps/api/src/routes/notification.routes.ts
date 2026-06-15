/**
 * @module notification.routes
 * @description Định nghĩa các route API cho tính năng thông báo người dùng.
 *
 * Tất cả các route đều yêu cầu `authenticate` (JWT hợp lệ).
 * Không yêu cầu `requireFamily` vì thông báo là tính năng cá nhân,
 * không phụ thuộc vào việc người dùng có trong gia đình hay không.
 *
 * Các endpoint:
 * - GET   /notifications          - Lấy danh sách thông báo + số chưa đọc
 * - PATCH /notifications/read-all - Đánh dấu tất cả thông báo đã đọc
 * - PATCH /notifications/:id/read - Đánh dấu một thông báo đã đọc
 *
 * Lưu ý: Route `/read-all` phải đặt TRƯỚC `/:id/read` để Express khớp đúng
 * thay vì nhầm "read-all" là một `:id`.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/notification.controller'
import { authenticate } from '../middleware/auth'

const router: ExpressRouter = Router()

// Tất cả các route thông báo đều yêu cầu xác thực người dùng
router.use(authenticate)

/** Lấy danh sách thông báo và số chưa đọc của người dùng hiện tại */
router.get('/', ctrl.getNotifications)

/**
 * Đánh dấu tất cả thông báo chưa đọc là đã đọc.
 * PHẢI đặt trước `/:id/read` để tránh "read-all" bị hiểu là tham số `:id`.
 */
router.patch('/read-all', ctrl.markAllRead)

/** Đánh dấu một thông báo cụ thể là đã đọc theo ID */
router.patch('/:id/read', ctrl.markRead)

export default router
