/**
 * @module album.routes
 * @description Định nghĩa các route API cho tính năng album ảnh gia đình.
 *
 * Tất cả các route đều yêu cầu:
 * - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ)
 * - `requireFamily`: người dùng phải thuộc ít nhất một gia đình
 *
 * Các endpoint:
 * - GET    /album            - Lấy danh sách ảnh (có phân trang qua query `cursor`)
 * - GET    /album/stats      - Lấy thống kê album (tổng ảnh, theo thành viên)
 * - GET    /album/:id        - Lấy chi tiết một ảnh
 * - POST   /album            - Tải lên ảnh mới (multipart/form-data, field `photos`, tối đa 10 file)
 * - DELETE /album/:id        - Xóa một ảnh (người tải lên hoặc phụ huynh/admin)
 *
 * Lưu ý: Route `/stats` phải được khai báo TRƯỚC `/:id` để Express không nhầm
 * "stats" là một `:id` và trả về 404.
 */

import { Router } from 'express'
import * as ctrl from '../controllers/album.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

// Áp dụng middleware xác thực cho toàn bộ router này
router.use(authenticate, requireFamily)

/** Lấy danh sách ảnh của gia đình; query: `cursor` (string, tùy chọn) để phân trang */
router.get('/', ctrl.getPhotos)

/**
 * Lấy thống kê album.
 * PHẢI đặt trước `/:id` để route này được khớp đúng thay vì bị coi là ID "stats".
 */
router.get('/stats', ctrl.getStats)

/** Lấy chi tiết một ảnh theo ID */
router.get('/:id', ctrl.getPhoto)

/**
 * Tải lên ảnh mới.
 * `albumUpload.array('photos', 10)` xử lý multipart/form-data:
 * field name là `photos`, tối đa 10 file mỗi lần tải.
 */
router.post('/', ctrl.albumUpload.array('photos', 10), ctrl.uploadPhotos)

/** Xóa ảnh theo ID; chỉ người tải lên hoặc phụ huynh/admin mới có quyền */
router.delete('/:id', ctrl.deletePhoto)

export default router
