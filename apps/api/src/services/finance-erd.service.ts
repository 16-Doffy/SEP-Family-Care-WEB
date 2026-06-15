/**
 * @module finance-erd.service
 * @description Core flow tài chính theo ERD: FinanceLedger + LedgerEntry +
 * FinanceModel/FinanceJar + FinanceCategory + BudgetPlan/BudgetLine.
 *
 * Đây là **internal ledger** (ghi nhận thu/chi nội bộ), KHÔNG phải ví điện tử
 * thật — không đụng Wallet/Transaction. Tách biệt hẳn với finance.service cũ.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type {
  LedgerEntryType,
  FinanceModelType,
  FinanceCategoryType,
  EssentialType,
  BudgetPeriodType,
} from '@prisma/client'

type Access = { role: string; familyMemberId?: string }

const INFLOW: LedgerEntryType[] = ['INCOME', 'CONTRIBUTION']
const OUTFLOW: LedgerEntryType[] = ['EXPENSE', 'ALLOWANCE', 'REWARD', 'SUPPORT']

const num = (d: unknown) => Number(d ?? 0)
const isManager = (a: Access) => a.role === 'PARENT' || a.role === 'SUPER_ADMIN'

function assertManager(access: Access) {
  if (!isManager(access)) throw Errors.Forbidden()
}

// ─── Family shared ledger ─────────────────────────────────────────────────────

/** Đảm bảo workspace có đúng 1 FAMILY_SHARED ledger ACTIVE; tạo nếu chưa có. */
export async function ensureFamilyLedger(familyId: string) {
  const existing = await prisma.financeLedger.findFirst({
    where: { familyId, type: 'FAMILY_SHARED', status: 'ACTIVE' },
  })
  if (existing) return existing
  return prisma.financeLedger.create({
    data: {
      familyId,
      name: 'Sổ quỹ gia đình',
      type: 'FAMILY_SHARED',
      status: 'ACTIVE',
      note: 'Internal ledger only — không phải ví điện tử thật.',
    },
  })
}

// ─── Finance model + jars ─────────────────────────────────────────────────────

export async function getActiveModel(familyId: string) {
  return prisma.financeModel.findFirst({
    where: { familyId, status: 'ACTIVE' },
    include: { jars: { orderBy: { sortOrder: 'asc' } } },
  })
}

/**
 * Chọn/đặt lại finance model (5 lọ / 80-20 / custom). Vô hiệu hoá model active
 * cũ rồi tạo model mới + các jar. Tổng allocation không vượt 100%.
 */
