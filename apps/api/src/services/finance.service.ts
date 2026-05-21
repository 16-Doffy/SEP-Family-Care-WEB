/**
 * @module finance.service
 * @description Quản lý tài chính gia đình theo 3 lớp tách biệt:
 *
 *  1. **Planning (kế hoạch)**: `IncomeSource` + `FamilyBudget` +
 *     `FamilyMember.plannedPersonalExpense` — dự kiến mỗi tháng.
 *  2. **Actual (thực tế)**: `ActualIncome` + `PersonalExpense` + `FamilyExpense`
 *     — số thực tế đã xảy ra trong tháng.
 *  3. **Wallet Ledger (ví thật)**: khi `deductedFromWallet`/`creditedToWallet`
 *     = true, expense/income tạo `Transaction` thực sự trừ/cộng `Wallet`.
 *
 * `getMonthlySummary` trả số thực tế **chỉ từ ActualIncome** — không bao giờ
 * dùng `plannedIncome` làm fallback cho actual.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { IncomeSourceType } from '@prisma/client'
import { withdraw } from './wallet.service'

type Access = { role: string; familyMemberId?: string }

async function ensureMember(memberId: string, familyId: string) {
  const m = await prisma.familyMember.findFirst({ where: { id: memberId, familyId } })
  if (!m) throw Errors.NotFound('Family member')
  return m
}

function assertOwnerOrParent(targetMemberId: string, access: Access) {
  if (access.role === 'PARENT' || access.role === 'SUPER_ADMIN') return
  if (access.familyMemberId !== targetMemberId) throw Errors.Forbidden()
}

// ─── PLANNING: IncomeSource ──────────────────────────────────────────────────

export async function listIncomeSources(memberId: string, familyId: string) {
  await ensureMember(memberId, familyId)
  return prisma.incomeSource.findMany({
    where: { memberId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createIncomeSource(
  memberId: string,
  familyId: string,
  data: { label: string; sourceType?: IncomeSourceType; amountPerMonth: number; isActive?: boolean },
  access: Access,
) {
  await ensureMember(memberId, familyId)
  assertOwnerOrParent(memberId, access)
  const created = await prisma.incomeSource.create({
    data: {
      memberId,
      label: data.label,
      sourceType: data.sourceType ?? 'SALARY',
      amountPerMonth: data.amountPerMonth,
      isActive: data.isActive ?? true,
    },
  })
  await syncPlannedIncome(memberId)
  return created
}

export async function updateIncomeSource(
  id: string,
  familyId: string,
  data: { label?: string; sourceType?: IncomeSourceType; amountPerMonth?: number; isActive?: boolean },
  access: Access,
) {
  const src = await prisma.incomeSource.findUnique({ where: { id }, include: { member: true } })
  if (!src || src.member.familyId !== familyId) throw Errors.NotFound('Income source')
  assertOwnerOrParent(src.memberId, access)
  const updated = await prisma.incomeSource.update({ where: { id }, data })
  await syncPlannedIncome(src.memberId)
  return updated
}

export async function deleteIncomeSource(id: string, familyId: string, access: Access) {
  const src = await prisma.incomeSource.findUnique({ where: { id }, include: { member: true } })
  if (!src || src.member.familyId !== familyId) throw Errors.NotFound('Income source')
  assertOwnerOrParent(src.memberId, access)
  await prisma.incomeSource.delete({ where: { id } })
  await syncPlannedIncome(src.memberId)
}

async function syncPlannedIncome(memberId: string) {
  const agg = await prisma.incomeSource.aggregate({
    where: { memberId, isActive: true },
    _sum: { amountPerMonth: true },
  })
  const total = Number(agg._sum.amountPerMonth ?? 0)
  await prisma.familyMember.update({
    where: { id: memberId },
    data: { plannedMonthlyIncome: total, hasIncome: total > 0 },
  })
}

// ─── PLANNING: Member budget ─────────────────────────────────────────────────

export async function updateMemberBudget(
  memberId: string,
  familyId: string,
  data: { occupation?: string; plannedPersonalExpense?: number; personalSpendingLimit?: number | null },
  access: Access,
) {
  await ensureMember(memberId, familyId)
  assertOwnerOrParent(memberId, access)
  return prisma.familyMember.update({
    where: { id: memberId },
    data: {
      occupation: data.occupation,
      plannedPersonalExpense: data.plannedPersonalExpense,
      personalSpendingLimit: data.personalSpendingLimit ?? null,
    },
  })
}

// ─── PLANNING: Family budget (chi chung dự kiến) ─────────────────────────────

export async function getFamilyBudget(familyId: string, year: number, month: number) {
  return prisma.familyBudget.findUnique({
    where: { familyId_year_month: { familyId, year, month } },
    include: { categories: true },
  })
}

export async function upsertFamilyBudget(
  familyId: string,
  year: number,
  month: number,
  data: { notes?: string; categories: { name: string; amount: number }[] },
) {
  const planned = data.categories.reduce((sum, c) => sum + Number(c.amount), 0)
  return prisma.$transaction(async (tx) => {
    const budget = await tx.familyBudget.upsert({
      where: { familyId_year_month: { familyId, year, month } },
      create: { familyId, year, month, plannedSharedExpense: planned, notes: data.notes },
      update: { plannedSharedExpense: planned, notes: data.notes },
    })
    await tx.familyBudgetCategory.deleteMany({ where: { budgetId: budget.id } })
    if (data.categories.length > 0) {
      await tx.familyBudgetCategory.createMany({
        data: data.categories.map((c) => ({ budgetId: budget.id, name: c.name, amount: c.amount })),
      })
    }
    return tx.familyBudget.findUnique({
      where: { id: budget.id },
      include: { categories: true },
    })
  })
}

// ─── ACTUAL: ActualIncome ────────────────────────────────────────────────────

/**
 * Ghi nhận một khoản thu nhập thực tế.
 *
 * Nếu `creditToWallet=true`: tạo Transaction DEPOSIT vào ví cá nhân của member
 * (cộng balance). Mặc định false — chỉ ghi sổ.
 */
