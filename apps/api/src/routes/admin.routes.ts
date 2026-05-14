/**
 * @module admin.routes
 * @description Định nghĩa các route API dành riêng cho quản trị viên hệ thống.
 *
 * Tất cả các route đều yêu cầu:
 * - `authenticate`: người dùng phải đăng nhập (JWT hợp lệ)
 * - `requireRole('SUPER_ADMIN')`: chỉ tài khoản SUPER_ADMIN mới được truy cập
 *
 * Nhóm endpoint:
 *
 * Thống kê & Hệ thống:
 * - GET  /admin/stats          - Tổng số gia đình, người dùng, người dùng hoạt động
 * - GET  /admin/system/health  - Báo cáo sức khỏe hệ thống (DB, CPU, RAM, uploads)
 * - GET  /admin/backup/export  - Xuất toàn bộ dữ liệu dưới dạng file JSON backup
 *
 * Quản lý gia đình & người dùng:
 * - GET  /admin/families            - Danh sách tất cả gia đình
 * - GET  /admin/users               - Danh sách tất cả người dùng
 * - PUT  /admin/users/:id           - Cập nhật người dùng (bật/tắt tài khoản)
 *
 * Quản lý gói đăng ký (Subscription Plans):
 * - GET    /admin/plans             - Danh sách tất cả gói đăng ký
 * - POST   /admin/plans             - Tạo gói đăng ký mới
 * - GET    /admin/plans/:id         - Xem chi tiết một gói
 * - PUT    /admin/plans/:id         - Cập nhật gói đăng ký
 * - DELETE /admin/plans/:id         - Xóa gói đăng ký
 * - PUT    /admin/families/:familyId/plan - Gán gói đăng ký cho gia đình
 *
 * Thống kê doanh thu:
 * - GET  /admin/revenue            - Báo cáo doanh thu từ các payment
 */

import { Router } from 'express'
import * as ctrl from '../controllers/admin.controller'
import * as planCtrl from '../controllers/subscription-plan.controller'
import * as paymentCtrl from '../controllers/payment.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

// Áp dụng xác thực + kiểm tra quyền SUPER_ADMIN cho toàn bộ router admin
router.use(authenticate, requireRole('SUPER_ADMIN'))

/** Tổng quan hệ thống: số gia đình, người dùng, người dùng đang hoạt động */
router.get('/stats', ctrl.getStats)

/** Báo cáo sức khỏe hệ thống: trạng thái database, CPU, RAM, uptime, uploads */
router.get('/system/health', ctrl.getSystemHealth)

/** Xuất backup toàn bộ dữ liệu dưới dạng file JSON đính kèm */
router.get('/backup/export', ctrl.exportBackup)

/** Danh sách tất cả gia đình trong hệ thống kèm thành viên và gói đăng ký */
router.get('/families', ctrl.getFamilies)

/** Danh sách tất cả người dùng kèm vai trò và tên gia đình */
router.get('/users', ctrl.getUsers)

/** Cập nhật thông tin người dùng (hiện hỗ trợ: `isActive`) */
router.put('/users/:id', ctrl.updateUser)

// --- Quản lý gói đăng ký (Subscription Plans) ---

/** Lấy danh sách tất cả gói đăng ký */
router.get('/plans', planCtrl.listPlans)

/** Tạo gói đăng ký mới */
router.post('/plans', planCtrl.createPlan)

/** Xem chi tiết một gói đăng ký theo ID */
router.get('/plans/:id', planCtrl.getPlan)

/** Cập nhật thông tin gói đăng ký */
router.put('/plans/:id', planCtrl.updatePlan)

/** Xóa gói đăng ký theo ID */
router.delete('/plans/:id', planCtrl.deletePlan)

/** Gán gói đăng ký cho một gia đình cụ thể */
router.put('/families/:familyId/plan', planCtrl.assignToFamily)

// --- Thống kê doanh thu ---

/** Xem báo cáo doanh thu từ các giao dịch thanh toán */
router.get('/revenue', paymentCtrl.getRevenue)

export default router
