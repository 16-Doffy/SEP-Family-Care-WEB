import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as paymentService from '../services/payment.service'

const checkoutSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SUBSCRIPTION'),
    planId: z.string(),
  }),
  z.object({
    type: z.literal('WALLET_TOPUP'),
    amount: z.number().positive(),
    walletId: z.string(),
    description: z.string().optional(),
  }),
])

export async function createCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const body = checkoutSchema.parse(req.body)
    const result = await paymentService.createCheckoutSession({
      userId: req.user.userId,
      familyId: req.user.familyId!,
      ...body,
    })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

export async function confirmMock(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.confirmMockPayment(req.params.id, req.user.userId)
    res.json({ payment })
  } catch (e) { next(e) }
}

export async function listMyPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentService.listFamilyPayments(req.user.familyId!)
    res.json({ payments })
  } catch (e) { next(e) }
}

export async function getRevenue(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await paymentService.getRevenueStats()
    res.json(stats)
  } catch (e) { next(e) }
}
