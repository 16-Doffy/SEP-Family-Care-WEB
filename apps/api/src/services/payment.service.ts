import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { env } from '../config/env'
import { createNotification } from './notification.service'
import { Prisma } from '@prisma/client'

const MOCK_MODE = !env.STRIPE_SECRET_KEY

function nextExpiry(billingPeriod: string): Date {
  const now = new Date()
  switch (billingPeriod) {
    case 'YEARLY':
      now.setFullYear(now.getFullYear() + 1)
      break
    case 'LIFETIME':
      now.setFullYear(now.getFullYear() + 100)
      break
    case 'FREE':
      now.setFullYear(now.getFullYear() + 100)
      break
    case 'MONTHLY':
    default:
      now.setMonth(now.getMonth() + 1)
  }
  return now
}

export async function createCheckoutSession(input: {
  userId: string
  familyId: string
  type: 'SUBSCRIPTION' | 'WALLET_TOPUP'
  planId?: string
  amount?: number
  walletId?: string
  description?: string
}) {
  let amount = input.amount ?? 0
  let description = input.description ?? ''

  if (input.type === 'SUBSCRIPTION') {
    if (!input.planId) throw Errors.BadRequest('planId is required for subscription')
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } })
    if (!plan || !plan.isActive) throw Errors.NotFound('Plan')
    amount = Number(plan.price)
    description = `Đăng ký gói ${plan.name}`
  } else if (input.type === 'WALLET_TOPUP') {
    if (!input.amount || input.amount <= 0) throw Errors.BadRequest('amount must be positive')
    if (!input.walletId) throw Errors.BadRequest('walletId is required for topup')
    description = description || `Nạp ${input.amount.toLocaleString('vi-VN')} VND vào ví`
  }

  const payment = await prisma.payment.create({
    data: {
      familyId: input.familyId,
      userId: input.userId,
      type: input.type,
      amount,
      status: 'PENDING',
      provider: MOCK_MODE ? 'MOCK' : 'STRIPE',
      planId: input.planId ?? null,
      description,
      metadata: input.walletId ? { walletId: input.walletId } : undefined,
    },
  })

  if (MOCK_MODE) {
    return {
      mode: 'mock' as const,
      paymentId: payment.id,
      checkoutUrl: null,
      message: 'Stripe chưa cấu hình — dùng confirm-mock để hoàn tất thanh toán.',
    }
  }

  // Real Stripe path (when STRIPE_SECRET_KEY is set)
  // TODO: import('stripe') and create a Stripe Checkout Session here.
  // const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  // const session = await stripe.checkout.sessions.create({ ... })
  // await prisma.payment.update({ where: { id: payment.id }, data: { providerReference: session.id } })
  // return { mode: 'stripe', paymentId: payment.id, checkoutUrl: session.url }
  throw Errors.BadRequest('Stripe integration not yet implemented — keep STRIPE_SECRET_KEY empty to use mock mode')
}

export async function confirmMockPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw Errors.NotFound('Payment')
  if (payment.userId !== userId) throw Errors.Forbidden()
  if (payment.status !== 'PENDING') throw Errors.BadRequest(`Payment already ${payment.status}`)
  if (payment.provider !== 'MOCK') throw Errors.BadRequest('Not a mock payment')

  return finalizePayment(paymentId)
}

export async function finalizePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } })
    if (payment.status === 'SUCCEEDED') return payment

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCEEDED' },
    })

    if (payment.type === 'SUBSCRIPTION' && payment.planId) {
      const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: payment.planId } })
      const expiresAt = nextExpiry(plan.billingPeriod)
      await tx.family.update({
        where: { id: payment.familyId },
        data: {
          planId: plan.id,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: expiresAt,
        },
      })

      // Notify family members
      const members = await tx.familyMember.findMany({
        where: { familyId: payment.familyId },
        select: { userId: true },
      })
      // Defer notifications to outside tx
      setImmediate(() => {
        members.forEach((m) =>
          createNotification({
            userId: m.userId,
            type: 'SYSTEM',
            title: `🎉 Gói ${plan.name} đã kích hoạt`,
            body: `Hiệu lực đến ${expiresAt.toLocaleDateString('vi-VN')}`,
            metadata: { paymentId, planId: plan.id },
          }).catch(() => {}),
        )
      })
    } else if (payment.type === 'WALLET_TOPUP') {
      const meta = (payment.metadata ?? {}) as { walletId?: string }
      if (!meta.walletId) throw Errors.BadRequest('Topup payment missing walletId')

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: meta.walletId } })
      if (wallet.familyId !== payment.familyId) throw Errors.Forbidden()

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: payment.amount } },
      })
      await tx.transaction.create({
        data: {
          toWalletId: wallet.id,
          amount: payment.amount,
          type: 'DEPOSIT',
          description: payment.description ?? 'Nạp tiền qua thanh toán',
        },
      })

      setImmediate(() => {
        createNotification({
          userId: payment.userId,
          type: 'TRANSFER_RECEIVED',
          title: '💰 Nạp tiền thành công',
          body: `Đã nạp ${Number(payment.amount).toLocaleString('vi-VN')} ${payment.currency} vào ${wallet.name}`,
          metadata: { paymentId, walletId: wallet.id },
        }).catch(() => {})
      })
    }

    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } })
  })
}

