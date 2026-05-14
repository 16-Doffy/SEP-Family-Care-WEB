/**
 * @module location.routes
 * @description Định nghĩa các route API cho tính năng chia sẻ vị trí GPS trong gia đình.
 *
 * Tất cả các route đều yêu cầu:
 * - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ)
 * - `requireFamily`: người dùng phải thuộc ít nhất một gia đình
 *
 * Các endpoint:
 * - GET    /location/family   - Lấy vị trí của tất cả thành viên đang chia sẻ
 * - GET    /location/me       - Lấy trạng thái chia sẻ của bản thân
 * - PATCH  /location/toggle   - Bật/tắt chia sẻ vị trí
 * - POST   /location/update   - Cập nhật tọa độ GPS mới nhất
 */

import { Router } from 'express'
import * as ctrl from '../controllers/location.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

// Áp dụng middleware xác thực cho tất cả các route trong module này
router.use(authenticate, requireFamily)

/** Lấy vị trí của tất cả thành viên trong gia đình đang bật chia sẻ */
router.get('/family', ctrl.getFamilyLocations)

/** Lấy trạng thái chia sẻ vị trí của người dùng hiện tại */
router.get('/me', ctrl.getMyShare)

/** Bật hoặc tắt chia sẻ vị trí; body: `{ isSharing: boolean }` */
router.patch('/toggle', ctrl.toggleSharing)

/** Cập nhật tọa độ GPS; body: `{ latitude, longitude, accuracy? }` */
router.post('/update', ctrl.updateLocation)

export default router
