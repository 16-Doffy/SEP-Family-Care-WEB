import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as planService from '../services/subscription-plan.service'

const planSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  billingPeriod: z.enum(['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME']).optional(),
  maxMembers: z.number().int().positive().nullable().optional(),
  maxTasksPerMonth: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().max(200)).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true'
    const plans = await planService.listPlans(includeInactive)
    res.json({ plans })
  } catch (e) { next(e) }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await planService.getPlan(req.params.id)
    res.json({ plan })
  } catch (e) { next(e) }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = planSchema.parse(req.body)
    const plan = await planService.createPlan(data)
    res.status(201).json({ plan })
  } catch (e) { next(e) }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = planSchema.partial().parse(req.body)
    const plan = await planService.updatePlan(req.params.id, data)
    res.json({ plan })
  } catch (e) { next(e) }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    await planService.deletePlan(req.params.id)
    res.json({ ok: true })
  } catch (e) { next(e) }
}

const assignSchema = z.object({ planId: z.string().nullable() })

export async function assignToFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId } = assignSchema.parse(req.body)
    const family = await planService.assignPlanToFamily(req.params.familyId, planId)
    res.json({ family })
  } catch (e) { next(e) }
}