export async function createActualIncome(
  memberId: string,
  familyId: string,
  data: {
    amount: number
    sourceType?: IncomeSourceType
    note?: string
    occurredAt?: string
    creditToWallet?: boolean
  },
  access: Access,
) {
  await ensureMember(memberId, familyId)
  assertOwnerOrParent(memberId, access)
  if (data.amount <= 0) throw Errors.BadRequest('Số tiền phải lớn hơn 0')

  let transactionId: string | null = null

  if (data.creditToWallet) {
    const wallet = await prisma.wallet.findFirst({
      where: { familyId, type: 'PERSONAL', ownerId: memberId },
    })
    if (!wallet) throw Errors.NotFound('Ví cá nhân của thành viên')
    const [, tx] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: data.amount } },
      }),
      prisma.transaction.create({
        data: {
          toWalletId: wallet.id,
          amount: data.amount,
          type: 'DEPOSIT',
          description: `Thu nhập: ${data.note ?? data.sourceType ?? 'SALARY'}`,
        },
      }),
    ])
    transactionId = tx.id
  }

  return prisma.actualIncome.create({
    data: {
      memberId,
      amount: data.amount,
      sourceType: data.sourceType ?? 'SALARY',
      note: data.note,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      creditedToWallet: !!data.creditToWallet,
      transactionId,
    },
  })
}

export async function listActualIncomes(
  familyId: string,
  filters?: { memberId?: string; from?: Date; to?: Date; take?: number },
) {
  return prisma.actualIncome.findMany({
    where: {
      member: { familyId },
      ...(filters?.memberId && { memberId: filters.memberId }),
      ...(filters?.from && { occurredAt: { gte: filters.from } }),
      ...(filters?.to && { occurredAt: { lte: filters.to } }),
    },
    include: { member: { include: { user: { select: { displayName: true } } } } },
    orderBy: { occurredAt: 'desc' },
    take: filters?.take ?? 100,
  })
}

// ─── ACTUAL: PersonalExpense ─────────────────────────────────────────────────

