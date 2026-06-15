/**
 * @module sos.routes
 * @description Định nghĩa các route HTTP cho hệ thống cảnh báo khẩn cấp SOS.
 *
 * Tất cả route yêu cầu `authenticate` (người dùng phải đăng nhập).
 * Không yêu cầu `requireFamily` ở tầng route vì controller tự kiểm tra
 * `req.user.familyId` và trả về lỗi rõ ràng nếu chưa có gia đình —
 * điều này giúp thông báo lỗi mô tả tốt hơn so với middleware chung.
 *
 * Cấu trúc route:
 *  POST   /sos       - Kích hoạt SOS alert khẩn cấp
 *  GET    /sos       - Lấy lịch sử tất cả SOS alert của gia đình
 *  GET    /sos/active - Lấy các SOS alert đang cần xử lý (ACTIVE/ACKNOWLEDGED)
 *  PATCH  /sos/:id   - Cập nhật trạng thái một SOS alert
 *
 * Lưu ý thứ tự route: `/active` phải đặt TRƯỚC `/:id` để tránh Express
 * hiểu nhầm "active" là một ID động.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/sos.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()

// Áp dụng middleware xác thực cho tất cả route trong module này
router.use(authenticate)

/** Kích hoạt SOS — mọi thành viên đã xác thực (FE-23) */
router.post('/', ctrl.createSOSAlert)
router.get('/', ctrl.getSOSAlerts)

// Route tĩnh /active phải đứng trước route động /:id để tránh xung đột
router.get('/active', ctrl.getActiveSOSAlerts)

/** Acknowledge / resolve SOS — chỉ PARENT / SUPER_ADMIN */
router.patch('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateSOSStatus)

export default router