export async function listFamilyPayments(familyId: string, limit = 50) {
  return prisma.payment.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function expireOverdueSubscriptions() {
  const now = new Date()
  const expired = await prisma.family.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: { lt: now },
      planId: { not: null },
    },
    select: { id: true, name: true, planId: true, members: { select: { userId: true } } },
  })

  for (const family of expired) {
    await prisma.family.update({
      where: { id: family.id },
      data: {
        subscriptionStatus: 'EXPIRED',
        planId: null,
        plan: 'FREE',
      },
    })

    for (const m of family.members) {
      await createNotification({
        userId: m.userId,
        type: 'SYSTEM',
        title: '⏰ Gói thuê bao đã hết hạn',
        body: `Gia đình "${family.name}" đã chuyển về gói FREE. Vui lòng gia hạn để tiếp tục các tính năng cao cấp.`,
        metadata: { familyId: family.id, expiredPlanId: family.planId },
      }).catch(() => {})
    }
  }

  if (expired.length > 0) {
    console.log(`[subscription] Expired ${expired.length} families`)
  }
  return expired.length
}

let expireTimer: NodeJS.Timeout | null = null
const EXPIRY_SCAN_INTERVAL_MS = 60 * 60 * 1000 // hourly

export function startSubscriptionExpiryScheduler() {
  if (expireTimer) return
  const tick = () => {
    expireOverdueSubscriptions().catch((err) => console.error('[subscription] expiry scan failed:', err))
  }
  tick()
  expireTimer = setInterval(tick, EXPIRY_SCAN_INTERVAL_MS)
  console.log(`💳 Subscription expiry scheduler started (every ${EXPIRY_SCAN_INTERVAL_MS / 60000}m)`)
}

// Revenue stats
export async function getRevenueStats() {
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last12mStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [totalRevenueRow, last30dRow, subRevenueRow, topupRevenueRow, activeSubs] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', type: 'SUBSCRIPTION' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: last30d } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', type: 'SUBSCRIPTION', createdAt: { gte: last30d } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', type: 'WALLET_TOPUP', createdAt: { gte: last30d } },
      _sum: { amount: true },
    }),
    prisma.family.findMany({
      where: { subscriptionStatus: 'ACTIVE', planId: { not: null } },
      select: { subscriptionPlan: { select: { price: true, billingPeriod: true } } },
    }),
  ])

  // MRR: sum of monthly-normalized prices of active subscriptions
  let mrr = new Prisma.Decimal(0)
  for (const f of activeSubs) {
    if (!f.subscriptionPlan) continue
    const price = new Prisma.Decimal(f.subscriptionPlan.price)
    if (f.subscriptionPlan.billingPeriod === 'YEARLY') {
      mrr = mrr.plus(price.div(12))
    } else if (f.subscriptionPlan.billingPeriod === 'MONTHLY') {
      mrr = mrr.plus(price)
    }
    // LIFETIME / FREE — not recurring revenue
  }
  const arr = mrr.times(12)

  // Monthly breakdown last 12 months
  const monthlyRaw = await prisma.$queryRaw<Array<{ month: Date; total: bigint | string; count: bigint }>>`
    SELECT date_trunc('month', "createdAt") as month,
           SUM(amount)::text as total,
           COUNT(*)::bigint as count
    FROM "Payment"
    WHERE "status" = 'SUCCEEDED' AND "createdAt" >= ${last12mStart}
    GROUP BY 1
    ORDER BY 1 ASC
  `

  return {
    totalRevenue: Number(totalRevenueRow._sum.amount ?? 0),
    last30dRevenue: Number(last30dRow._sum.amount ?? 0),
    last30dCount: last30dRow._count,
    last30dSubscriptionRevenue: Number(subRevenueRow._sum.amount ?? 0),
    last30dTopupRevenue: Number(topupRevenueRow._sum.amount ?? 0),
    mrr: Number(mrr),
    arr: Number(arr),
    activeSubscriptions: activeSubs.length,
    monthlyBreakdown: monthlyRaw.map((r) => ({
      month: new Date(r.month).toISOString().slice(0, 7),
      total: Number(r.total ?? 0),
      count: Number(r.count),
    })),
  }
}