export async function createPersonalExpense(
  memberId: string,
  familyId: string,
  data: {
    amount: number
    category: string
    note?: string
    occurredAt?: string
    deductFromWallet?: boolean
  },
  access: Access,
) {
  await ensureMember(memberId, familyId)
  assertOwnerOrParent(memberId, access)
  if (data.amount <= 0) throw Errors.BadRequest('Số tiền phải lớn hơn 0')

  let transactionId: string | null = null

  if (data.deductFromWallet) {
    const wallet = await prisma.wallet.findFirst({
      where: { familyId, type: 'PERSONAL', ownerId: memberId },
    })
    if (!wallet) throw Errors.NotFound('Ví cá nhân')
    const tx = await withdraw({
      walletId: wallet.id,
      amount: data.amount,
      description: `Chi cá nhân: ${data.category}${data.note ? ` — ${data.note}` : ''}`,
      familyId,
    })
    transactionId = tx.id
  }

  return prisma.personalExpense.create({
    data: {
      memberId,
      amount: data.amount,
      category: data.category,
      note: data.note,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      deductedFromWallet: !!data.deductFromWallet,
      transactionId,
    },
  })
}

export async function listPersonalExpenses(
  familyId: string,
  filters?: { memberId?: string; from?: Date; to?: Date; take?: number },
) {
  return prisma.personalExpense.findMany({
    where: {
      member: { familyId },
      ...(filters?.memberId && { memberId: filters.memberId }),
      ...(filters?.from && { occurredAt: { gte: filters.from } }),
      ...(filters?.to && { occurredAt: { lte: filters.to } }),
    },
    include: { member: { include: { user: { select: { displayName: true } } } } },
    orderBy: { occurredAt: 'desc' },
    take: filters?.take ?? 100,
  })
}

// ─── ACTUAL: FamilyExpense ───────────────────────────────────────────────────

export async function createFamilyExpense(
  familyId: string,
  data: {
    amount: number
    category: string
    note?: string
    paidById?: string
    occurredAt?: string
    deductFromWallet?: boolean
  },
) {
  if (data.amount <= 0) throw Errors.BadRequest('Số tiền phải lớn hơn 0')
  if (data.paidById) await ensureMember(data.paidById, familyId)

  let transactionId: string | null = null

  if (data.deductFromWallet) {
    const wallet = await prisma.wallet.findFirst({ where: { familyId, type: 'JOINT' } })
    if (!wallet) throw Errors.NotFound('Ví chung')
    const tx = await withdraw({
      walletId: wallet.id,
      amount: data.amount,
      description: `Chi chung: ${data.category}${data.note ? ` — ${data.note}` : ''}`,
      familyId,
    })
    transactionId = tx.id
  }

  return prisma.familyExpense.create({
    data: {
      familyId,
      amount: data.amount,
      category: data.category,
      note: data.note,
      paidById: data.paidById,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      deductedFromWallet: !!data.deductFromWallet,
      transactionId,
    },
  })
}

export async function listFamilyExpenses(
  familyId: string,
  filters?: { from?: Date; to?: Date; take?: number },
) {
  return prisma.familyExpense.findMany({
    where: {
      familyId,
      ...(filters?.from && { occurredAt: { gte: filters.from } }),
      ...(filters?.to && { occurredAt: { lte: filters.to } }),
    },
    include: { paidBy: { include: { user: { select: { displayName: true } } } } },
    orderBy: { occurredAt: 'desc' },
    take: filters?.take ?? 100,
  })
}

// ─── SUMMARY: ghép planning + actual ─────────────────────────────────────────

function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)
  return { from, to }
}

/**
 * Trả về summary tài chính của family theo tháng.
 *
 * Nguyên tắc:
 *  - `planned.*` = tổng từ IncomeSource / FamilyMember.plannedPersonalExpense /
 *    FamilyBudget. Đây là kế hoạch.
 *  - `actual.*` = tổng từ ActualIncome / PersonalExpense / FamilyExpense.
 *    KHÔNG bao giờ fallback về planned.
 *  - `actual.hasIncomeRecorded` = true nếu có ít nhất 1 ActualIncome trong tháng;
 *    nếu false, FE nên hiển thị "Chưa ghi nhận thu thực tế" thay vì dùng planned.
 */
