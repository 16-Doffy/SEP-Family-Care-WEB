/**
 * @module chat.controller
 * @description Xử lý các HTTP request liên quan đến hệ thống nhắn tin.
 * Controller này đóng vai trò cầu nối giữa layer route và chat.service,
 * đồng thời phát sự kiện Socket.IO để cập nhật real-time cho các client.
 *
 * Luồng gửi tin nhắn real-time:
 *  1. Client gửi POST request đến API
 *  2. Controller lưu tin nhắn vào DB qua chat.service
 *  3. Controller emit sự kiện Socket.IO đến phòng `conversation:{id}`
 *  4. Tất cả client đang lắng nghe phòng đó nhận được tin nhắn ngay lập tức
 */

import type { Request, Response, NextFunction } from 'express'
import * as chatService from '../services/chat.service'
import { z } from 'zod'
import path from 'path'
import multer from 'multer'
import fs from 'fs'

/** Đường dẫn thư mục lưu trữ file ảnh được upload */
const uploadDir = path.join(process.cwd(), 'uploads')

// Tạo thư mục uploads nếu chưa tồn tại khi module được load
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

/**
 * Cấu hình Multer dùng cho upload ảnh trong chat.
 * - Lưu file lên disk thay vì memory để xử lý được file lớn
 * - Tên file được tạo ngẫu nhiên để tránh xung đột
 * - Giới hạn 10MB và chỉ cho phép định dạng ảnh phổ biến
 */
export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    // Ghép timestamp + số ngẫu nhiên để đảm bảo tên file là duy nhất
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => cb(null, /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())),
})

/**
 * Lấy danh sách tất cả cuộc trò chuyện của người dùng trong gia đình.
 * Mỗi cuộc trò chuyện được kèm theo thông tin thành viên và tin nhắn gần nhất.
 *
 * @route GET /chat/conversations
 * @param req - Request có chứa `req.user.userId` và `req.user.familyId`
 * @param res - JSON array các cuộc trò chuyện
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await chatService.getConversations(req.user.userId, req.user.familyId!)
    res.json(conversations)
  } catch (e) { next(e) }
}

/**
 * Lấy hoặc tạo nhóm chat chung của gia đình.
 * Idempotent: gọi nhiều lần vẫn trả về cùng một nhóm chat.
 *
 * @route GET /chat/conversations/group
 * @param req - Request có chứa `req.user.familyId`
 * @param res - JSON object của cuộc trò chuyện nhóm
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getOrCreateGroupChat(req: Request, res: Response, next: NextFunction) {
  try {
    const convo = await chatService.getOrCreateFamilyGroupChat(req.user.familyId!)
    res.json(convo)
  } catch (e) { next(e) }
}

/**
 * Lấy hoặc tạo cuộc trò chuyện riêng tư với một thành viên khác trong gia đình.
 * Idempotent: nếu đã tồn tại cuộc trò chuyện giữa hai người, sẽ trả về cuộc trò chuyện đó.
 *
 * @route POST /chat/conversations/private
 * @param req - Request body cần có `targetUserId`
 * @param res - JSON object của cuộc trò chuyện riêng tư
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getOrCreatePrivateChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string() }).parse(req.body)
    const convo = await chatService.getOrCreatePrivateChat(req.user.familyId!, req.user.userId, targetUserId)
    res.json(convo)
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách tin nhắn của một cuộc trò chuyện với phân trang cursor-based.
 * Client có thể truyền query param `cursor` để lấy các tin nhắn cũ hơn.
 *
 * @route GET /chat/conversations/:id/messages
 * @param req - Request có `params.id` là conversationId và query `cursor` (tùy chọn)
 * @param res - JSON gồm `messages`, `nextCursor`, `hasMore`
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { cursor } = req.query
    const result = await chatService.getMessages(req.params.id, req.user.userId, cursor as string | undefined)
    res.json(result)
  } catch (e) { next(e) }
}

/**
 * Gửi tin nhắn văn bản vào cuộc trò chuyện.
 * Sau khi lưu vào DB, sự kiện `chat:message` được emit qua Socket.IO
 * đến phòng `conversation:{id}` để cập nhật real-time cho các thành viên.
 *
 * Lý do dùng dynamic import cho socket: tránh circular dependency giữa
 * các module khi server khởi động.
 *
 * @route POST /chat/conversations/:id/messages
 * @param req - Request body cần có `content` (1–2000 ký tự)
 * @param res - HTTP 201 với JSON của tin nhắn vừa tạo
 * @param next - Middleware tiếp theo (error handler)
 */
export async function sendTextMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content } = z.object({ content: z.string().min(1).max(2000) }).parse(req.body)
    const message = await chatService.sendMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      type: 'TEXT',
      content,
    })

    // Phát sự kiện real-time đến tất cả client trong phòng conversation
    // Dùng try/catch riêng để lỗi socket không ảnh hưởng đến phản hồi HTTP
    try {
      const { getIO } = await import('../config/socket')
      getIO().to(`conversation:${req.params.id}`).emit('chat:message', message)
    } catch {}

    res.status(201).json(message)
  } catch (e) { next(e) }
}

/**
 * Gửi tin nhắn ảnh vào cuộc trò chuyện.
 * File ảnh được upload qua Multer middleware (`chatUpload.single('image')`),
 * sau đó URL của ảnh được lưu vào DB làm nội dung tin nhắn.
 * Sự kiện `chat:message` được emit qua Socket.IO để cập nhật real-time.
 *
 * @route POST /chat/conversations/:id/messages/image
 * @param req - Request phải có file ảnh trong trường `image` (multipart/form-data)
 * @param res - HTTP 201 với JSON của tin nhắn ảnh vừa tạo
 * @param next - Middleware tiếp theo (error handler)
 */
export async function sendImageMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new Error('No file uploaded')

    // URL công khai của ảnh được phục vụ qua static middleware
    const imageUrl = `/uploads/${req.file.filename}`
    const message = await chatService.sendMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      type: 'IMAGE',
      content: imageUrl,
      // Lưu imageUrl vào metadata để client dễ truy cập mà không cần parse content
      metadata: { imageUrl },
    })

    // Phát sự kiện real-time, tương tự sendTextMessage
    try {
      const { getIO } = await import('../config/socket')
      getIO().to(`conversation:${req.params.id}`).emit('chat:message', message)
    } catch {}

    res.status(201).json(message)
  } catch (e) { next(e) }
}

/**
 * Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc.
 * Thao tác này cập nhật `lastReadAt` của người dùng trong cuộc trò chuyện,
 * giúp tính số tin nhắn chưa đọc ở phía client.
 *
 * @route PATCH /chat/conversations/:id/read
 * @param req - Request có `params.id` là conversationId
 * @param res - JSON `{ ok: true }` xác nhận thành công
 * @param next - Middleware tiếp theo (error handler)
 */
export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await chatService.markRead(req.params.id, req.user.userId)
    res.json({ ok: true })
  } catch (e) { next(e) }
}
