/**
 * @module finance-predict.service
 * @description Dự đoán quỹ gia đình + sinh cảnh báo tài chính.
 *
 * Thuật toán (deterministic, không gọi LLM):
 *  - Forecast: lấy n snapshot gần nhất → moving average của `surplus` → cộng
 *    luỹ kế vào số dư ví JOINT hiện tại để có dự kiến từng tháng tới.
 *  - Cảnh báo:
 *      • BUDGET_WARNING        — member vượt 100% personalSpendingLimit.
 *      • FUND_LOW_WARNING      — JOINT < ngưỡng (mặc định 20% chi chung dự kiến).
 *      • FUND_SURPLUS_SUGGESTION — quỹ tăng ổn định 3 tháng liền + dư > 30% chi.
 *
 * Cảnh báo được phát realtime qua Socket.IO room `family:{familyId}` và tạo
 * Notification persistent cho mọi thành viên.
 */

import { prisma } from '../config/database'
import { createNotification } from './notification.service'
import { getMonthlySummary } from './finance.service'

/**
 * Trả về tối đa 6 snapshot gần nhất (sắp theo year-month tăng dần).
 */
async function recentSnapshots(familyId: string, limit = 6) {
  const rows = await prisma.monthlyFundSnapshot.findMany({
    where: { familyId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: limit,
  })
  return rows.reverse()
}

export async function getHistory(familyId: string) {
  return recentSnapshots(familyId, 6)
}

/**
 * Dự đoán quỹ JOINT trong `months` tháng tới (mặc định 3) bằng moving average.
 *
 * Fallback khi chưa có snapshot nào: dùng (planned income - planned expense)
 * tháng hiện tại làm surplus dự kiến.
 */
export async function forecast(familyId: string, months = 3) {
  const snapshots = await recentSnapshots(familyId, 6)
  const jointWallet = await prisma.wallet.findFirst({ where: { familyId, type: 'JOINT' } })
  const startBalance = Number(jointWallet?.balance ?? 0)

  let avgSurplus = 0
  if (snapshots.length > 0) {
    avgSurplus = snapshots.reduce((s, r) => s + Number(r.surplus), 0) / snapshots.length
  } else {
    const now = new Date()
    const summary = await getMonthlySummary(familyId, now.getFullYear(), now.getMonth() + 1)
    avgSurplus = summary.planned.surplus
  }

  const now = new Date()
  const projections: { year: number; month: number; projectedBalance: number; expectedSurplus: number }[] = []
  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    projections.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      expectedSurplus: avgSurplus,
      projectedBalance: startBalance + avgSurplus * i,
    })
  }

  return {
    startBalance,
    avgMonthlySurplus: avgSurplus,
    history: snapshots.map((s) => ({
      year: s.year,
      month: s.month,
      surplus: Number(s.surplus),
      jointWalletBalance: Number(s.jointWalletBalance),
      totalIncome: Number(s.totalIncome),
      totalExpense: Number(s.totalSharedExpense) + Number(s.totalPersonalExpense),
    })),
    projections,
  }
}

/**
 * Kiểm tra ngưỡng và sinh cảnh báo "live" (không persist). Dùng cho endpoint
 * GET /finance/warnings.
 */
