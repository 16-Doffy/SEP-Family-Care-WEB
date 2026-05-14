/**
 * @file ai-chat.controller.ts
 * @module controllers/ai-chat
 *
 * Controller xử lý các HTTP request liên quan đến tính năng AI Chat.
 *
 * Các endpoint được expose:
 * - GET  /ai/history   → Lấy lịch sử hội thoại
 * - POST /ai/message   → Gửi tin nhắn và nhận phản hồi AI
 * - DELETE /ai/history → Xóa toàn bộ lịch sử hội thoại
 *
 * Tất cả route đều yêu cầu xác thực (authenticate middleware).
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import * as aiChatService from '../services/ai-chat.service'
import { isOpenAiEnabled } from '../services/ai.service'

/**
 * Lấy lịch sử hội thoại AI của người dùng hiện tại.
 *
 * Trả về thêm trường `provider` để client biết AI đang dùng
 * OpenAI thật hay mock — giúp hiển thị badge phù hợp trên UI.
 *
 * @param req - Express Request (cần `req.user.userId`)
 * @param res - Express Response trả về `{ conversation, messages, provider }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 */
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversation, messages } = await aiChatService.getMessages(req.user.userId)
    res.json({ conversation, messages, provider: isOpenAiEnabled() ? 'openai' : 'mock' })
  } catch (e) { next(e) }
}

/**
 * Schema validate cho body của request gửi tin nhắn.
 * Nội dung tối thiểu 1 ký tự, tối đa 2000 ký tự.
 */
const sendSchema = z.object({ content: z.string().min(1).max(2000) })

/**
 * Gửi tin nhắn tới AI và nhận phản hồi.
 *
 * Luồng xử lý:
 * 1. Validate body request bằng Zod.
 * 2. Lấy thông tin người dùng (displayName, role) từ database để xây dựng AiContext.
 * 3. Gọi service để lưu tin, gọi AI và lưu phản hồi.
 * 4. Trả về `201 Created` kèm tin nhắn phản hồi của AI.
 *
 * @param req - Express Request (body: `{ content: string }`, cần `req.user`)
 * @param res - Express Response trả về `{ reply, model, tokensUsed }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws ZodError nếu `content` không hợp lệ
 * @throws NotFoundError nếu người dùng không tồn tại trong database
 */
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content } = sendSchema.parse(req.body)

    // Lấy thêm displayName và role vì req.user chỉ chứa userId và familyId
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
      select: { displayName: true, role: true },
    })

    const result = await aiChatService.sendAndReply(
      {
        userId: req.user.userId,
        familyId: req.user.familyId,
        displayName: user.displayName,
        role: user.role,
      },
      content,
    )

    res.status(201).json(result)
  } catch (e) { next(e) }
}

/**
 * Xóa toàn bộ lịch sử hội thoại AI của người dùng hiện tại.
 *
 * @param req - Express Request (cần `req.user.userId`)
 * @param res - Express Response trả về `{ ok: true }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 */
export async function clearHistory(req: Request, res: Response, next: NextFunction) {
  try {
    await aiChatService.clearHistory(req.user.userId)
    res.json({ ok: true })
  } catch (e) { next(e) }
}
