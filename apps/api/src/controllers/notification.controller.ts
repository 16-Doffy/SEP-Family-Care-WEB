import type { Request, Response, NextFunction } from 'express'
import * as notificationService from '../services/notification.service'
import { prisma } from '../config/database'

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationService.getNotifications(req.user.userId)
    const unreadCount = await notificationService.getUnreadCount(req.user.userId)
    res.json({ notifications, unreadCount })
  } catch (e) { next(e) }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markRead(req.params.id, req.user.userId)
    res.json({ message: 'Marked as read' })
  } catch (e) { next(e) }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllRead(req.user.userId)
    res.json({ message: 'All marked as read' })
  } catch (e) { next(e) }
}

export async function sendSOS(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const sender = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
      select: { displayName: true },
    })

    const members = await prisma.familyMember.findMany({
      where: { familyId: req.user.familyId, userId: { not: req.user.userId } },
      select: { userId: true },
    })

    await Promise.all(
      members.map((m) =>
        notificationService.createNotification({
          userId: m.userId,
          type: 'SOS',
          title: '🆘 SOS Khẩn cấp!',
          body: `${sender.displayName} đang cần giúp đỡ khẩn cấp!`,
          metadata: { senderId: req.user.userId },
        }),
      ),
    )

    res.json({ message: 'SOS sent to all family members' })
  } catch (e) { next(e) }
}
