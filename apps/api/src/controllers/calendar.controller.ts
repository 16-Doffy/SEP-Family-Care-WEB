import type { Request, Response, NextFunction } from 'express'
import * as calendarService from '../services/calendar.service'
import { z } from 'zod'

export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await calendarService.getEvents(req.user.familyId!, req.query.month as string | undefined)
    res.json(events)
  } catch (e) { next(e) }
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
    }).parse(req.body)

    const event = await calendarService.createEvent(req.user.familyId!, req.user.familyMemberId!, data)
    res.status(201).json(event)
  } catch (e) { next(e) }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
    }).parse(req.body)

    const event = await calendarService.updateEvent(req.params.id, req.user.familyId!, data)
    res.json(event)
  } catch (e) { next(e) }
}

export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  try {
    await calendarService.deleteEvent(req.params.id, req.user.familyId!)
    res.json({ message: 'Deleted' })
  } catch (e) { next(e) }
}
