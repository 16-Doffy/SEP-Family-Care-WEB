/**
 * @module recurring-task.controller
 * @description HTTP handlers cho nhiệm vụ định kỳ (Core flow 2).
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as svc from '../services/recurring-task.service'

const access = (req: Request) => ({
  role: req.user.role,
  familyMemberId: req.user.familyMemberId,
})

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await svc.listTemplates(req.user.familyId!)
    res.json(list)
  } catch (e) {
    next(e)
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        reward: z.number().min(0).optional(),
        rrule: z.string().min(1).max(200),
        timeOfDay: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        defaultAssigneeId: z.string().optional(),
      })
      .parse(req.body)
    const t = await svc.createTemplate(req.user.familyId!, req.user.familyMemberId!, data)
    res.status(201).json(t)
  } catch (e) {
    next(e)
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        reward: z.number().min(0).optional(),
        rrule: z.string().min(1).max(200).optional(),
        timeOfDay: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        defaultAssigneeId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body)
    const t = await svc.updateTemplate(req.params.id, req.user.familyId!, data)
    res.json(t)
  } catch (e) {
    next(e)
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await svc.deactivateTemplate(req.params.id, req.user.familyId!)
    res.json(t)
  } catch (e) {
    next(e)
  }
}

export async function requestLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await svc.requestLeave(req.params.id, req.user.familyId!, access(req))
    res.json(t)
  } catch (e) {
    next(e)
  }
}

export async function claimTask(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await svc.claimTask(req.params.id, req.user.familyId!, access(req))
    res.json(t)
  } catch (e) {
    next(e)
  }
}

export async function reassignByParent(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({ assignedToId: z.string() }).parse(req.body)
    const t = await svc.reassignByParent(req.params.id, req.user.familyId!, body.assignedToId)
    res.json(t)
  } catch (e) {
    next(e)
  }
}

/** Debug endpoint — sinh instance hôm nay cho family. PARENT-only. */
export async function generateToday(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await svc.generateInstancesForFamily(req.user.familyId!, new Date())
    res.json({ created: created.length, tasks: created })
  } catch (e) {
    next(e)
  }
}
