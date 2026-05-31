/**
 * @module chat.routes
 * @description Định nghĩa các route HTTP cho tính năng nhắn tin trong gia đình.
 *
 * Tất cả route đều yêu cầu:
 *  - `authenticate`: người dùng phải đăng nhập (có JWT hợp lệ)
 *  - `requireFamily`: người dùng phải thuộc về một gia đình
 *
 * Cấu trúc route:
 *  GET    /conversations                    - Danh sách cuộc trò chuyện của người dùng
 *  GET    /conversations/group              - Lấy hoặc tạo nhóm chat gia đình
 *  POST   /conversations/private            - Lấy hoặc tạo chat riêng tư với một thành viên
 *  GET    /conversations/:id/messages       - Lấy tin nhắn (hỗ trợ cursor pagination)
 *  POST   /conversations/:id/messages       - Gửi tin nhắn văn bản
 *  POST   /conversations/:id/messages/image - Upload và gửi tin nhắn ảnh
 *  PATCH  /conversations/:id/read           - Đánh dấu đã đọc
 */

import { Router } from 'express'
import * as ctrl from '../controllers/chat.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

// Áp dụng middleware xác thực và kiểm tra gia đình cho tất cả route trong module này
router.use(authenticate, requireFamily)

router.get('/conversations', ctrl.getConversations)
router.get('/conversations/group', ctrl.getOrCreateGroupChat)
router.post('/conversations/private', ctrl.getOrCreatePrivateChat)
router.get('/conversations/:id/messages', ctrl.getMessages)
router.post('/conversations/:id/messages', ctrl.sendTextMessage)

// Route upload ảnh: Multer middleware xử lý multipart/form-data trước khi vào controller
router.post('/conversations/:id/messages/image', ctrl.chatUpload.single('image'), ctrl.sendImageMessage)
router.post('/conversations/:id/messages/file', ctrl.chatFileUpload.single('file'), ctrl.sendFileMessage)
router.post('/conversations/:id/messages/location', ctrl.sendLocationMessage)

router.patch('/conversations/:id/read', ctrl.markRead)

export default router
