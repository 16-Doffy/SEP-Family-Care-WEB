/**
 * @file subscription-plan.routes.ts
 * @module routes/subscription-plan
 *
 * Định nghĩa các route công khai (có auth) cho tính năng gói đăng ký.
 *
 * Base path: /subscription-plans  (được mount trong routes/index.ts)
 *
 * Lưu ý về phân quyền:
 * - Route `GET /` là route duy nhất được expose tại đây, dành cho
 *   người dùng đã đăng nhập xem danh sách gói để chọn nâng cấp.
 * - Các route admin (tạo, sửa, xóa gói, gán cho gia đình) được định nghĩa
 *   trong `admin.routes.ts` và bảo vệ bằng middleware `requireAdmin`.
 *
 * Danh sách endpoint (public):
 * - GET /subscription-plans/   → Xem danh sách gói đang active
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as planCtrl from '../controllers/subscription-plan.controller'
import { authenticate } from '../middleware/auth'

const router: ExpressRouter = Router()

// Yêu cầu đăng nhập để xem danh sách gói
router.use(authenticate)

router.get('/', planCtrl.listPlans)

export default router
