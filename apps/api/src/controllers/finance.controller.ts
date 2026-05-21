/**
 * @module finance.controller
 * @description HTTP handlers cho core flow tài chính gia đình.
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as finance from '../services/finance.service'
import * as predict from '../services/finance-predict.service'

const access = (req: Request) => ({
  role: req.user.role,
  familyMemberId: req.user.familyMemberId,
})

const incomeSourceTypes = z.enum([
  'SALARY',
  'BUSINESS',
  'INVESTMENT',
  'ALLOWANCE',
  'RENTAL',
  'FREELANCE',
  'OTHER',
])

// ─── Income sources ──────────────────────────────────────────────────────────

export async function listIncomeSources(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await finance.listIncomeSources(req.params.memberId, req.user.familyId!)
    res.json(list)
  } catch (e) {
    next(e)
  }
}

export async function createIncomeSource(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        label: z.string().min(1).max(120),
        sourceType: incomeSourceTypes.optional(),
        amountPerMonth: z.number().min(0),
        isActive: z.boolean().optional(),
      })
      .parse(req.body)
    const created = await finance.createIncomeSource(
      req.params.memberId,
      req.user.familyId!,
      data,
      access(req),
    )
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
}

export async function updateIncomeSource(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        label: z.string().min(1).max(120).optional(),
        sourceType: incomeSourceTypes.optional(),
        amountPerMonth: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body)
    const updated = await finance.updateIncomeSource(req.params.id, req.user.familyId!, data, access(req))
    res.json(updated)
  } catch (e) {
    next(e)
  }
}

export async function deleteIncomeSource(req: Request, res: Response, next: NextFunction) {
  try {
    await finance.deleteIncomeSource(req.params.id, req.user.familyId!, access(req))
    res.status(204).end()
  } catch (e) {
    next(e)
  }
}

// ─── Member budget ───────────────────────────────────────────────────────────

export async function updateMemberBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        occupation: z.string().max(120).optional(),
        plannedPersonalExpense: z.number().min(0).optional(),
        personalSpendingLimit: z.number().min(0).nullable().optional(),
      })
      .parse(req.body)
    const updated = await finance.updateMemberBudget(
      req.params.memberId,
      req.user.familyId!,
      data,
      access(req),
    )
    res.json(updated)
  } catch (e) {
    next(e)
  }
}

// ─── Family budget ───────────────────────────────────────────────────────────

export async function getBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const { year, month } = z
      .object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) })
      .parse(req.query)
    const b = await finance.getFamilyBudget(req.user.familyId!, year, month)
    res.json(b)
  } catch (e) {
    next(e)
  }
}

export async function upsertBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        notes: z.string().optional(),
        categories: z
          .array(z.object({ name: z.string().min(1).max(60), amount: z.number().min(0) }))
          .max(20),
      })
      .parse(req.body)
    const result = await finance.upsertFamilyBudget(req.user.familyId!, body.year, body.month, {
      notes: body.notes,
      categories: body.categories,
    })
    res.json(result)
  } catch (e) {
    next(e)
  }
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function createPersonalExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        memberId: z.string().optional(),
        amount: z.number().min(0),
        category: z.string().min(1).max(60),
        note: z.string().max(500).optional(),
        occurredAt: z.string().optional(),
        deductFromWallet: z.boolean().optional(),
      })
      .parse(req.body)
    const memberId = body.memberId ?? req.user.familyMemberId!
    const created = await finance.createPersonalExpense(
      memberId,
      req.user.familyId!,
      {
        amount: body.amount,
        category: body.category,
        note: body.note,
        occurredAt: body.occurredAt,
        deductFromWallet: body.deductFromWallet,
      },
      access(req),
    )
    // Bắn cảnh báo nếu vừa vượt limit
    await predict.maybeWarnOverspend(memberId, req.user.familyId!)
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
}

export async function listPersonalExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    // FAMILY_MEMBER chỉ thấy của mình; PARENT thấy tất cả hoặc filter theo memberId
    const queryMemberId = req.query.memberId as string | undefined
    const isParent = req.user.role === 'PARENT' || req.user.role === 'SUPER_ADMIN'
    const memberId = isParent ? queryMemberId : req.user.familyMemberId
    const from = req.query.from ? new Date(String(req.query.from)) : undefined
    const to = req.query.to ? new Date(String(req.query.to)) : undefined
    const list = await finance.listPersonalExpenses(req.user.familyId!, { memberId, from, to, take: 100 })
    res.json(list)
  } catch (e) {
    next(e)
  }
}

export async function createFamilyExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        amount: z.number().min(0),
        category: z.string().min(1).max(60),
        note: z.string().max(500).optional(),
        paidById: z.string().optional(),
        occurredAt: z.string().optional(),
        deductFromWallet: z.boolean().optional(),
      })
      .parse(req.body)
    const created = await finance.createFamilyExpense(req.user.familyId!, body)
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
}

export async function listFamilyExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined
    const to = req.query.to ? new Date(String(req.query.to)) : undefined
    const list = await finance.listFamilyExpenses(req.user.familyId!, { from, to, take: 100 })
    res.json(list)
  } catch (e) {
    next(e)
  }
}

// ─── ActualIncome ────────────────────────────────────────────────────────────

export async function createActualIncome(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        memberId: z.string().optional(),
        amount: z.number().min(0),
        sourceType: incomeSourceTypes.optional(),
        note: z.string().max(500).optional(),
        occurredAt: z.string().optional(),
        creditToWallet: z.boolean().optional(),
      })
      .parse(req.body)
    const memberId = body.memberId ?? req.user.familyMemberId!
    const created = await finance.createActualIncome(
      memberId,
      req.user.familyId!,
      {
        amount: body.amount,
        sourceType: body.sourceType,
        note: body.note,
        occurredAt: body.occurredAt,
        creditToWallet: body.creditToWallet,
      },
      access(req),
    )
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
}

export async function listActualIncomes(req: Request, res: Response, next: NextFunction) {
  try {
    const queryMemberId = req.query.memberId as string | undefined
    const isParent = req.user.role === 'PARENT' || req.user.role === 'SUPER_ADMIN'
    const memberId = isParent ? queryMemberId : req.user.familyMemberId
    const from = req.query.from ? new Date(String(req.query.from)) : undefined
    const to = req.query.to ? new Date(String(req.query.to)) : undefined
    const list = await finance.listActualIncomes(req.user.familyId!, { memberId, from, to, take: 100 })
    res.json(list)
  } catch (e) {
    next(e)
  }
}

// ─── Summary, prediction, warnings ───────────────────────────────────────────

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date()
    const year = Number(req.query.year ?? now.getFullYear())
    const month = Number(req.query.month ?? now.getMonth() + 1)
    const s = await finance.getMonthlySummary(req.user.familyId!, year, month)
    res.json(s)
  } catch (e) {
    next(e)
  }
}

export async function getPrediction(req: Request, res: Response, next: NextFunction) {
  try {
    const months = Math.min(12, Math.max(1, Number(req.query.months ?? 3)))
    const fc = await predict.forecast(req.user.familyId!, months)
    res.json(fc)
  } catch (e) {
    next(e)
  }
}

export async function getWarnings(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await predict.getActiveWarnings(req.user.familyId!)
    res.json(list)
  } catch (e) {
    next(e)
  }
}

export async function closeMonth(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date()
    const year = Number(req.body?.year ?? now.getFullYear())
    const month = Number(req.body?.month ?? now.getMonth() + 1)
    const snap = await finance.closeMonth(req.user.familyId!, year, month)
    res.json(snap)
  } catch (e) {
    next(e)
  }
}
