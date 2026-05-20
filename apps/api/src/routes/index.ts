/**
 * @file routes/index.ts
 * @module routes
 *
 * Điểm tập trung tất cả các router của API.
 *
 * File này mount toàn bộ sub-router vào router chính theo prefix tương ứng.
 * Router chính này được import vào `app.ts` và mount dưới prefix `/api`.
 *
 * Ví dụ URL đầy đủ: /api/auth/login, /api/family, /api/ai/message, v.v.
 *
 * Danh sách các nhóm route:
 * - /auth              → Đăng ký, đăng nhập, refresh token
 * - /family            → Quản lý gia đình và thành viên
 * - /wallets           → Quản lý ví tiền
 * - /tasks             → Quản lý nhiệm vụ
 * - /notifications     → Thông báo cho người dùng
 * - /admin             → Các chức năng quản trị (yêu cầu quyền ADMIN)
 * - /chat              → Chat nhóm gia đình (realtime qua Socket.IO)
 * - /calendar          → Lịch và sự kiện gia đình
 * - /sos               → Tính năng khẩn cấp SOS
 * - /money-requests    → Yêu cầu chuyển tiền giữa thành viên
 * - /album             → Album ảnh gia đình
 * - /location          → Chia sẻ vị trí realtime
 * - /ai                → AI Chat Assistant (Family Care Assistant)
 * - /payments          → Thanh toán subscription và nạp ví
 * - /subscription-plans → Danh sách gói đăng ký
 */

import { Router } from 'express'
import authRoutes from './auth.routes'
import familyRoutes from './family.routes'
import walletRoutes from './wallet.routes'
import taskRoutes from './task.routes'
import notificationRoutes from './notification.routes'
import adminRoutes from './admin.routes'
import chatRoutes from './chat.routes'
import calendarRoutes from './calendar.routes'
import sosRoutes from './sos.routes'
import moneyRequestRoutes from './money-request.routes'
import albumRoutes from './album.routes'
import locationRoutes from './location.routes'
import aiRoutes from './ai.routes'
import paymentRoutes from './payment.routes'
import subscriptionPlanRoutes from './subscription-plan.routes'
import announcementRoutes from './announcement.routes'
import financeRoutes from './finance.routes'
import recurringTaskRoutes from './recurring-task.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/family', familyRoutes)
router.use('/wallets', walletRoutes)
router.use('/tasks', taskRoutes)
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)
router.use('/chat', chatRoutes)
router.use('/calendar', calendarRoutes)
router.use('/sos', sosRoutes)
router.use('/money-requests', moneyRequestRoutes)
router.use('/album', albumRoutes)
router.use('/location', locationRoutes)
router.use('/ai', aiRoutes)
router.use('/payments', paymentRoutes)
router.use('/subscription-plans', subscriptionPlanRoutes)
router.use('/announcements', announcementRoutes)
router.use('/finance', financeRoutes)
router.use('/recurring-tasks', recurringTaskRoutes)

export { router as apiRouter }
