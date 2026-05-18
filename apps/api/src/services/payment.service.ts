/**
 * @file payment.service.ts
 * @module services/payment
 *
 * Dịch vụ xử lý thanh toán cho ứng dụng Family Care.
 *
 * Hỗ trợ hai loại thanh toán:
 * - `SUBSCRIPTION`: Đăng ký / gia hạn gói thuê bao cho gia đình.
 * - `WALLET_TOPUP`: Nạp tiền vào ví trong ứng dụng.
 *
 * Chế độ hoạt động:
 * - **Mock mode** (mặc định): Khi `STRIPE_SECRET_KEY` chưa được cấu hình,
 *   hệ thống tạo payment ở trạng thái PENDING và cần gọi endpoint
 *   `confirm-mock` để mô phỏng thanh toán thành công.
 * - **Stripe mode** (chưa hoàn thiện): Placeholder để tích hợp Stripe
 *   Checkout Session thật trong tương lai.
 *
 * Ngoài ra còn có scheduler tự động kiểm tra và hết hạn subscription.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { env } from '../config/env'
import { createNotification } from './notification.service'
import { Prisma } from '@prisma/client'

/**
 * Cờ xác định hệ thống đang chạy ở chế độ mock hay Stripe thật.
 * Được xác định một lần khi module được load, dựa vào biến môi trường.
 */
const MOCK_MODE = !env.STRIPE_SECRET_KEY

/**
 * Tính ngày hết hạn subscription dựa trên chu kỳ thanh toán.
 *
 * - `MONTHLY`: cộng thêm 1 tháng
 * - `YEARLY`: cộng thêm 1 năm
 * - `LIFETIME` / `FREE`: cộng thêm 100 năm (coi như không hết hạn)
 *
 * @param billingPeriod - Chu kỳ thanh toán của gói
 * @returns Đối tượng `Date` là ngày hết hạn
 */
function nextExpiry(billingPeriod: string): Date {
  const now = new Date()
  switch (billingPeriod) {
    case 'YEARLY':
      now.setFullYear(now.getFullYear() + 1)
      break
    case 'LIFETIME':
      // Lifetime dùng 100 năm như một giá trị "vô hạn" thực tế
      now.setFullYear(now.getFullYear() + 100)
      break
    case 'FREE':
      // Gói FREE không có ngày hết hạn thực sự
      now.setFullYear(now.getFullYear() + 100)
      break
    case 'MONTHLY':
    default:
      now.setMonth(now.getMonth() + 1)
  }
  return now
}

/**
 * Tạo một phiên thanh toán mới (checkout session).
 *
 * Với **SUBSCRIPTION**: lấy thông tin giá từ gói plan trong database.
 * Với **WALLET_TOPUP**: dùng số tiền do client gửi lên.
 *
 * Nếu đang ở mock mode, trả về `paymentId` để dùng cho `confirmMockPayment`.
 * Nếu đang ở Stripe mode (chưa implement), ném lỗi `BadRequest`.
 *
 * @param input - Thông tin tạo phiên thanh toán
 * @param input.userId - ID người dùng thực hiện thanh toán
 * @param input.familyId - ID gia đình liên quan
 * @param input.type - Loại thanh toán: `SUBSCRIPTION` hoặc `WALLET_TOPUP`
 * @param input.planId - ID gói subscription (bắt buộc nếu type=SUBSCRIPTION)
 * @param input.amount - Số tiền nạp (bắt buộc nếu type=WALLET_TOPUP)
 * @param input.walletId - ID ví cần nạp (bắt buộc nếu type=WALLET_TOPUP)
 * @param input.description - Mô tả giao dịch (tùy chọn)
 * @returns Đối tượng chứa `paymentId`, `checkoutUrl` và `mode`
 * @throws BadRequest nếu thiếu tham số bắt buộc hoặc Stripe chưa tích hợp
 * @throws NotFound nếu gói plan không tồn tại hoặc không active
 */
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
    // Lấy giá từ database, không tin vào giá client gửi lên (bảo mật).
    // Nếu admin cấu hình riêng giá tháng/năm thì ưu tiên giá theo chu kỳ đó.
    amount = Number(
      plan.billingPeriod === 'YEARLY'
        ? plan.priceYearly ?? plan.price
        : plan.billingPeriod === 'MONTHLY'
          ? plan.priceMonthly ?? plan.price
          : plan.price,
    )
    description = `Đăng ký gói ${plan.name}`
  } else if (input.type === 'WALLET_TOPUP') {
    if (!input.amount || input.amount <= 0) throw Errors.BadRequest('amount must be positive')
    if (!input.walletId) throw Errors.BadRequest('walletId is required for topup')
    description = description || `Nạp ${input.amount.toLocaleString('vi-VN')} VND vào ví`
  }

  // Tạo bản ghi Payment trước, chưa SUCCEEDED — sẽ finalize sau khi thanh toán xong
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
      // Lưu walletId vào metadata JSON vì Payment không có cột walletId riêng
      metadata: input.walletId ? { walletId: input.walletId } : undefined,
    },
  })

  if (MOCK_MODE) {
    // Trả về paymentId để client gọi confirm-mock và mô phỏng thanh toán
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

/**
 * Xác nhận thanh toán mock (mô phỏng callback từ cổng thanh toán).
 *
 * Chỉ cho phép người dùng xác nhận payment của chính họ.
 * Chỉ hoạt động với payment ở trạng thái `PENDING` và provider `MOCK`.
 *
 * @param paymentId - ID bản ghi payment cần xác nhận
 * @param userId - ID người dùng thực hiện xác nhận
 * @returns Bản ghi payment đã được finalize
 * @throws NotFound nếu payment không tồn tại
 * @throws Forbidden nếu payment không thuộc về người dùng
 * @throws BadRequest nếu payment không ở trạng thái PENDING hoặc không phải MOCK
 */
export async function confirmMockPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw Errors.NotFound('Payment')
  if (payment.userId !== userId) throw Errors.Forbidden()
  if (payment.status !== 'PENDING') throw Errors.BadRequest(`Payment already ${payment.status}`)
  if (payment.provider !== 'MOCK') throw Errors.BadRequest('Not a mock payment')

  return finalizePayment(paymentId)
}

