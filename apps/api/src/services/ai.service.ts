/**
 * @file ai.service.ts
 * @module services/ai
 *
 * Dịch vụ lõi cho tính năng AI Assistant ("Family Care Assistant").
 *
 * Luồng hoạt động:
 * 1. Thu thập dữ liệu ngữ cảnh của người dùng từ cơ sở dữ liệu (ví, nhiệm vụ, sự kiện).
 * 2. Gửi câu hỏi + ngữ cảnh tới OpenAI nếu API key được cấu hình.
 * 3. Nếu OpenAI không khả dụng hoặc gặp lỗi, tự động dùng phản hồi mock
 *    dựa trên từ khóa để đảm bảo hệ thống luôn trả lời được.
 */

import { prisma } from '../config/database'
import { env } from '../config/env'

/**
 * Thông tin ngữ cảnh của người dùng đang chat với AI.
 */
export interface AiContext {
  /** ID người dùng trong hệ thống */
  userId: string
  /** ID gia đình (nếu người dùng đã tham gia gia đình) */
  familyId?: string
  /** Tên hiển thị của người dùng */
  displayName: string
  /** Vai trò trong gia đình (e.g. ADMIN, MEMBER) */
  role: string
}

/**
 * Kết quả phản hồi từ AI (dù là OpenAI thật hay mock).
 */
export interface AiReply {
  /** Nội dung câu trả lời */
  content: string
  /** Tên model đã tạo ra phản hồi (e.g. 'gpt-4o', 'mock-v1') */
  model: string
  /** Tổng số token đã dùng (chỉ có khi gọi OpenAI thật) */
  tokensUsed?: number
}

/**
 * System prompt gốc định nghĩa danh tính và hành vi của AI.
 * Được ghép với dữ liệu ngữ cảnh người dùng trước khi gửi lên OpenAI.
 */
const SYSTEM_PROMPT = `Bạn là trợ lý AI tên "Family Care Assistant" giúp các thành viên gia đình quản lý tài chính, công việc, lịch và sự kiện.
Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Khi người dùng hỏi về số liệu (ví, task, lịch), hãy dùng dữ liệu được cung cấp trong context để trả lời chính xác.
Nếu không có dữ liệu liên quan, trả lời chung chung kèm gợi ý hữu ích.`

/**
 * Thu thập dữ liệu thực tế của người dùng từ database để đưa vào ngữ cảnh cho AI.
 *
 * Truy vấn song song: ví tiền (cá nhân + chung), số nhiệm vụ đang chờ,
 * số nhiệm vụ đã hoàn thành trong tháng, và 3 sự kiện sắp tới.
 *
 * @param ctx - Thông tin người dùng và gia đình
 * @returns Chuỗi văn bản tóm tắt ngữ cảnh để nhúng vào prompt
 */
