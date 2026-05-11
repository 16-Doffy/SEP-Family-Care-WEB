import { prisma } from '../config/database'
import { env } from '../config/env'

export interface AiContext {
  userId: string
  familyId?: string
  displayName: string
  role: string
}

export interface AiReply {
  content: string
  model: string
  tokensUsed?: number
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI tên "Family Care Assistant" giúp các thành viên gia đình quản lý tài chính, công việc, lịch và sự kiện.
Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Khi người dùng hỏi về số liệu (ví, task, lịch), hãy dùng dữ liệu được cung cấp trong context để trả lời chính xác.
Nếu không có dữ liệu liên quan, trả lời chung chung kèm gợi ý hữu ích.`

async function gatherUserContext(ctx: AiContext): Promise<string> {
  if (!ctx.familyId) return 'Người dùng chưa tham gia gia đình nào.'

  const [wallets, pendingTasks, completedThisMonth, upcomingEvents] = await Promise.all([
    prisma.wallet.findMany({
      where: { familyId: ctx.familyId, OR: [{ type: 'JOINT' }, { owner: { userId: ctx.userId } }] },
      select: { name: true, type: true, balance: true, currency: true },
    }),
    prisma.task.count({
      where: { familyId: ctx.familyId, status: { in: ['PENDING', 'IN_PROGRESS'] }, assignedTo: { userId: ctx.userId } },
    }),
    prisma.task.count({
      where: {
        familyId: ctx.familyId,
        status: 'APPROVED',
        assignedTo: { userId: ctx.userId },
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
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

  return [
    `Người dùng: ${ctx.displayName} (${ctx.role})`,
    `Ví tiền:\n${walletStr}`,
    `Nhiệm vụ đang chờ: ${pendingTasks}`,
    `Nhiệm vụ đã hoàn thành tháng này: ${completedThisMonth}`,
    `Sự kiện sắp tới:\n${eventsStr}`,
  ].join('\n\n')
}

function mockReply(message: string, contextSummary: string, displayName: string): string {
  const m = message.toLowerCase().trim()

  const walletLine = contextSummary.split('\n').find((l) => l.startsWith('- ') && l.includes('JOINT'))
  const personalLine = contextSummary.split('\n').find((l) => l.startsWith('- ') && l.includes('PERSONAL'))

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

  return `Mình đã ghi nhận câu hỏi: "${message}".\n\nHiện tại tôi có thể giúp bạn về: **ví/tài chính**, **nhiệm vụ**, **lịch gia đình**, **mẹo tiết kiệm**. Bạn thử hỏi cụ thể hơn xem nhé!`
}

async function callOpenAI(message: string, contextSummary: string, history: { role: string; content: string }[]): Promise<AiReply> {
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- DỮ LIỆU NGƯỜI DÙNG ---\n${contextSummary}` },
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

export async function generateReply(
  message: string,
  ctx: AiContext,
  history: { role: string; content: string }[],
): Promise<AiReply> {
  const contextSummary = await gatherUserContext(ctx)

  if (env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(message, contextSummary, history)
    } catch (err) {
      console.error('[ai] OpenAI failed, falling back to mock:', err)
    }
  }

  return {
    content: mockReply(message, contextSummary, ctx.displayName),
    model: 'mock-v1',
  }
}

export function isOpenAiEnabled() {
  return !!env.OPENAI_API_KEY
}
