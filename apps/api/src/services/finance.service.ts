/**
 * @module finance.service
 * @description Quản lý tài chính gia đình (Core flow 1).
 *
 * Chịu trách nhiệm CRUD cho IncomeSource (nguồn thu), FamilyBudget (dự kiến
 * chi chung), PersonalExpense (chi cá nhân thực tế), FamilyExpense (chi chung
 * thực tế); tổng hợp số liệu thu/chi theo tháng (dự kiến vs thực tế); và đóng
 * tháng (closeMonth) để tạo MonthlyFundSnapshot phục vụ dự đoán.
 *
 * Các bút toán "chi tiêu" KHÔNG tự động trừ tiền ví JOINT — đây là sổ ghi chép
 * dùng cho thống kê. Tác động lên balance ví JOINT chỉ xảy ra qua các flow đã
 * có (transfer, deposit, task reward).
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { IncomeSourceType } from '@prisma/client'

/** Một thành viên truy cập có vai trò + memberId (tuỳ chọn) để kiểm tra quyền tự sửa của mình. */
type Access = { role: string; familyMemberId?: string }

/** Đảm bảo member thuộc về family. Trả về member kèm familyId để dùng tiếp. */
async function ensureMember(memberId: string, familyId: string) {
  const m = await prisma.familyMember.findFirst({ where: { id: memberId, familyId } })
  if (!m) throw Errors.NotFound('Family member')
  return m
}

/** Chỉ chính chủ hoặc PARENT/SUPER_ADMIN mới được sửa dữ liệu của member khác. */
function assertOwnerOrParent(targetMemberId: string, access: Access) {
  if (access.role === 'PARENT' || access.role === 'SUPER_ADMIN') return
  if (access.familyMemberId !== targetMemberId) throw Errors.Forbidden()
}

// ─── IncomeSource ─────────────────────────────────────────────────────────────

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

/**
 * Cập nhật `plannedMonthlyIncome` + `hasIncome` của member dựa trên tổng các
 * nguồn thu đang active. Gọi mỗi khi IncomeSource bị thay đổi.
 */
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

// ─── Member budget ────────────────────────────────────────────────────────────

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

// ─── FamilyBudget (chi chung dự kiến) ─────────────────────────────────────────

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
    // Replace categories trọn gói cho đơn giản
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

// ─── PersonalExpense ──────────────────────────────────────────────────────────

export async function createPersonalExpense(
  memberId: string,
  familyId: string,
  data: { amount: number; category: string; note?: string; occurredAt?: string },
  access: Access,
) {
  await ensureMember(memberId, familyId)
  assertOwnerOrParent(memberId, access)
  return prisma.personalExpense.create({
    data: {
      memberId,
      amount: data.amount,
      category: data.category,
      note: data.note,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    },
  })
}

export async function listPersonalExpenses(
  memberId: string,
  familyId: string,
  range?: { from?: Date; to?: Date; take?: number },
) {
  await ensureMember(memberId, familyId)
  return prisma.personalExpense.findMany({
    where: {
      memberId,
      ...(range?.from && { occurredAt: { gte: range.from } }),
      ...(range?.to && { occurredAt: { lte: range.to } }),
    },
    orderBy: { occurredAt: 'desc' },
    take: range?.take ?? 100,
  })
}

// ─── FamilyExpense (chi chung thực tế, do PARENT ghi) ────────────────────────

export async function createFamilyExpense(
  familyId: string,
  data: { amount: number; category: string; note?: string; paidById?: string; occurredAt?: string },
) {
  if (data.paidById) {
    await ensureMember(data.paidById, familyId)
  }
  return prisma.familyExpense.create({
    data: {
      familyId,
      amount: data.amount,
      category: data.category,
      note: data.note,
      paidById: data.paidById,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    },
  })
}

