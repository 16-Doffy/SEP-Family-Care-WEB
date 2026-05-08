import type { Request, Response, NextFunction } from 'express'
import * as familyService from '../services/family.service'
import { z } from 'zod'

export async function getFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const family = await familyService.getFamily(req.user.familyId!)
    res.json(family)
  } catch (e) {
    next(e)
  }
}

export async function updateFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.body)
    const family = await familyService.updateFamily(req.user.familyId!, name)
    res.json(family)
  } catch (e) {
    next(e)
  }
}

export async function generateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = z.object({ role: z.enum(['PARENT', 'CHILD']) }).parse(req.body)
    const code = await familyService.generateInviteCode(req.user.familyId!, role)
    res.json({ code, expiresIn: '7 days' })
  } catch (e) {
    next(e)
  }
}

export async function joinFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body)
    const member = await familyService.joinFamily(req.user.userId, code)
    res.json(member)
  } catch (e) {
    next(e)
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await familyService.removeMember(req.user.familyId!, req.params.userId, req.user.userId)
    res.json({ message: 'Member removed' })
  } catch (e) {
    next(e)
  }
}
