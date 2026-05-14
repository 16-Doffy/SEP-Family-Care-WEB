/**
 * @file ai.routes.ts
 * @module routes/ai
 *
 * Định nghĩa các route cho tính năng AI Chat.
 *
 * Base path: /ai  (được mount trong routes/index.ts)
 *
 * Tất cả route đều yêu cầu người dùng đã đăng nhập (authenticate).
 *
 * Danh sách endpoint:
 * - GET    /ai/history   → Lấy lịch sử hội thoại AI
 * - POST   /ai/message   → Gửi tin nhắn, nhận phản hồi AI
 * - DELETE /ai/history   → Xóa toàn bộ lịch sử hội thoại
 */

import { Router } from 'express'
import * as ctrl from '../controllers/ai-chat.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

// Áp dụng xác thực cho tất cả route trong module này
router.use(authenticate)

router.get('/history', ctrl.getHistory)
router.post('/message', ctrl.sendMessage)
router.delete('/history', ctrl.clearHistory)

export default router
