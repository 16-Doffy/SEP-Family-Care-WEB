/**
 * @module family.routes
 * @description Định nghĩa các route quản lý gia đình.
 *
 * Tất cả route trong module này đều yêu cầu xác thực JWT thông qua middleware
 * `authenticate` áp dụng ở cấp router (router.use).
 *
 * Middleware:
 *   - `authenticate`   : Xác minh JWT access token, gắn req.user
 *   - `requireFamily`  : Đảm bảo người dùng đã thuộc một gia đình (req.user.familyId != null)
 *   - `requireRole`    : Giới hạn truy cập theo vai trò (PARENT, SUPER_ADMIN, v.v.)
 *
 * Danh sách endpoint:
 *   GET    /families/                 — Lấy thông tin gia đình (yêu cầu có familyId)
 *   PUT    /families/                 — Cập nhật tên gia đình (PARENT / SUPER_ADMIN)
 *   POST   /families/invite           — Sinh mã mời thành viên (PARENT / SUPER_ADMIN)
 *   POST   /families/join             — Tham gia gia đình bằng mã mời (không cần familyId)
 *   DELETE /families/members/:userId  — Xóa thành viên (PARENT / SUPER_ADMIN)
 */

import { Router } from 'express'
import * as ctrl from '../controllers/family.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

// Áp dụng authenticate cho toàn bộ route trong module này
router.use(authenticate)

/** Lấy thông tin chi tiết gia đình — người dùng phải thuộc một gia đình */
router.get('/', requireFamily, ctrl.getFamily)

/** Cập nhật tên gia đình — chỉ PARENT hoặc SUPER_ADMIN */
router.put('/', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateFamily)

/** Sinh mã mời thành viên mới — chỉ PARENT hoặc SUPER_ADMIN */
router.post('/invite', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.generateInvite)

/**
 * Tham gia gia đình bằng mã mời.
 * Không yêu cầu requireFamily vì người dùng chưa có gia đình khi gọi endpoint này.
 */
router.post('/join', ctrl.joinFamily)

/** Xóa (vô hiệu hóa) thành viên khỏi gia đình — chỉ PARENT hoặc SUPER_ADMIN */
router.delete('/members/:userId', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.removeMember)

export default router