export async function getActiveWarnings(familyId: string) {
  const now = new Date()
  const summary = await getMonthlySummary(familyId, now.getFullYear(), now.getMonth() + 1)
  const fc = await forecast(familyId, 3)

  const warnings: Array<{
    code: 'BUDGET_WARNING' | 'FUND_LOW_WARNING' | 'FUND_SURPLUS_SUGGESTION' | 'INCOME_VS_EXPENSE_TIGHT'
    severity: 'info' | 'warning' | 'danger'
    title: string
    body: string
    metadata?: Record<string, unknown>
  }> = []

  // 1. Member vượt hạn mức cá nhân
  summary.perMember
    .filter((m) => m.isOverLimit && m.personalSpendingLimit)
    .forEach((m) => {
      warnings.push({
        code: 'BUDGET_WARNING',
        severity: 'warning',
        title: `${m.displayName} đã vượt hạn mức chi tiêu`,
        body: `Chi tháng này ${m.actualPersonalExpense.toLocaleString('vi-VN')}đ, vượt hạn ${m.personalSpendingLimit!.toLocaleString('vi-VN')}đ.`,
        metadata: { memberId: m.memberId, actual: m.actualPersonalExpense, limit: m.personalSpendingLimit },
      })
    })

  // 2. Quỹ JOINT thấp so với chi chung
  const lowFundThreshold = summary.planned.sharedExpense * 0.2
  if (summary.jointWalletBalance < lowFundThreshold && summary.planned.sharedExpense > 0) {
    warnings.push({
      code: 'FUND_LOW_WARNING',
      severity: 'danger',
      title: 'Quỹ gia đình đang thấp',
      body: `Ví chung còn ${summary.jointWalletBalance.toLocaleString('vi-VN')}đ, dưới 20% chi chung dự kiến.`,
      metadata: { balance: summary.jointWalletBalance, threshold: lowFundThreshold },
    })
  }

  // 3. Thu / chi sát nhau (actual)
  if (summary.actual.totalExpense > 0 && summary.actual.income > 0) {
    const gap = summary.actual.income - summary.actual.totalExpense
    const ratio = gap / summary.actual.income
    if (ratio >= 0 && ratio < 0.1) {
      warnings.push({
        code: 'INCOME_VS_EXPENSE_TIGHT',
        severity: 'warning',
        title: 'Thu và chi đang sát nhau',
        body: `Dư chỉ ${gap.toLocaleString('vi-VN')}đ (<10% thu nhập). Cân nhắc tiết giảm chi tiêu.`,
      })
    } else if (gap < 0) {
      warnings.push({
        code: 'INCOME_VS_EXPENSE_TIGHT',
        severity: 'danger',
        title: 'Tháng này đang âm tiền',
        body: `Chi vượt thu ${Math.abs(gap).toLocaleString('vi-VN')}đ — quỹ JOINT sẽ giảm.`,
      })
    }
  }

  // 4. Gợi ý mua sắm khi quỹ dư ổn định
  const history = fc.history
  if (history.length >= 3) {
    const last3 = history.slice(-3)
    const stableSurplus = last3.every((h) => h.surplus > 0) && fc.avgMonthlySurplus > summary.planned.totalExpense * 0.3
    if (stableSurplus) {
      warnings.push({
        code: 'FUND_SURPLUS_SUGGESTION',
        severity: 'info',
        title: 'Quỹ gia đình đang dư ổn định',
        body: `Trung bình mỗi tháng dư ${fc.avgMonthlySurplus.toLocaleString('vi-VN')}đ. Có thể cân nhắc mua sắm hoặc đầu tư.`,
      })
    }
  }

  return warnings
}

/**
 * Sinh + lưu cảnh báo (Notification) cho tất cả thành viên. Dùng trong cron
 * cuối tháng hoặc khi member vừa ghi chi tiêu vượt hạn.
 */
export async function emitWarningsToFamily(familyId: string) {
  const warnings = await getActiveWarnings(familyId)
  if (warnings.length === 0) return warnings

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    select: { userId: true },
  })

  for (const w of warnings) {
    // Chỉ tạo notification persistent cho 3 code chính (tránh spam tight/info)
    if (w.code !== 'BUDGET_WARNING' && w.code !== 'FUND_LOW_WARNING' && w.code !== 'FUND_SURPLUS_SUGGESTION') {
      continue
    }
    for (const m of members) {
      await createNotification({
        userId: m.userId,
        type: w.code,
        title: w.title,
        body: w.body,
        metadata: w.metadata,
      })
    }
  }
  return warnings
}

/**
 * Sau khi 1 PersonalExpense vừa được ghi, gọi hàm này để bắn BUDGET_WARNING
 * cho mọi member nếu chủ chi vừa vượt limit.
 */
export async function maybeWarnOverspend(memberId: string, familyId: string) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { displayName: true } } },
  })
  if (!member || !member.personalSpendingLimit) return

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const agg = await prisma.personalExpense.aggregate({
    where: { memberId, occurredAt: { gte: from, lt: to } },
    _sum: { amount: true },
  })
  const actual = Number(agg._sum.amount ?? 0)
  const limit = Number(member.personalSpendingLimit)
  if (actual <= limit) return

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    select: { userId: true },
  })
  for (const m of members) {
    await createNotification({
      userId: m.userId,
      type: 'BUDGET_WARNING',
      title: `${member.user.displayName} vượt hạn mức chi`,
      body: `Chi tháng này ${actual.toLocaleString('vi-VN')}đ vượt hạn ${limit.toLocaleString('vi-VN')}đ.`,
      metadata: { memberId, actual, limit },
    })
  }
}
