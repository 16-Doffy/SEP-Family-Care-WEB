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

import { Router } from 'express'
import * as ctrl from '../controllers/calendar.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

// Áp dụng middleware xác thực và kiểm tra gia đình cho tất cả route trong module này
router.use(authenticate, requireFamily)

router.get('/', ctrl.getEvents)
router.post('/', ctrl.createEvent)
router.put('/:id', ctrl.updateEvent)
router.delete('/:id', ctrl.deleteEvent)

export default router
