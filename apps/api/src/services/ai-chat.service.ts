/**
 * @file ai-chat.service.ts
 * @module services/ai-chat
 *
 * Dịch vụ quản lý cuộc hội thoại AI cho từng người dùng.
 *
 * Mỗi người dùng chỉ có **một** `AiConversation` (quan hệ 1-1 với User).
 * Các tin nhắn (`AiMessage`) được lưu dưới conversation đó và được
 * truyền lại cho AI như lịch sử khi người dùng gửi tin mới.
 *
 * Quan hệ dữ liệu:
 *   User (1) ──── (1) AiConversation (1) ──── (N) AiMessage
 */

import { prisma } from '../config/database'
import { generateReply, type AiContext } from './ai.service'

/**
 * Lấy conversation hiện tại của người dùng, hoặc tạo mới nếu chưa có.
 *
 * Dùng pattern "get-or-create" thay vì upsert để tránh race condition
 * trong lần đầu người dùng sử dụng AI chat.
 *
 * @param userId - ID của người dùng
 * @returns Bản ghi `AiConversation` (mới hoặc đã tồn tại)
 */
export async function getOrCreateConversation(userId: string) {
  let convo = await prisma.aiConversation.findUnique({ where: { userId } })
  if (!convo) {
    convo = await prisma.aiConversation.create({ data: { userId } })
  }
  return convo
}

/**
 * Lấy danh sách tin nhắn trong cuộc hội thoại của người dùng.
 *
 * Tin nhắn được truy vấn theo thứ tự giảm dần (`desc`) để lấy `limit` tin
 * gần nhất, sau đó đảo ngược (`reverse`) để trả về theo thứ tự thời gian tăng dần.
 *
 * @param userId - ID của người dùng
 * @param limit - Số tin nhắn tối đa cần lấy (mặc định 50)
 * @returns Đối tượng chứa thông tin conversation và mảng tin nhắn đã sắp xếp
 */
export async function getMessages(userId: string, limit = 50) {
  const convo = await getOrCreateConversation(userId)
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  // Đảo ngược để tin nhắn cũ nhất ở đầu mảng (chuẩn chat UI)
  return { conversation: convo, messages: rows.reverse() }
}

/**
 * Lưu tin nhắn người dùng, gọi AI tạo phản hồi, rồi lưu phản hồi vào database.
 *
 * Quy trình:
 * 1. Lưu tin nhắn của user vào `AiMessage`.
 * 2. Lấy 20 tin nhắn gần nhất làm lịch sử (loại trừ tin vừa tạo).
 * 3. Gọi `generateReply` để lấy câu trả lời từ AI (OpenAI hoặc mock).
 * 4. Lưu câu trả lời của assistant vào `AiMessage`.
 * 5. Cập nhật `updatedAt` của conversation.
 *
 * @param ctx - Ngữ cảnh người dùng (userId, familyId, displayName, role)
 * @param userMessage - Nội dung tin nhắn người dùng gửi
 * @returns Đối tượng chứa tin nhắn phản hồi của assistant, tên model và số token đã dùng
 */
export async function sendAndReply(ctx: AiContext, userMessage: string) {
  const convo = await getOrCreateConversation(ctx.userId)

  // Bước 1: Lưu tin nhắn người dùng trước để có trong DB
  await prisma.aiMessage.create({
    data: { conversationId: convo.id, role: 'user', content: userMessage },
  })

  // Bước 2: Lấy lịch sử 20 tin gần nhất (desc) rồi đảo ngược thành thứ tự cũ→mới
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { role: true, content: true },
  })
  // Bỏ tin nhắn cuối cùng (chính là userMessage vừa lưu) để tránh gửi trùng
  const orderedHistory = history.reverse().slice(0, -1) // exclude the message we just inserted

  // Bước 3: Gọi AI (OpenAI hoặc fallback mock)
  const reply = await generateReply(userMessage, ctx, orderedHistory)

  // Bước 4: Lưu phản hồi của AI kèm metadata model và token
  const assistantMsg = await prisma.aiMessage.create({
    data: {
      conversationId: convo.id,
      role: 'assistant',
      content: reply.content,
      model: reply.model,
      tokensUsed: reply.tokensUsed,
    },
  })

  // Bước 5: Cập nhật timestamp conversation để sắp xếp đúng ở danh sách
  await prisma.aiConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } })

  return { reply: assistantMsg, model: reply.model, tokensUsed: reply.tokensUsed }
}

/**
 * Xóa toàn bộ lịch sử tin nhắn trong cuộc hội thoại của người dùng.
 *
 * Không xóa bản ghi `AiConversation` — chỉ xóa các `AiMessage` bên trong.
 * Nếu người dùng chưa có conversation thì bỏ qua (không tạo mới).
 *
 * @param userId - ID của người dùng cần xóa lịch sử
 * @returns void
 */
export async function clearHistory(userId: string) {
  const convo = await prisma.aiConversation.findUnique({ where: { userId } })
  // Nếu chưa có conversation thì không cần làm gì
  if (!convo) return
  await prisma.aiMessage.deleteMany({ where: { conversationId: convo.id } })
}
