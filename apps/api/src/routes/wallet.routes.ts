/**
 * @module wallet.routes
 * @description Định nghĩa các route HTTP cho chức năng quản lý ví tiền.
 *
 * Tất cả các route đều yêu cầu:
 *  - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ).
 *  - `requireFamily`: người dùng phải thuộc một gia đình.
 *
 * Một số route chỉ dành cho vai trò PARENT hoặc SUPER_ADMIN (thao tác tài chính).
 *
 * Prefix được mount bởi app chính (thường là `/api/wallets`).
 */

import { Router } from 'express'
import * as ctrl from '../controllers/wallet.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

// Áp dụng xác thực và kiểm tra gia đình cho toàn bộ router này
router.use(authenticate, requireFamily)

/** GET /wallets — Lấy danh sách tất cả ví của gia đình. Mọi thành viên đều xem được. */
router.get('/', ctrl.getWallets)

/** GET /wallets/:id — Xem chi tiết ví kèm 50 giao dịch gần nhất. Mọi thành viên đều xem được. */
router.get('/:id', ctrl.getWallet)

/**
 * POST /wallets/transfer — Chuyển tiền giữa hai ví.
 * Chỉ PARENT hoặc SUPER_ADMIN mới có quyền thực hiện để kiểm soát dòng tiền gia đình.
 */
router.post('/transfer', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.transfer)

/**
 * POST /wallets/deposit — Nạp tiền vào ví.
 * Chỉ PARENT hoặc SUPER_ADMIN mới có quyền nạp tiền để kiểm soát nguồn tiền vào gia đình.
 */
router.post('/deposit', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.deposit)

export default router
