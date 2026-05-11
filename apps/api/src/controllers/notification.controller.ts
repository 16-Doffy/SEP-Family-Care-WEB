import type { Request, Response, NextFunction } from 'express'
import * as notificationService from '../services/notification.service'

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