export async function getMonthlySummary(familyId: string, year: number, month: number) {
  const { from, to } = monthRange(year, month)

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  })
  const memberIds = members.map((m) => m.id)

  const [budget, personalAgg, familyAgg, actualIncAgg, jointWallet] = await Promise.all([
    getFamilyBudget(familyId, year, month),
    prisma.personalExpense.groupBy({
      by: ['memberId'],
      where: { memberId: { in: memberIds }, occurredAt: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.familyExpense.aggregate({
      where: { familyId, occurredAt: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.actualIncome.groupBy({
      by: ['memberId'],
      where: { memberId: { in: memberIds }, occurredAt: { gte: from, lt: to } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.wallet.findFirst({ where: { familyId, type: 'JOINT' } }),
  ])

  const personalByMember = new Map<string, number>()
  personalAgg.forEach((r) => personalByMember.set(r.memberId, Number(r._sum.amount ?? 0)))
  const actualIncByMember = new Map<string, number>()
  actualIncAgg.forEach((r) => actualIncByMember.set(r.memberId, Number(r._sum.amount ?? 0)))

  // Planning
  const plannedIncome = members.reduce((s, m) => s + Number(m.plannedMonthlyIncome), 0)
  const plannedPersonalExpense = members.reduce((s, m) => s + Number(m.plannedPersonalExpense), 0)
  const plannedSharedExpense = Number(budget?.plannedSharedExpense ?? 0)
  const plannedExpense = plannedSharedExpense + plannedPersonalExpense
  const plannedSurplus = plannedIncome - plannedExpense

  // Actual
  const actualSharedExpense = Number(familyAgg._sum.amount ?? 0)
  const actualPersonalExpense = Array.from(personalByMember.values()).reduce((s, v) => s + v, 0)
  const actualIncome = Array.from(actualIncByMember.values()).reduce((s, v) => s + v, 0)
  const hasIncomeRecorded = actualIncAgg.length > 0 && actualIncome > 0
  const actualExpense = actualSharedExpense + actualPersonalExpense
  const actualSurplus = actualIncome - actualExpense

  const perMember = members.map((m) => {
    const aExp = personalByMember.get(m.id) ?? 0
    const aInc = actualIncByMember.get(m.id) ?? 0
    return {
      memberId: m.id,
      nickname: m.nickname,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      occupation: m.occupation,
      hasIncome: m.hasIncome,
      relationship: (m as { relationship?: string }).relationship ?? 'OTHER',
      plannedIncome: Number(m.plannedMonthlyIncome),
      plannedPersonalExpense: Number(m.plannedPersonalExpense),
      personalSpendingLimit: m.personalSpendingLimit ? Number(m.personalSpendingLimit) : null,
      actualIncome: aInc,
      actualPersonalExpense: aExp,
      hasIncomeRecorded: aInc > 0,
      isOverLimit: m.personalSpendingLimit ? aExp > Number(m.personalSpendingLimit) : false,
    }
  })

  return {
    year,
    month,
    jointWalletBalance: Number(jointWallet?.balance ?? 0),
    planned: {
      income: plannedIncome,
      sharedExpense: plannedSharedExpense,
      personalExpense: plannedPersonalExpense,
      totalExpense: plannedExpense,
      surplus: plannedSurplus,
    },
    actual: {
      income: actualIncome,
      sharedExpense: actualSharedExpense,
      personalExpense: actualPersonalExpense,
      totalExpense: actualExpense,
      surplus: actualSurplus,
      hasIncomeRecorded,
    },
    budget,
    perMember,
  }
}

/** Snapshot tháng — chỉ dùng actual. */
export async function closeMonth(familyId: string, year: number, month: number) {
  const summary = await getMonthlySummary(familyId, year, month)
  return prisma.monthlyFundSnapshot.upsert({
    where: { familyId_year_month: { familyId, year, month } },
    create: {
      familyId,
      year,
      month,
      totalIncome: summary.actual.income,
      totalSharedExpense: summary.actual.sharedExpense,
      totalPersonalExpense: summary.actual.personalExpense,
      surplus: summary.actual.surplus,
      jointWalletBalance: summary.jointWalletBalance,
    },
    update: {
      totalIncome: summary.actual.income,
      totalSharedExpense: summary.actual.sharedExpense,
      totalPersonalExpense: summary.actual.personalExpense,
      surplus: summary.actual.surplus,
      jointWalletBalance: summary.jointWalletBalance,
    },
  })
}

export async function checkOverspendThisMonth(memberId: string) {
  const m = await prisma.familyMember.findUnique({ where: { id: memberId } })
  if (!m || !m.personalSpendingLimit) return false
  const now = new Date()
  const { from, to } = monthRange(now.getFullYear(), now.getMonth() + 1)
  const agg = await prisma.personalExpense.aggregate({
    where: { memberId, occurredAt: { gte: from, lt: to } },
    _sum: { amount: true },
  })
  return Number(agg._sum.amount ?? 0) > Number(m.personalSpendingLimit)
}

