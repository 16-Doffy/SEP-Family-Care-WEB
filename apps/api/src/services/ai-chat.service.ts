import { prisma } from '../config/database'
import { generateReply, type AiContext } from './ai.service'

export async function getOrCreateConversation(userId: string) {
  let convo = await prisma.aiConversation.findUnique({ where: { userId } })
  if (!convo) {
    convo = await prisma.aiConversation.create({ data: { userId } })
  }
  return convo
}

export async function getMessages(userId: string, limit = 50) {
  const convo = await getOrCreateConversation(userId)
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return { conversation: convo, messages: rows.reverse() }
}

export async function sendAndReply(ctx: AiContext, userMessage: string) {
  const convo = await getOrCreateConversation(ctx.userId)

  await prisma.aiMessage.create({
    data: { conversationId: convo.id, role: 'user', content: userMessage },
  })

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { role: true, content: true },
  })
  const orderedHistory = history.reverse().slice(0, -1) // exclude the message we just inserted

  const reply = await generateReply(userMessage, ctx, orderedHistory)

  const assistantMsg = await prisma.aiMessage.create({
    data: {
      conversationId: convo.id,
      role: 'assistant',
      content: reply.content,
      model: reply.model,
      tokensUsed: reply.tokensUsed,
    },
  })

  await prisma.aiConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } })

  return { reply: assistantMsg, model: reply.model, tokensUsed: reply.tokensUsed }
}

export async function clearHistory(userId: string) {
  const convo = await prisma.aiConversation.findUnique({ where: { userId } })
  if (!convo) return
  await prisma.aiMessage.deleteMany({ where: { conversationId: convo.id } })
}
