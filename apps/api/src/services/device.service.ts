/**
 * Device service — mô phỏng wearable/GPS device cho Family Care.
 * Module này bổ sung scope Review 1: SOS từ thiết bị đeo, ghi nhận lộ trình,
 * tracking di chuyển và phân tích thói quen di chuyển ở mức demo/MVP.
 */
import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

const db = prisma as any

type DeviceType = 'MOBILE_APP' | 'SMARTWATCH' | 'GPS_TRACKER' | 'BLE_DEVICE'
type DeviceStatus = 'PAIRED' | 'ACTIVE' | 'LOST' | 'DISABLED'
type RouteSource = 'MOBILE_APP' | 'WEARABLE' | 'GPS_DEVICE' | 'MOCK'

export async function listDevices(familyId: string) {
  return db.device.findMany({
    where: { familyId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      _count: { select: { routePoints: true, sosAlerts: true } },
    },
  })
}

async function assertOwnerInFamily(familyId: string, ownerUserId?: string | null) {
  if (!ownerUserId) return
  const member = await prisma.familyMember.findFirst({ where: { familyId, userId: ownerUserId } })
  if (!member) throw Errors.BadRequest('Owner must be a member of this family')
}

export async function pairDevice(input: {
  familyId: string
  name: string
  type: DeviceType
  deviceCode: string
  ownerUserId?: string | null
  sosEnabled?: boolean
  fallDetectionEnabled?: boolean
  locationTrackingEnabled?: boolean
}) {
  await assertOwnerInFamily(input.familyId, input.ownerUserId)
  return db.device.create({
    data: {
      familyId: input.familyId,
      name: input.name,
      type: input.type,
      deviceCode: input.deviceCode,
      ownerUserId: input.ownerUserId || null,
      status: 'PAIRED' as DeviceStatus,
      sosEnabled: input.sosEnabled ?? true,
      fallDetectionEnabled: input.fallDetectionEnabled ?? true,
      locationTrackingEnabled: input.locationTrackingEnabled ?? true,
      metadata: { pairedBy: 'Family Care Demo' },
    },
    include: { owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
  })
}

export async function updateDevice(
  id: string,
  familyId: string,
  input: Partial<{
    name: string
    ownerUserId: string | null
    status: DeviceStatus
    batteryLevel: number | null
    sosEnabled: boolean
    fallDetectionEnabled: boolean
    locationTrackingEnabled: boolean
  }>,
) {
  const existing = await db.device.findFirst({ where: { id, familyId } })
  if (!existing) throw Errors.NotFound('Device')
  if ('ownerUserId' in input) await assertOwnerInFamily(familyId, input.ownerUserId)
  return db.device.update({
    where: { id },
    data: input,
    include: { owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
  })
}

export async function recordRoutePoint(input: {
  deviceId: string
  familyId: string
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  source?: RouteSource
  recordedAt?: Date
  batteryLevel?: number
}) {
  const device = await db.device.findFirst({ where: { id: input.deviceId, familyId: input.familyId } })
  if (!device) throw Errors.NotFound('Device')
  if (!device.locationTrackingEnabled) throw Errors.BadRequest('Location tracking is disabled for this device')

  const point = await db.deviceRoutePoint.create({
    data: {
      familyId: input.familyId,
      deviceId: input.deviceId,
      userId: device.ownerUserId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      speed: input.speed,
      source: input.source ?? 'WEARABLE',
      recordedAt: input.recordedAt ?? new Date(),
    },
  })

  await db.device.update({
    where: { id: input.deviceId },
    data: {
      status: 'ACTIVE',
      batteryLevel: input.batteryLevel ?? device.batteryLevel,
      lastLatitude: input.latitude,
      lastLongitude: input.longitude,
      lastSeenAt: new Date(),
    },
  })

  // Đồng bộ sang LocationShare để bản đồ gia đình vẫn hiển thị vị trí mới nhất.
  if (device.ownerUserId) {
    await prisma.locationShare.upsert({
      where: { userId: device.ownerUserId },
      create: {
        userId: device.ownerUserId,
        familyId: input.familyId,
        isSharing: true,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
      },
      update: {
        isSharing: true,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
      },
    })
  }

  return point
}

export async function getDeviceRoutes(deviceId: string, familyId: string, query: { from?: Date; to?: Date; limit?: number }) {
  const device = await db.device.findFirst({ where: { id: deviceId, familyId } })
  if (!device) throw Errors.NotFound('Device')
  return db.deviceRoutePoint.findMany({
    where: {
      familyId,
      deviceId,
      ...(query.from || query.to
        ? { recordedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
        : {}),
    },
    orderBy: { recordedAt: 'desc' },
    take: Math.min(query.limit ?? 100, 500),
  })
}

export async function analyzeMovementHabit(deviceId: string, familyId: string, days = 7) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const points = await db.deviceRoutePoint.findMany({
    where: { familyId, deviceId, recordedAt: { gte: from } },
    orderBy: { recordedAt: 'asc' },
  })

  const byHour: Record<string, number> = {}
  for (const p of points) {
    const hour = new Date(p.recordedAt).getHours().toString().padStart(2, '0') + ':00'
    byHour[hour] = (byHour[hour] ?? 0) + 1
  }

  const activeHours = Object.entries(byHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => hour)

  return {
    days,
    totalPoints: points.length,
    activeHours,
    firstRecordedAt: points[0]?.recordedAt ?? null,
    lastRecordedAt: points.length ? points[points.length - 1].recordedAt : null,
    summary:
      points.length === 0
        ? 'Chưa có dữ liệu lộ trình để phân tích.'
        : `Thiết bị có ${points.length} điểm vị trí trong ${days} ngày gần đây. Khung giờ xuất hiện nhiều: ${activeHours.join(', ') || 'chưa đủ dữ liệu'}.`,
  }
}

export async function triggerDeviceSOS(input: {
  deviceId: string
  familyId: string
  latitude?: number
  longitude?: number
  message?: string
  fallDetected?: boolean
}) {
  const device = await db.device.findFirst({ where: { id: input.deviceId, familyId: input.familyId } })
  if (!device) throw Errors.NotFound('Device')
  if (!device.sosEnabled) throw Errors.BadRequest('SOS is disabled for this device')
  if (!device.ownerUserId) throw Errors.BadRequest('Device must be assigned to a family member before triggering SOS')

  const alert = await db.sosAlert.create({
    data: {
      familyId: input.familyId,
      senderId: device.ownerUserId,
      latitude: input.latitude,
      longitude: input.longitude,
      message: input.message ?? (input.fallDetected ? 'Fall detection signal from wearable device' : 'SOS trigger from wearable/GPS device'),
      source: device.type === 'MOBILE_APP' ? 'MOBILE_APP' : device.type === 'GPS_TRACKER' ? 'GPS_DEVICE' : 'WEARABLE',
      deviceId: input.deviceId,
      fallDetected: input.fallDetected ?? false,
      status: 'ACTIVE',
    },
    include: { sender: { select: { id: true, displayName: true, avatarUrl: true } }, device: true },
  })

  await db.device.update({
    where: { id: input.deviceId },
    data: {
      status: 'ACTIVE',
      lastLatitude: input.latitude ?? device.lastLatitude,
      lastLongitude: input.longitude ?? device.lastLongitude,
      lastSeenAt: new Date(),
    },
  })

  return alert
}
