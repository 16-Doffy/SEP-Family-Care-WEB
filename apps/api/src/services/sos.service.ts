import { prisma } from '../config/database'

interface CreateSOSInput {
  familyId: string
  senderId: string
  latitude?: number
  longitude?: number
  address?: string
  message?: string
}

export async function createSOSAlert(input: CreateSOSInput) {
  return prisma.sosAlert.create({
    data: {
      familyId: input.familyId,
      senderId: input.senderId,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      message: input.message,
      status: 'ACTIVE',
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  })
}

export async function getFamilySOSAlerts(familyId: string) {
  return prisma.sosAlert.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
  })
}

export async function getActiveSOSAlerts(familyId: string) {
  return prisma.sosAlert.findMany({
    where: { familyId, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
  })
}

export async function updateSOSStatus(
  id: string,
  familyId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM',
  resolvedById?: string,
) {
  return prisma.sosAlert.update({
    where: { id, familyId },
    data: {
      status,
      resolvedById: status === 'RESOLVED' || status === 'FALSE_ALARM' ? resolvedById : undefined,
      resolvedAt: status === 'RESOLVED' || status === 'FALSE_ALARM' ? new Date() : undefined,
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
  })
}

export async function getFamilyMemberUserIds(familyId: string, excludeUserId: string) {
  const members = await prisma.familyMember.findMany({
    where: { familyId, userId: { not: excludeUserId } },
    select: { userId: true },
  })
  return members.map((m) => m.userId)
}
