import type { Request, Response, NextFunction } from 'express'
import * as mrService from '../services/money-request.service'
import * as notificationService from '../services/notification.service'
import { prisma } from '../config/database'
import { getIO } from '../config/socket'

export async function createMoneyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId || !req.user.familyMemberId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { amount, reason } = req.body
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Số tiền không hợp lệ' })
      return
    }

    const request = await mrService.createMoneyRequest({
      familyId: req.user.familyId,
      requesterId: req.user.familyMemberId,
      amount: Number(amount),
      reason,
    })

    // Notify all parents
    const parentUserIds = await mrService.getParentUserIds(req.user.familyId)
    const requesterName = request.requester.user.displayName

    await Promise.all(
      parentUserIds.map((userId) =>
        notificationService.createNotification({
          userId,
          type: 'MONEY_REQUEST',
          title: '💰 Yêu cầu xin tiền',
          body: `${requesterName} xin ${Number(amount).toLocaleString('vi-VN')}₫${reason ? ` – ${reason}` : ''}`,
          metadata: { moneyRequestId: request.id, requesterId: req.user.userId },
        }),
      ),
    )

    // Emit realtime to family
    try {
      getIO().to(`family:${req.user.familyId}`).emit('money-request:new', { request })
    } catch {}

    res.status(201).json({ request })
  } catch (e) { next(e) }
}

export async function getMoneyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const requests = await mrService.getMoneyRequests(req.user.familyId)
    res.json({ requests })
  } catch (e) { next(e) }
}

export async function getPendingRequests(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const requests = await mrService.getPendingRequests(req.user.familyId)
    res.json({ requests })
  } catch (e) { next(e) }
}

export async function resolveMoneyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId || !req.user.familyMemberId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { status, note } = req.body
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const resolved = await mrService.resolveMoneyRequest({
      id: req.params.id,
      familyId: req.user.familyId,
      status,
      resolvedById: req.user.familyMemberId,
      note,
    })

    // Notify requester
    const requesterUserId = resolved.requester.user.id
    const resolverName = resolved.resolvedBy?.user.displayName ?? 'Phụ huynh'
    const isApproved = status === 'APPROVED'
    const amount = Number(resolved.amount).toLocaleString('vi-VN')

    await notificationService.createNotification({
      userId: requesterUserId,
      type: 'MONEY_RESOLVED',
      title: isApproved ? '✅ Yêu cầu được duyệt' : '❌ Yêu cầu bị từ chối',
      body: isApproved
        ? `${resolverName} đã duyệt ${amount}₫ vào ví của bạn`
        : `${resolverName} đã từ chối yêu cầu ${amount}₫${note ? ` – ${note}` : ''}`,
      metadata: { moneyRequestId: resolved.id },
    })

    // Emit realtime
    try {
      getIO().to(`family:${req.user.familyId}`).emit('money-request:update', { request: resolved })
    } catch {}

    res.json({ request: resolved })
  } catch (e) { next(e) }
}
