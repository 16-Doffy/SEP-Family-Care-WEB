/**
 * @module finance-erd.controller
 * @description HTTP handlers cho finance theo ERD (ledger/jars/categories/
 * entries/budget). Mount dưới `/api/finance/erd`.
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as erd from '../services/finance-erd.service'

const access = (req: Request) => ({ role: req.user.role, familyMemberId: req.user.familyMemberId })

const ledgerEntryType = z.enum(['INCOME', 'EXPENSE', 'CONTRIBUTION', 'ALLOWANCE', 'REWARD', 'SUPPORT'])
const essentialType = z.enum(['ESSENTIAL', 'NON_ESSENTIAL', 'NA'])
const categoryType = z.enum(['INCOME', 'EXPENSE'])
const modelType = z.enum(['FIVE_JARS', 'EIGHTY_TWENTY', 'CUSTOM'])
const periodType = z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY'])

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await erd.getOverview(req.user.familyId!))
  } catch (e) {
    next(e)
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await erd.listCategories(req.user.familyId!))
  } catch (e) {
    next(e)
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        type: categoryType,
        defaultJarId: z.string().optional(),
        defaultEssentialType: essentialType.optional(),
      })
      .parse(req.body)
    res.status(201).json(await erd.createCategory(req.user.familyId!, body, access(req)))
  } catch (e) {
    next(e)
  }
}

export async function setupModel(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        type: modelType,
        name: z.string().max(120).optional(),
        jars: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              allocationRatio: z.number().min(0).max(100),
              purpose: z.string().max(200).optional(),
              color: z.string().max(20).optional(),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(req.body)
    res.status(201).json(await erd.setupModel(req.user.familyId!, req.user.familyMemberId, body, access(req)))
  } catch (e) {
    next(e)
  }
}

export async function listEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const take = Math.min(200, Math.max(1, Number(req.query.take ?? 50)))
    res.json(await erd.listEntries(req.user.familyId!, take))
  } catch (e) {
    next(e)
  }
}

export async function createEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        type: ledgerEntryType,
        amount: z.number().positive(),
        title: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        categoryId: z.string().optional(),
        jarId: z.string().optional(),
        essentialType: essentialType.optional(),
        occurredAt: z.string().optional(),
      })
      .parse(req.body)
    res.status(201).json(await erd.createEntry(req.user.familyId!, req.user.familyMemberId, body))
  } catch (e) {
    next(e)
  }
}

export async function createBudgetPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        periodType: periodType.optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        expectedSharedIncome: z.number().min(0).optional(),
        expectedSharedExpense: z.number().min(0).optional(),
        lines: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              categoryId: z.string().optional(),
              jarId: z.string().optional(),
              plannedAmount: z.number().min(0),
              essentialType: essentialType.optional(),
            }),
          )
          .max(30),
      })
      .parse(req.body)
    res.status(201).json(await erd.createBudgetPlan(req.user.familyId!, req.user.familyMemberId, body, access(req)))
  } catch (e) {
    next(e)
  }
}