async function gatherUserContext(ctx: AiContext): Promise<string> {
  // Nếu người dùng chưa vào gia đình nào, không có dữ liệu để truy vấn
  if (!ctx.familyId) return 'Người dùng chưa tham gia gia đình nào.'

  // Thực hiện tất cả truy vấn song song để giảm thời gian chờ
  const [wallets, pendingTasks, completedThisMonth, upcomingEvents] = await Promise.all([
    prisma.wallet.findMany({
      where: { familyId: ctx.familyId, OR: [{ type: 'JOINT' }, { owner: { userId: ctx.userId } }] },
      select: { name: true, type: true, balance: true, currency: true },
    }),
    // Đếm nhiệm vụ chưa hoàn thành được giao cho người dùng
    prisma.task.count({
      where: { familyId: ctx.familyId, status: { in: ['PENDING', 'IN_PROGRESS'] }, assignedTo: { userId: ctx.userId } },
    }),
    // Đếm nhiệm vụ đã được phê duyệt trong tháng hiện tại
    prisma.task.count({
      where: {
        familyId: ctx.familyId,
        status: 'APPROVED',
        assignedTo: { userId: ctx.userId },
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    // Lấy tối đa 3 sự kiện sắp diễn ra, sắp xếp theo thời gian gần nhất
    prisma.familyEvent.findMany({
      where: { familyId: ctx.familyId, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 3,
      select: { title: true, startDate: true },
    }),
  ])

  const walletStr = wallets
    .map((w) => `- ${w.name} (${w.type}): ${Number(w.balance).toLocaleString('vi-VN')} ${w.currency}`)
    .join('\n') || '(không có ví)'

  const eventsStr = upcomingEvents
    .map((e) => `- ${e.title} (${e.startDate.toLocaleDateString('vi-VN')} ${e.startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`)
    .join('\n') || '(không có sự kiện sắp tới)'

  // Ghép thành chuỗi có cấu trúc để AI dễ đọc và trích xuất số liệu
  return [
    `Người dùng: ${ctx.displayName} (${ctx.role})`,
    `Ví tiền:\n${walletStr}`,
    `Nhiệm vụ đang chờ: ${pendingTasks}`,
    `Nhiệm vụ đã hoàn thành tháng này: ${completedThisMonth}`,
    `Sự kiện sắp tới:\n${eventsStr}`,
  ].join('\n\n')
}

/**
 * Tạo phản hồi mock dựa trên từ khóa trong câu hỏi.
 *
 * Được dùng khi OpenAI API key chưa được cấu hình hoặc khi OpenAI gặp lỗi.
 * Phân tích từ khóa đơn giản để trả về câu trả lời có liên quan đến dữ liệu thực
 * đã được nhúng trong `contextSummary`.
 *
 * @param message - Câu hỏi của người dùng
 * @param contextSummary - Chuỗi tóm tắt dữ liệu gia đình
 * @param displayName - Tên hiển thị của người dùng (dùng trong lời chào)
 * @returns Chuỗi phản hồi phù hợp với ngữ cảnh
 */
function mockReply(message: string, contextSummary: string, displayName: string): string {
  const m = message.toLowerCase().trim()

  // Trích xuất dòng thông tin ví từ contextSummary để dùng trong câu trả lời
  const walletLine = contextSummary.split('\n').find((l) => l.startsWith('- ') && l.includes('JOINT'))
  const personalLine = contextSummary.split('\n').find((l) => l.startsWith('- ') && l.includes('PERSONAL'))

  // Dùng regex để đọc số lượng nhiệm vụ từ chuỗi ngữ cảnh
  const pendingMatch = contextSummary.match(/Nhiệm vụ đang chờ: (\d+)/)
  const completedMatch = contextSummary.match(/Nhiệm vụ đã hoàn thành tháng này: (\d+)/)

  if (/ví|tiền|số dư|balance|wallet/.test(m)) {
    const lines = [walletLine, personalLine].filter(Boolean)
    if (lines.length === 0) return 'Bạn chưa có ví nào trong gia đình. Hãy nhờ chủ hộ tạo cho bạn nhé!'
    return `Số dư ví hiện tại của bạn:\n${lines.join('\n')}\n\n💡 Mẹo: dành ít nhất 20% thu nhập để tiết kiệm cho mục tiêu dài hạn.`
  }

  if (/nhiệm vụ|task|việc|công việc/.test(m)) {
    const pending = pendingMatch?.[1] ?? '0'
    const done = completedMatch?.[1] ?? '0'
    return `Bạn đang có **${pending} nhiệm vụ chưa làm xong** và đã hoàn thành **${done} nhiệm vụ trong tháng này**.\n\n${Number(pending) > 0 ? 'Cố lên, hoàn thành sớm để nhận thưởng nhé! 💪' : 'Tuyệt vời, bạn đang rảnh tay 🎉'}`
  }

  if (/lịch|sự kiện|event|calendar|hẹn|sắp tới/.test(m)) {
    const eventsBlock = contextSummary.split('Sự kiện sắp tới:\n')[1] ?? ''
    return `Đây là các sự kiện sắp tới của gia đình:\n${eventsBlock}\n\nNhớ kiểm tra trước 30 phút nhé — hệ thống sẽ tự nhắc bạn!`
  }

  if (/tiết kiệm|saving|tiết|kiệm/.test(m)) {
    return `💰 Vài mẹo tiết kiệm dành cho gia đình:\n\n1. **Quy tắc 50/30/20**: 50% nhu cầu thiết yếu, 30% mong muốn, 20% tiết kiệm.\n2. **Lập ngân sách hàng tuần** trong ví chung — bám sát hơn ngân sách tháng.\n3. **Khen thưởng task** thay vì cho tiền tiêu vặt cố định để con học giá trị lao động.\n4. **Tự động chuyển vào ví tiết kiệm** mỗi đầu tháng trước khi tiêu.\n5. **So sánh giá** trước khi mua đồ giá trị > 500k.`
  }

  if (/chào|hello|hi|xin chào/.test(m)) {
    return `Chào ${displayName}! 👋 Tôi là Family Care Assistant. Tôi có thể giúp bạn:\n\n• Kiểm tra số dư ví\n• Tổng kết nhiệm vụ trong tháng\n• Nhắc sự kiện sắp tới\n• Gợi ý mẹo tiết kiệm cho gia đình\n\nBạn cần gì hôm nay?`
  }

  if (/cảm ơn|thanks|thank/.test(m)) {
    return `Không có gì! Có gì cần cứ hỏi tôi nhé 😊`
  }

  if (/sos|khẩn cấp|cấp cứu/.test(m)) {
    return `Khi cần khẩn cấp, hãy nhấn nút **SOS** màu đỏ trong app — vị trí của bạn sẽ được gửi ngay đến tất cả thành viên gia đình. Tôi không thể thay thế việc gọi 113/115 nếu có nguy hiểm thực sự nhé!`
  }

  // Câu trả lời mặc định khi không khớp từ khóa nào
  return `Mình đã ghi nhận câu hỏi: "${message}".\n\nHiện tại tôi có thể giúp bạn về: **ví/tài chính**, **nhiệm vụ**, **lịch gia đình**, **mẹo tiết kiệm**. Bạn thử hỏi cụ thể hơn xem nhé!`
}

/**
 * Gọi OpenAI Chat Completions API để lấy phản hồi AI thật.
 *
 * Ghép lịch sử hội thoại (tối đa 10 tin gần nhất) vào messages để AI
 * có ngữ cảnh cuộc trò chuyện. Giới hạn max_tokens=500 để kiểm soát chi phí.
 *
 * @param message - Câu hỏi hiện tại của người dùng
 * @param contextSummary - Chuỗi dữ liệu gia đình đã được thu thập
 * @param history - Lịch sử các tin nhắn trước đó (role + content)
 * @returns Phản hồi từ OpenAI bao gồm nội dung, tên model và số token đã dùng
 * @throws Error nếu OpenAI trả về HTTP error
 */
async function callOpenAI(message: string, contextSummary: string, history: { role: string; content: string }[]): Promise<AiReply> {
  const messages = [
    // System prompt + dữ liệu ngữ cảnh được ghép làm tin nhắn system đầu tiên
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- DỮ LIỆU NGƯỜI DÙNG ---\n${contextSummary}` },
    // Chỉ lấy 10 tin nhắn gần nhất để tránh vượt giới hạn context window
    ...history.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${errText}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    usage?: { total_tokens?: number }
    model: string
  }

  return {
    content: data.choices[0]?.message?.content?.trim() ?? '(no reply)',
    model: data.model,
    tokensUsed: data.usage?.total_tokens,
  }
}

/**
 * Tạo câu trả lời AI cho tin nhắn của người dùng.
 *
 * Chiến lược:
 * - Nếu `OPENAI_API_KEY` được cấu hình → gọi OpenAI thật.
 * - Nếu OpenAI lỗi hoặc không có API key → tự động fallback sang mock.
 *   Việc fallback giúp ứng dụng luôn hoạt động được ngay cả trong môi trường
 *   phát triển chưa có key hoặc khi OpenAI tạm thời không khả dụng.
 *
 * @param message - Tin nhắn của người dùng
 * @param ctx - Ngữ cảnh người dùng (userId, familyId, displayName, role)
 * @param history - Lịch sử hội thoại trước đó
 * @returns Phản hồi AI kèm tên model và số token (nếu có)
 */
export async function generateReply(
  message: string,
  ctx: AiContext,
  history: { role: string; content: string }[],
): Promise<AiReply> {
  // Thu thập dữ liệu thực tế từ database để AI trả lời có căn cứ
  const contextSummary = await gatherUserContext(ctx)

  if (env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(message, contextSummary, history)
    } catch (err) {
      // Ghi log lỗi nhưng không ném ra ngoài — tiếp tục dùng mock
      console.error('[ai] OpenAI failed, falling back to mock:', err)
    }
  }

  // Trả về phản hồi mock với model='mock-v1' để client biết đây không phải AI thật
  return {
    content: mockReply(message, contextSummary, ctx.displayName),
    model: 'mock-v1',
  }
}

/**
 * Kiểm tra xem OpenAI có được bật không (dựa trên sự tồn tại của API key).
 *
 * @returns `true` nếu `OPENAI_API_KEY` đã được cấu hình, `false` nếu chạy mock
 */
export function isOpenAiEnabled() {
  return !!env.OPENAI_API_KEY
}
