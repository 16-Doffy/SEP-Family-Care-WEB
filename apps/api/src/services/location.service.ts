import { prisma } from '../config/database'

export async function getFamilyLocations(familyId: string) {
  return prisma.locationShare.findMany({
    where: { familyId, isSharing: true },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getMyShare(userId: string) {
  return prisma.locationShare.findUnique({ where: { userId } })
}

export async function setSharing(userId: string, familyId: string, isSharing: boolean) {
  return prisma.locationShare.upsert({
    where: { userId },
    create: { userId, familyId, isSharing },
    update: { isSharing, ...(isSharing ? {} : { latitude: null, longitude: null, accuracy: null }) },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  })
}

export async function updateLocation(
  userId: string,
  familyId: string,
  data: { latitude: number; longitude: number; accuracy?: number },
) {
  return prisma.locationShare.upsert({
    where: { userId },
    create: {
      userId,
      familyId,
      isSharing: true,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    update: {
      isSharing: true,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  })
}
