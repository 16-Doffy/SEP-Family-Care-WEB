import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  type: true,
  content: true,
  metadata: true,
  createdAt: true,
  sender: { select: { id: true, displayName: true, avatarUrl: true } },
}

export async function getConversations(userId: string, familyId: string) {
  return prisma.conversation.findMany({
    where: {
      familyId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: MESSAGE_SELECT,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getOrCreateFamilyGroupChat(familyId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { familyId, type: 'GROUP' },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
  if (existing) return existing

  const family = await prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: { members: true },
  })

  return prisma.conversation.create({
    data: {
      familyId,
      type: 'GROUP',
      name: `Nhóm ${family.name}`,
      participants: {
        create: family.members.map((m) => ({ userId: m.userId })),
      },
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
}

export async function getOrCreatePrivateChat(familyId: string, userId1: string, userId2: string) {
  if (userId1 === userId2) throw Errors.BadRequest('Cannot chat with yourself')

  const existing = await prisma.conversation.findFirst({
    where: {
      familyId,
      type: 'PRIVATE',
      AND: [
        { participants: { some: { userId: userId1 } } },
        { participants: { some: { userId: userId2 } } },
      ],
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      familyId,
      type: 'PRIVATE',
      participants: { create: [{ userId: userId1 }, { userId: userId2 }] },
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
}

export async function getMessages(conversationId: string, userId: string, cursor?: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!participant) throw Errors.Forbidden()

  const PAGE_SIZE = 30
  const rows = await prisma.message.findMany({
    where: { conversationId },
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return { messages: page.reverse(), nextCursor, hasMore }
}

export async function sendMessage(input: {
  conversationId: string
  senderId: string
  type: 'TEXT' | 'IMAGE' | 'LOCATION'
  content: string
  metadata?: Record<string, unknown>
}) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: input.conversationId, userId: input.senderId } },
  })
  if (!participant) throw Errors.Forbidden()

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        type: input.type,
        content: input.content,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
      },
      select: MESSAGE_SELECT,
    }),
    prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  return message
}

export async function markRead(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!participant) return
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  })
}

export async function addParticipantToGroupChats(familyId: string, userId: string) {
  const groupChats = await prisma.conversation.findMany({
    where: { familyId, type: 'GROUP' },
    select: { id: true },
  })
  for (const chat of groupChats) {
    const exists = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chat.id, userId } },
    })
    if (!exists) {
      await prisma.conversationParticipant.create({
        data: { conversationId: chat.id, userId },
      })
    }
  }
}