/**
 * Hoàn tất thanh toán: cập nhật trạng thái và thực hiện các tác vụ hậu thanh toán.
 *
 * Toàn bộ logic chạy trong một **database transaction** để đảm bảo tính nhất quán:
 * - Nếu là SUBSCRIPTION: cập nhật `planId`, `subscriptionStatus`, `subscriptionExpiresAt`
 *   của gia đình và gửi thông báo cho tất cả thành viên.
 * - Nếu là WALLET_TOPUP: cộng tiền vào ví, tạo bản ghi transaction, gửi thông báo.
 *
 * Thông báo được gửi bằng `setImmediate` bên ngoài transaction để:
 * 1. Không block transaction nếu gửi notification thất bại.
 * 2. Tránh deadlock do notification có thể write thêm vào DB.
 *
 * @param paymentId - ID payment cần finalize
 * @returns Bản ghi payment sau khi đã cập nhật
 * @throws NotFound nếu payment không tồn tại
 * @throws BadRequest nếu WALLET_TOPUP thiếu walletId trong metadata
 * @throws Forbidden nếu ví không thuộc gia đình của payment
 */
export async function finalizePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } })

    // Idempotent: nếu đã SUCCEEDED thì không làm gì thêm (tránh double-credit)
    if (payment.status === 'SUCCEEDED') return payment

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCEEDED' },
    })

    if (payment.type === 'SUBSCRIPTION' && payment.planId) {
      const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: payment.planId } })
      const expiresAt = nextExpiry(plan.billingPeriod)

      // Cập nhật thông tin subscription của gia đình
      await tx.family.update({
        where: { id: payment.familyId },
        data: {
          planId: plan.id,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: expiresAt,
        },
      })

      const containerName = `family-${payment.familyId.slice(0, 8)}`
      const databaseName = `family_${payment.familyId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24)}`
      await tx.familyProvision.upsert({
        where: { familyId: payment.familyId },
        create: {
          familyId: payment.familyId,
          status: 'READY',
          containerName,
          databaseName,
          imageTag: 'shared-runtime',
          metadata: {
            mode: 'shared-db',
            note: 'Provisioned automatically after successful subscription payment',
            paymentId,
            planId: plan.id,
          },
          provisionedAt: new Date(),
          lastError: null,
        },
        update: {
          status: 'READY',
          containerName,
          databaseName,
          imageTag: 'shared-runtime',
          metadata: {
            mode: 'shared-db',
            note: 'Provisioned automatically after successful subscription payment',
            paymentId,
            planId: plan.id,
          },
          provisionedAt: new Date(),
          lastError: null,
        },
      })

      // Lấy danh sách thành viên để gửi thông báo
      const members = await tx.familyMember.findMany({
        where: { familyId: payment.familyId },
        select: { userId: true },
      })

      // Dùng setImmediate để gửi notification sau khi transaction commit,
      // tránh lỗi notification làm rollback transaction chính
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
      // Đọc walletId từ metadata JSON (được lưu khi tạo payment)
      const meta = (payment.metadata ?? {}) as { walletId?: string }
      if (!meta.walletId) throw Errors.BadRequest('Topup payment missing walletId')

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: meta.walletId } })

      // Kiểm tra ví thuộc đúng gia đình để tránh nạp nhầm ví
      if (wallet.familyId !== payment.familyId) throw Errors.Forbidden()

      // Tăng số dư ví và tạo bản ghi giao dịch để có lịch sử
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

      // Gửi thông báo nạp tiền thành công sau khi transaction commit
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

