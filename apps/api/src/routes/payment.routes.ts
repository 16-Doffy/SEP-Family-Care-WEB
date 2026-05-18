/**
 * @file payment.routes.ts
 * @module routes/payment
 *
 * Định nghĩa các route cho tính năng thanh toán.
 *
 * Base path: /payments  (được mount trong routes/index.ts)
 *
 * Tất cả route đều yêu cầu:
 * - `authenticate`: người dùng đã đăng nhập
 * - `requireFamily`: người dùng đã thuộc một gia đình
 *   (vì thanh toán luôn gắn với gia đình, không phải cá nhân)
 *
 * Danh sách endpoint:
 * - POST /payments/checkout          → Tạo phiên thanh toán mới
 * - POST /payments/:id/confirm-mock  → Xác nhận thanh toán mock (dev/staging)
 * - GET  /payments/history           → Xem lịch sử thanh toán của gia đình
 */

import { Router } from 'express'
import * as ctrl from '../controllers/payment.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

// Áp dụng xác thực và kiểm tra thành viên gia đình cho toàn bộ module
router.use(authenticate, requireFamily)

/** Tạo phiên thanh toán / nạp ví — chỉ PARENT / SUPER_ADMIN (FE-08) */
router.post('/checkout', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createCheckout)
router.post('/:id/confirm-mock', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.confirmMock)

/** Xem lịch sử thanh toán — mọi thành viên */
router.get('/history', ctrl.listMyPayments)

export default router
