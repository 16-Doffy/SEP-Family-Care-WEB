/**
 * @module money-request.routes
 * @description Định nghĩa các route API cho tính năng yêu cầu xin tiền trong gia đình.
 *
 * Tất cả các route đều yêu cầu:
 * - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ)
 * - `requireFamily`: người dùng phải thuộc ít nhất một gia đình
 *
 * Phân quyền bổ sung:
 * - PATCH `/:id` chỉ dành cho `PARENT` hoặc `SUPER_ADMIN` (middleware `requireRole`)
 *
 * Các endpoint:
 * - POST  /money-requests          - Tạo yêu cầu xin tiền mới (mọi thành viên)
 * - GET   /money-requests          - Xem toàn bộ lịch sử yêu cầu trong gia đình
 * - GET   /money-requests/pending  - Xem danh sách yêu cầu đang chờ xử lý
 * - PATCH /money-requests/:id      - Duyệt hoặc từ chối yêu cầu (chỉ phụ huynh/admin)
 *
 * Lưu ý: Route `/pending` phải đặt TRƯỚC `/:id` để tránh bị nhầm là tham số ID.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/money-request.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()

// Áp dụng xác thực cơ bản cho toàn bộ module
router.use(authenticate, requireFamily)

/** Tạo yêu cầu xin tiền mới; body: `{ amount: number, reason?: string }` */
router.post('/', ctrl.createMoneyRequest)

/** Lấy toàn bộ lịch sử yêu cầu của gia đình (PENDING, APPROVED, REJECTED) */
router.get('/', ctrl.getMoneyRequests)

/**
 * Lấy danh sách yêu cầu đang chờ xử lý.
 * PHẢI đặt trước `/:id` để Express không nhầm "pending" là một ID.
 */
router.get('/pending', ctrl.getPendingRequests)

/**
 * Duyệt hoặc từ chối yêu cầu xin tiền theo ID.
 * Yêu cầu vai trò PARENT hoặc SUPER_ADMIN.
 * Body: `{ status: 'APPROVED' | 'REJECTED', note?: string }`
 */
router.patch('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.resolveMoneyRequest)

export default router