/**
 * Lấy danh sách lịch sử thanh toán của một gia đình.
 *
 * @param familyId - ID gia đình cần xem lịch sử
 * @param limit - Số bản ghi tối đa (mặc định 50)
 * @returns Mảng các bản ghi payment sắp xếp mới nhất trước
 */
export async function listFamilyPayments(familyId: string, limit = 50) {
  return prisma.payment.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Quét và hết hạn các subscription đã quá ngày hết hạn.
 *
 * Tìm tất cả gia đình có `subscriptionStatus = ACTIVE` và
 * `subscriptionExpiresAt` trong quá khứ, sau đó:
 * 1. Đặt `subscriptionStatus = EXPIRED`, xóa `planId`, về gói `FREE`.
 * 2. Gửi thông báo cho tất cả thành viên về việc hết hạn.
 *
 * Hàm này được gọi tự động bởi scheduler (mỗi giờ một lần).
 *
 * @returns Số gia đình đã bị expire trong lần quét này
 */
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
    // Hạ cấp về FREE và xóa planId
    await prisma.family.update({
      where: { id: family.id },
      data: {
        subscriptionStatus: 'EXPIRED',
        planId: null,
        plan: 'FREE',
      },
    })

    // Thông báo cho từng thành viên trong gia đình
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

/** Biến giữ tham chiếu tới interval để tránh tạo nhiều scheduler trùng lặp */
let expireTimer: NodeJS.Timeout | null = null

/** Chu kỳ quét hết hạn subscription: mỗi 60 phút */
const EXPIRY_SCAN_INTERVAL_MS = 60 * 60 * 1000 // hourly

/**
 * Khởi động scheduler tự động hết hạn subscription.
 *
 * Chạy `expireOverdueSubscriptions` ngay lập tức một lần, sau đó
 * lặp lại mỗi `EXPIRY_SCAN_INTERVAL_MS` (60 phút).
 *
 * Kiểm tra `expireTimer` để đảm bảo scheduler không bị khởi động nhiều lần
 * (ví dụ khi hot-reload trong development).
 */
export function startSubscriptionExpiryScheduler() {
  if (expireTimer) return
  const tick = () => {
    expireOverdueSubscriptions().catch((err) => console.error('[subscription] expiry scan failed:', err))
  }
  // Quét ngay khi server khởi động để xử lý các subscription đã hết hạn trong lúc offline
  tick()
  expireTimer = setInterval(tick, EXPIRY_SCAN_INTERVAL_MS)
  console.log(`💳 Subscription expiry scheduler started (every ${EXPIRY_SCAN_INTERVAL_MS / 60000}m)`)
}

/**
 * Lấy thống kê doanh thu cho dashboard admin.
 *
 * Bao gồm:
 * - Tổng doanh thu từ subscription mọi thời gian
 * - Doanh thu 30 ngày gần nhất (tách theo loại)
 * - MRR (Monthly Recurring Revenue) - tổng doanh thu tháng chuẩn hóa từ các sub đang active
 * - ARR (Annual Recurring Revenue) = MRR × 12
 * - Breakdown doanh thu theo từng tháng trong 12 tháng gần nhất
 *
 * Cách tính MRR:
 * - Gói MONTHLY: cộng trực tiếp giá vào MRR
 * - Gói YEARLY: chia đều 12 tháng (price / 12) để chuẩn hóa về tháng
 * - Gói LIFETIME / FREE: không tính vào MRR (không phải recurring)
 *
 * @returns Đối tượng chứa các chỉ số doanh thu
 */
// Revenue stats
export async function getRevenueStats() {
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last12mStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  // Thực hiện tất cả query song song để giảm thời gian phản hồi
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
      select: { subscriptionPlan: { select: { price: true, priceMonthly: true, priceYearly: true, billingPeriod: true } } },
    }),
  ])

  // MRR: sum of monthly-normalized prices of active subscriptions
  let mrr = new Prisma.Decimal(0)
  for (const f of activeSubs) {
    if (!f.subscriptionPlan) continue
    if (f.subscriptionPlan.billingPeriod === 'YEARLY') {
      // Chuẩn hóa gói năm về tháng: chia 12
      const price = new Prisma.Decimal(f.subscriptionPlan.priceYearly ?? f.subscriptionPlan.price)
      mrr = mrr.plus(price.div(12))
    } else if (f.subscriptionPlan.billingPeriod === 'MONTHLY') {
      const price = new Prisma.Decimal(f.subscriptionPlan.priceMonthly ?? f.subscriptionPlan.price)
      mrr = mrr.plus(price)
    }
    // LIFETIME / FREE — not recurring revenue
  }
  const arr = mrr.times(12)

  // Dùng raw SQL để group by tháng — Prisma ORM không hỗ trợ date_trunc trực tiếp
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
