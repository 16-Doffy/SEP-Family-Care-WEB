import { prisma } from '../config/database'
import type { NotificationType } from '@family-care/shared'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
}

let ioGetter: (() => import('socket.io').Server) | null = null

export function setIOGetter(getter: () => import('socket.io').Server) {
  ioGetter = getter
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ?? {},
    },
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, isRead: false },
  })

  // Emit to user's socket room
  if (ioGetter) {
    try {
      ioGetter().to(`user:${input.userId}`).emit('notification:new', {
        notification,
        unreadCount,
      })
    } catch {
      // Socket.IO not ready yet, that's okay
    }
  }

  return notification
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })
}

export async function markRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } })
}
