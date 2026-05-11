import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as locationService from '../services/location.service'
import { getIO } from '../config/socket'

export async function getFamilyLocations(req: Request, res: Response, next: NextFunction) {
  try {
    const shares = await locationService.getFamilyLocations(req.user.familyId!)
    res.json({ shares })
  } catch (e) { next(e) }
}

export async function getMyShare(req: Request, res: Response, next: NextFunction) {
  try {
    const share = await locationService.getMyShare(req.user.userId)
    res.json({ share })
  } catch (e) { next(e) }
}

const toggleSchema = z.object({ isSharing: z.boolean() })

export async function toggleSharing(req: Request, res: Response, next: NextFunction) {
  try {
    const { isSharing } = toggleSchema.parse(req.body)
    const share = await locationService.setSharing(req.user.userId, req.user.familyId!, isSharing)

    try {
      getIO().to(`family:${req.user.familyId}`).emit('location:update', { share })
    } catch {}

    res.json({ share })
  } catch (e) { next(e) }
}

const updateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
})

export async function updateLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body)
    const share = await locationService.updateLocation(req.user.userId, req.user.familyId!, data)

    try {
      getIO().to(`family:${req.user.familyId}`).emit('location:update', { share })
    } catch {}

    res.json({ share })
  } catch (e) { next(e) }
}
