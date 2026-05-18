import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as announcementService from '../services/announcement.service'
import * as notificationService from '../services/notification.service'
import { prisma } from '../config/database'

const announcementSchema = z.object({
  type: z.enum(['ANNOUNCEMENT', 'SUPPORT_REQUEST']).default('ANNOUNCEMENT'),
  content: z.string().min(1).max(1000),
})

/** POST /announcements — Tạo announcement hoặc support request (FE-22) */
export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, content } = announcementSchema.parse(req.body)
    const announcement = await announcementService.createAnnouncement(
      req.user.familyId!,
      req.user.familyMemberId!,
      type,
      content,
    )

    // Gửi notification đến các thành viên khác trong gia đình
    const memberUserIds = await prisma.familyMember.findMany({
      where: { familyId: req.user.familyId!, user: { isActive: true } },
      select: { userId: true },
    })
    const otherUserIds = memberUserIds
      .map((m) => m.userId)
      .filter((uid) => uid !== req.user.userId)

    const notifTitle = type === 'SUPPORT_REQUEST' ? '🆘 Yêu cầu hỗ trợ' : '📢 Thông báo gia đình'
    await Promise.all(
      otherUserIds.map((userId) =>
        notificationService.createNotification({
          userId,
          type: 'ANNOUNCEMENT',
          title: notifTitle,
          body: content.length > 80 ? content.slice(0, 80) + '...' : content,
          metadata: { announcementId: announcement.id, senderId: req.user.userId },
        }),
      ),
    )

    res.status(201).json(announcement)
  } catch (e) {
    next(e)
  }
}

/** GET /announcements — Lấy danh sách announcements */
export async function getAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, cursor } = z.object({
      type: z.enum(['ANNOUNCEMENT', 'SUPPORT_REQUEST']).optional(),
      cursor: z.string().optional(),
    }).parse(req.query)

    const items = await announcementService.getAnnouncements(req.user.familyId!, type, cursor)
    res.json(items)
  } catch (e) {
    next(e)
  }
}

/** DELETE /announcements/:id — Xóa announcement */
export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    await announcementService.deleteAnnouncement(
      req.params.id,
      req.user.familyMemberId!,
      req.user.role,
    )
    res.json({ message: 'Announcement deleted' })
  } catch (e) {
    next(e)
  }
}
