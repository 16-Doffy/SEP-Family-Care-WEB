import type { Request, Response, NextFunction } from 'express'
import * as taskService from '../services/task.service'
import { z } from 'zod'
import type { TaskStatus } from '@family-care/shared'

export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, assignedToId } = req.query
    const tasks = await taskService.getTasks(req.user.familyId!, {
      status: status as string | undefined,
      assignedToId: assignedToId as string | undefined,
    })
    res.json(tasks)
  } catch (e) { next(e) }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.getTask(req.params.id, req.user.familyId!)
    res.json(task)
  } catch (e) { next(e) }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      title: z.string().min(1).max(300),
      description: z.string().optional(),
      reward: z.number().min(0).optional(),
      dueDate: z.string().optional(),
      assignedToId: z.string().optional(),
    }).parse(req.body)

    const task = await taskService.createTask(req.user.familyId!, req.user.familyMemberId!, data)
    res.status(201).json(task)
  } catch (e) { next(e) }
}

export async function startTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'IN_PROGRESS', req.user.userId)
    res.json(task)
  } catch (e) { next(e) }
}

export async function submitProof(req: Request, res: Response, next: NextFunction) {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body)
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined
    const task = await taskService.submitProof(req.params.id, req.user.familyId!, req.user.userId, { imageUrl, note })
    res.json(task)
  } catch (e) { next(e) }
}

export async function approveTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'APPROVED', req.user.userId)
    res.json(task)
  } catch (e) { next(e) }
}

export async function rejectTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'REJECTED', req.user.userId)
    res.json(task)
  } catch (e) { next(e) }
}

export async function cancelTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.cancelTask(req.params.id, req.user.familyId!)
    res.json(task)
  } catch (e) { next(e) }
}

export async function assignTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { assignedToId } = z.object({ assignedToId: z.string() }).parse(req.body)
    const task = await taskService.updateTask(req.params.id, req.user.familyId!, { assignedToId })
    res.json(task)
  } catch (e) { next(e) }
}