export async function setupModel(
  familyId: string,
  memberId: string | undefined,
  input: {
    type: FinanceModelType
    name?: string
    jars: { name: string; allocationRatio: number; purpose?: string; color?: string }[]
  },
  access: Access,
) {
  assertManager(access)
  if (input.jars.length === 0) throw Errors.BadRequest('Cần ít nhất 1 jar')
  const total = input.jars.reduce((s, j) => s + j.allocationRatio, 0)
  if (total > 100) throw Errors.BadRequest('Tổng allocation của các jar không được vượt 100%')

  const ledger = await ensureFamilyLedger(familyId)

  return prisma.$transaction(async (tx) => {
    await tx.financeModel.updateMany({
      where: { familyId, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    })
    const model = await tx.financeModel.create({
      data: {
        familyId,
        createdById: memberId,
        name: input.name ?? defaultModelName(input.type),
        type: input.type,
        status: 'ACTIVE',
      },
    })
    await tx.financeJar.createMany({
      data: input.jars.map((j, i) => ({
        modelId: model.id,
        ledgerId: ledger.id,
        name: j.name,
        purpose: j.purpose,
        allocationRatio: j.allocationRatio,
        color: j.color ?? jarColor(i),
        sortOrder: i,
      })),
    })
    return tx.financeModel.findUniqueOrThrow({
      where: { id: model.id },
      include: { jars: { orderBy: { sortOrder: 'asc' } } },
    })
  })
}

function defaultModelName(type: FinanceModelType) {
  if (type === 'FIVE_JARS') return 'Mô hình 5 chiếc lọ'
  if (type === 'EIGHTY_TWENTY') return 'Mô hình 80/20'
  return 'Mô hình tuỳ chỉnh'
}
function jarColor(i: number) {
  return ['#2563eb', '#0f766e', '#f59e0b', '#db2777', '#7c3aed', '#dc2626'][i % 6]
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(familyId: string) {
  return prisma.financeCategory.findMany({
    where: { familyId, status: 'ACTIVE' },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
}

export async function createCategory(
  familyId: string,
  input: {
    name: string
    type: FinanceCategoryType
    defaultJarId?: string
    defaultEssentialType?: EssentialType
  },
  access: Access,
) {
  assertManager(access)
  if (input.defaultJarId) await ensureJar(input.defaultJarId, familyId)
  try {
    return await prisma.financeCategory.create({
      data: {
        familyId,
        name: input.name,
        type: input.type,
        defaultJarId: input.defaultJarId,
        defaultEssentialType: input.defaultEssentialType,
      },
    })
  } catch {
    throw Errors.Conflict('Danh mục đã tồn tại trong workspace')
  }
}

// ─── Ledger entries ───────────────────────────────────────────────────────────

async function ensureJar(jarId: string, familyId: string) {
  const jar = await prisma.financeJar.findFirst({ where: { id: jarId, ledger: { familyId } } })
  if (!jar) throw Errors.NotFound('Finance jar')
  return jar
}
async function ensureCategory(categoryId: string, familyId: string) {
  const cat = await prisma.financeCategory.findFirst({ where: { id: categoryId, familyId } })
  if (!cat) throw Errors.NotFound('Finance category')
  return cat
}

export async function listEntries(familyId: string, take = 50) {
  const ledger = await ensureFamilyLedger(familyId)
  return prisma.ledgerEntry.findMany({
    where: { ledgerId: ledger.id, status: 'ACTIVE' },
    include: {
      category: { select: { id: true, name: true, type: true } },
      jar: { select: { id: true, name: true, color: true } },
      recordedBy: { select: { id: true, displayName: true, user: { select: { displayName: true } } } },
    },
    orderBy: { entryDate: 'desc' },
    take,
  })
}

export async function createEntry(
  familyId: string,
  memberId: string | undefined,
  input: {
    type: LedgerEntryType
    amount: number
    title: string
    description?: string
    categoryId?: string
    jarId?: string
    essentialType?: EssentialType
    occurredAt?: string
  },
) {
  if (input.amount <= 0) throw Errors.BadRequest('Số tiền phải lớn hơn 0')
  const ledger = await ensureFamilyLedger(familyId)
  if (input.jarId) await ensureJar(input.jarId, familyId)
  if (input.categoryId) await ensureCategory(input.categoryId, familyId)

  return prisma.ledgerEntry.create({
    data: {
      ledgerId: ledger.id,
      recordedById: memberId,
      type: input.type,
      amount: input.amount,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      jarId: input.jarId,
      essentialType: input.essentialType ?? 'NA',
      sourceType: 'MANUAL',
      entryDate: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    },
    include: {
      category: { select: { id: true, name: true } },
      jar: { select: { id: true, name: true, color: true } },
    },
  })
}

// ─── Budget plan ──────────────────────────────────────────────────────────────

export async function getActiveBudgetPlan(familyId: string) {
  return prisma.budgetPlan.findFirst({
    where: { familyId, status: 'ACTIVE' },
    include: { lines: { include: { category: { select: { id: true, name: true } }, jar: { select: { id: true, name: true } } } } },
    orderBy: { startDate: 'desc' },
  })
}

export async function createBudgetPlan(
  familyId: string,
  memberId: string | undefined,
  input: {
    name: string
    periodType?: BudgetPeriodType
    startDate?: string
    endDate?: string
    expectedSharedIncome?: number
    expectedSharedExpense?: number
    lines: {
      name: string
      categoryId?: string
      jarId?: string
      plannedAmount: number
      essentialType?: EssentialType
    }[]
  },
  access: Access,
) {
  assertManager(access)
  for (const line of input.lines) {
    if (line.categoryId) await ensureCategory(line.categoryId, familyId)
    if (line.jarId) await ensureJar(line.jarId, familyId)
  }
  const start = input.startDate ? new Date(input.startDate) : startOfMonth(new Date())

  return prisma.$transaction(async (tx) => {
    // Một active budget plan tại một thời điểm cho gọn.
    await tx.budgetPlan.updateMany({ where: { familyId, status: 'ACTIVE' }, data: { status: 'CLOSED' } })
    const plan = await tx.budgetPlan.create({
      data: {
        familyId,
        createdById: memberId,
        name: input.name,
        periodType: input.periodType ?? 'MONTHLY',
        startDate: start,
        endDate: input.endDate ? new Date(input.endDate) : null,
        expectedSharedIncome: input.expectedSharedIncome,
        expectedSharedExpense: input.expectedSharedExpense,
        status: 'ACTIVE',
      },
    })
    if (input.lines.length) {
      await tx.budgetLine.createMany({
        data: input.lines.map((l) => ({
          budgetPlanId: plan.id,
          categoryId: l.categoryId,
          jarId: l.jarId,
          name: l.name,
          plannedAmount: l.plannedAmount,
          essentialType: l.essentialType ?? 'NA',
        })),
      })
    }
    return tx.budgetPlan.findUniqueOrThrow({ where: { id: plan.id }, include: { lines: true } })
  })
}

// ─── Overview (đọc tổng hợp) ──────────────────────────────────────────────────

export async function getOverview(familyId: string) {
  const ledger = await ensureFamilyLedger(familyId)
  const [model, entries, budget] = await Promise.all([
    getActiveModel(familyId),
    prisma.ledgerEntry.findMany({
      where: { ledgerId: ledger.id, status: 'ACTIVE' },
      include: {
        category: { select: { id: true, name: true, type: true } },
        jar: { select: { id: true, name: true, color: true } },
        recordedBy: { select: { id: true, displayName: true, user: { select: { displayName: true } } } },
      },
      orderBy: { entryDate: 'desc' },
    }),
    getActiveBudgetPlan(familyId),
  ])

  // Số dư ledger + tổng tháng hiện tại.
  const monthStart = startOfMonth(new Date())
  let inflow = 0
  let outflow = 0
  let monthIncome = 0
  let monthExpense = 0
  const jarNet: Record<string, number> = {}
  for (const e of entries) {
    const amt = num(e.amount)
    const isIn = INFLOW.includes(e.type)
    const isOut = OUTFLOW.includes(e.type)
    if (isIn) inflow += amt
    if (isOut) outflow += amt
    if (e.entryDate >= monthStart) {
      if (isIn) monthIncome += amt
      else if (isOut) monthExpense += amt
    }
    if (e.jarId) jarNet[e.jarId] = (jarNet[e.jarId] ?? 0) + (isIn ? amt : -amt)
  }
  const balance = num(ledger.openingAmount) + inflow - outflow

  const jars = (model?.jars ?? []).map((j) => ({
    id: j.id,
    name: j.name,
    purpose: j.purpose,
    color: j.color,
    allocationRatio: num(j.allocationRatio),
    // Phân bổ lý thuyết theo % trên thu nhập tháng + số thực ghi vào jar.
    allocatedThisMonth: Math.round((monthIncome * num(j.allocationRatio)) / 100),
    currentAmount: Math.round(jarNet[j.id] ?? 0),
  }))

  // Budget planned vs actual cho từng line.
  let budgetView = null as null | {
    id: string
    name: string
    periodType: string
    startDate: Date
    endDate: Date | null
    expectedSharedIncome: number | null
    expectedSharedExpense: number | null
    lines: {
      id: string
      name: string
      categoryId: string | null
      jarId: string | null
      plannedAmount: number
      actualAmount: number
    }[]
  }
  if (budget) {
    const from = budget.startDate
    const to = budget.endDate ?? new Date()
    budgetView = {
      id: budget.id,
      name: budget.name,
      periodType: budget.periodType,
      startDate: budget.startDate,
      endDate: budget.endDate,
      expectedSharedIncome: budget.expectedSharedIncome ? num(budget.expectedSharedIncome) : null,
      expectedSharedExpense: budget.expectedSharedExpense ? num(budget.expectedSharedExpense) : null,
      lines: budget.lines.map((l) => {
        const actual = entries
          .filter(
            (e) =>
              OUTFLOW.includes(e.type) &&
              e.entryDate >= from &&
              e.entryDate <= to &&
              ((l.categoryId && e.categoryId === l.categoryId) || (l.jarId && e.jarId === l.jarId)),
          )
          .reduce((s, e) => s + num(e.amount), 0)
        return {
          id: l.id,
          name: l.name,
          categoryId: l.categoryId,
          jarId: l.jarId,
          plannedAmount: num(l.plannedAmount),
          actualAmount: Math.round(actual),
        }
      }),
    }
  }

  return {
    ledger: { id: ledger.id, name: ledger.name, balance: Math.round(balance), currency: ledger.currency },
    totals: { inflow: Math.round(inflow), outflow: Math.round(outflow), monthIncome: Math.round(monthIncome), monthExpense: Math.round(monthExpense) },
    model: model ? { id: model.id, name: model.name, type: model.type } : null,
    jars,
    budget: budgetView,
    recentEntries: entries.slice(0, 20).map((e) => ({
      id: e.id,
      type: e.type,
      amount: num(e.amount),
      title: e.title,
      essentialType: e.essentialType,
      entryDate: e.entryDate,
      category: e.category,
      jar: e.jar,
      recordedBy: e.recordedBy?.displayName ?? e.recordedBy?.user?.displayName ?? null,
    })),
  }
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