export async function listFamilyExpenses(familyId: string, range?: { from?: Date; to?: Date; take?: number }) {
  return prisma.familyExpense.findMany({
    where: {
      familyId,
      ...(range?.from && { occurredAt: { gte: range.from } }),
      ...(range?.to && { occurredAt: { lte: range.to } }),
    },
    include: { paidBy: { include: { user: { select: { displayName: true } } } } },
    orderBy: { occurredAt: 'desc' },
    take: range?.take ?? 100,
  })
}

// ─── Tổng hợp tháng ───────────────────────────────────────────────────────────

/** Trả về [from, to) cho 1 tháng cụ thể (giờ địa phương server). */
function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)
  return { from, to }
}

export async function getMonthlySummary(familyId: string, year: number, month: number) {
  const { from, to } = monthRange(year, month)

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  })
  const memberIds = members.map((m) => m.id)

  const [budget, personalAgg, familyAgg, jointWallet] = await Promise.all([
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
    prisma.wallet.findFirst({ where: { familyId, type: 'JOINT' } }),
  ])

  const personalByMember = new Map<string, number>()
  personalAgg.forEach((row) => personalByMember.set(row.memberId, Number(row._sum.amount ?? 0)))

  // Quy ước: thu nhập thực tế tháng đó = plannedMonthlyIncome (chưa có flow nhập
  // thu nhập thực tế từng tháng). Đây là giả định v1 vì user đã xác nhận theo
  // mô hình "thu nhập bình quân".
  const plannedIncome = members.reduce((s, m) => s + Number(m.plannedMonthlyIncome), 0)
  const plannedPersonalExpense = members.reduce((s, m) => s + Number(m.plannedPersonalExpense), 0)
  const plannedSharedExpense = Number(budget?.plannedSharedExpense ?? 0)
  const plannedExpense = plannedSharedExpense + plannedPersonalExpense

  const actualPersonalExpense = Array.from(personalByMember.values()).reduce((s, v) => s + v, 0)
  const actualSharedExpense = Number(familyAgg._sum.amount ?? 0)
  const actualExpense = actualPersonalExpense + actualSharedExpense

  const actualIncome = plannedIncome
  const plannedSurplus = plannedIncome - plannedExpense
  const actualSurplus = actualIncome - actualExpense

  const perMember = members.map((m) => {
    const actual = personalByMember.get(m.id) ?? 0
    return {
      memberId: m.id,
      nickname: m.nickname,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      occupation: m.occupation,
      hasIncome: m.hasIncome,
      plannedIncome: Number(m.plannedMonthlyIncome),
      plannedPersonalExpense: Number(m.plannedPersonalExpense),
      personalSpendingLimit: m.personalSpendingLimit ? Number(m.personalSpendingLimit) : null,
      actualPersonalExpense: actual,
      isOverLimit: m.personalSpendingLimit ? actual > Number(m.personalSpendingLimit) : false,
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
    },
    budget,
    perMember,
  }
}

/**
 * Đóng tháng — tạo MonthlyFundSnapshot cho (year, month) dựa trên summary thực
 * tế. Idempotent: nếu snapshot đã tồn tại thì upsert ghi đè.
 */
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

/**
 * Khi member ghi 1 PersonalExpense → kiểm tra xem actual tháng đã vượt 150%
 * `personalSpendingLimit` chưa. Trả về true nếu nên bắn cảnh báo (gọi từ
 * controller hoặc finance-predict service).
 */
export async function checkOverspendThisMonth(memberId: string) {
  const m = await prisma.familyMember.findUnique({ where: { id: memberId } })
  if (!m || !m.personalSpendingLimit) return false
  const now = new Date()
  const { from, to } = monthRange(now.getFullYear(), now.getMonth() + 1)
  const agg = await prisma.personalExpense.aggregate({
    where: { memberId, occurredAt: { gte: from, lt: to } },
    _sum: { amount: true },
  })
  const actual = Number(agg._sum.amount ?? 0)
  return actual > Number(m.personalSpendingLimit) * 1.0
}
