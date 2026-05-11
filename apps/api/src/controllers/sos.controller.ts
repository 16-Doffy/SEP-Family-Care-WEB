import type { Request, Response, NextFunction } from 'express'
import * as sosService from '../services/sos.service'
import * as notificationService from '../services/notification.service'
import { getIO } from '../config/socket'

export async function createSOSAlert(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { latitude, longitude, address, message } = req.body

    const alert = await sosService.createSOSAlert({
      familyId: req.user.familyId,
      senderId: req.user.userId,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      address,
      message,
    })

    // Emit realtime event to entire family room
    try {
      getIO().to(`family:${req.user.familyId}`).emit('sos:new', { alert })
    } catch {}

    // Send push notification to all other family members
    const memberUserIds = await sosService.getFamilyMemberUserIds(req.user.familyId, req.user.userId)
    const locationText = address ? ` Vị trí: ${address}.` : latitude ? ` Vị trí: ${latitude.toFixed(5)}, ${longitude?.toFixed(5)}.` : ''

    await Promise.all(
      memberUserIds.map((userId) =>
        notificationService.createNotification({
          userId,
          type: 'SOS',
          title: '🆘 SOS Khẩn cấp!',
          body: `${alert.sender.displayName} cần giúp đỡ ngay!${locationText}`,
          metadata: { sosAlertId: alert.id, senderId: req.user.userId },
        }),
      ),
    )

    res.status(201).json({ alert })
  } catch (e) { next(e) }
}

export async function getSOSAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const alerts = await sosService.getFamilySOSAlerts(req.user.familyId)
    res.json({ alerts })
  } catch (e) { next(e) }
}

export async function getActiveSOSAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const alerts = await sosService.getActiveSOSAlerts(req.user.familyId)
    res.json({ alerts })
  } catch (e) { next(e) }
}

export async function updateSOSStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { status } = req.body
    if (!['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const alert = await sosService.updateSOSStatus(
      req.params.id,
      req.user.familyId,
      status,
      req.user.userId,
    )

    // Emit realtime update to family
    try {
      getIO().to(`family:${req.user.familyId}`).emit('sos:update', { alert })
    } catch {}

    res.json({ alert })
  } catch (e) { next(e) }
}
