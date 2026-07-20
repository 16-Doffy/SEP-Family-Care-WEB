/**
 * @module calendar.routes
 * @description Định nghĩa các route HTTP cho tính năng lịch sự kiện gia đình.
 *
 * Tất cả route đều yêu cầu:
 *  - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ)
 *  - `requireFamily`: người dùng phải thuộc về một gia đình
 *
 * Cấu trúc route:
 *  GET    /calendar       - Lấy sự kiện theo tháng (query: ?month=YYYY-MM-DD)
 *  POST   /calendar       - Tạo sự kiện mới
 *  PUT    /calendar/:id   - Cập nhật sự kiện (partial update)
 *  DELETE /calendar/:id   - Xóa sự kiện
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/calendar.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()

// Áp dụng middleware xác thực và kiểm tra gia đình cho tất cả route trong module này
router.use(authenticate, requireFamily)

/** Xem lịch — mọi thành viên đều được (FE-26) */
router.get('/', ctrl.getEvents)

/** Tạo / sửa sự kiện — mọi thành viên gia đình đều được phép */
router.post('/', ctrl.createEvent)
router.put('/:id', ctrl.updateEvent)
/** Bật/tắt reminder cá nhân cho event. */
router.patch('/:id/reminder', ctrl.setReminder)

/** Xóa sự kiện — chỉ PARENT / SUPER_ADMIN (hành động không thể hoàn tác) */
router.delete('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.deleteEvent)

export default router
