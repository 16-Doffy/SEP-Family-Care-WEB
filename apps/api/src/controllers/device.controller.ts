/** Controller cho Wearable/GPS Device module. */
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as deviceService from '../services/device.service'
import * as sosService from '../services/sos.service'
import * as notificationService from '../services/notification.service'
import { getIO } from '../config/socket'

const deviceType = z.enum(['MOBILE_APP', 'SMARTWATCH', 'GPS_TRACKER', 'BLE_DEVICE'])
const deviceStatus = z.enum(['PAIRED', 'ACTIVE', 'LOST', 'DISABLED'])
const routeSource = z.enum(['MOBILE_APP', 'WEARABLE', 'GPS_DEVICE', 'MOCK'])

export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const devices = await deviceService.listDevices(req.user.familyId!)
    res.json({ devices })
  } catch (e) { next(e) }
}

export async function pairDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      name: z.string().min(1).max(100),
      type: deviceType.default('SMARTWATCH'),
      deviceCode: z.string().min(3).max(100),
      ownerUserId: z.string().nullable().optional(),
      sosEnabled: z.boolean().optional(),
      fallDetectionEnabled: z.boolean().optional(),
      locationTrackingEnabled: z.boolean().optional(),
    }).parse(req.body)
    const device = await deviceService.pairDevice({ familyId: req.user.familyId!, ...body })
    res.status(201).json({ device })
  } catch (e) { next(e) }
}

export async function updateDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      ownerUserId: z.string().nullable().optional(),
      status: deviceStatus.optional(),
      batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
      sosEnabled: z.boolean().optional(),
      fallDetectionEnabled: z.boolean().optional(),
      locationTrackingEnabled: z.boolean().optional(),
    }).parse(req.body)
    const device = await deviceService.updateDevice(req.params.id, req.user.familyId!, body)
    res.json({ device })
  } catch (e) { next(e) }
}

export async function recordRoutePoint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().nonnegative().optional(),
      speed: z.number().optional(),
      source: routeSource.optional(),
      recordedAt: z.string().datetime().optional(),
      batteryLevel: z.number().int().min(0).max(100).optional(),
    }).parse(req.body)
    const point = await deviceService.recordRoutePoint({
      deviceId: req.params.id,
      familyId: req.user.familyId!,
      ...body,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
    })
    try { getIO().to(`family:${req.user.familyId}`).emit('device:location', { point }) } catch {}
    res.status(201).json({ point })
  } catch (e) { next(e) }
}

export async function getRoutes(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, limit } = z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    }).parse(req.query)
    const points = await deviceService.getDeviceRoutes(req.params.id, req.user.familyId!, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit,
    })
    res.json({ points })
  } catch (e) { next(e) }
}

export async function analyzeHabit(req: Request, res: Response, next: NextFunction) {
  try {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).optional() }).parse(req.query)
    const analysis = await deviceService.analyzeMovementHabit(req.params.id, req.user.familyId!, days ?? 7)
    res.json({ analysis })
  } catch (e) { next(e) }
}

export async function triggerSOS(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      message: z.string().max(300).optional(),
      fallDetected: z.boolean().optional(),
    }).parse(req.body)
    const alert = await deviceService.triggerDeviceSOS({ deviceId: req.params.id, familyId: req.user.familyId!, ...body })
    try { getIO().to(`family:${req.user.familyId}`).emit('sos:new', { alert }) } catch {}

    const memberUserIds = await sosService.getFamilyMemberUserIds(req.user.familyId!, alert.senderId)
    await Promise.all(memberUserIds.map((userId) => notificationService.createNotification({
      userId,
      type: 'SOS',
      title: alert.fallDetected ? '🆘 Phát hiện té ngã!' : '🆘 SOS từ thiết bị!',
      body: `${alert.sender.displayName} cần hỗ trợ. Nguồn: ${alert.source}.`,
      metadata: { sosAlertId: alert.id, deviceId: req.params.id, source: alert.source },
    })))

    res.status(201).json({ alert })
  } catch (e) { next(e) }
}
