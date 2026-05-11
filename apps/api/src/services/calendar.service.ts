import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

export async function getEvents(familyId: string, month?: string) {
  const now = month ? new Date(month) : new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0) // 2 months ahead for visibility

  return prisma.familyEvent.findMany({
    where: {
      familyId,
      startDate: { gte: start, lte: end },
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
  })
}

export async function createEvent(
  familyId: string,
  createdById: string,
  data: {
    title: string
    description?: string
    startDate: string
    endDate?: string
    allDay?: boolean
    color?: string
  },
) {
  return prisma.familyEvent.create({
    data: {
      familyId,
      createdById,
      title: data.title,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      allDay: data.allDay ?? false,
      color: data.color ?? '#3b82f6',
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
  })
}

export async function updateEvent(
  eventId: string,
  familyId: string,
  data: { title?: string; description?: string; startDate?: string; endDate?: string; allDay?: boolean; color?: string },
) {
  const event = await prisma.familyEvent.findFirst({ where: { id: eventId, familyId } })
  if (!event) throw Errors.NotFound('Event')

  return prisma.familyEvent.update({
    where: { id: eventId },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      ...(data.startDate && { reminderSent: false }),
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
  })
}

export async function deleteEvent(eventId: string, familyId: string) {
  const event = await prisma.familyEvent.findFirst({ where: { id: eventId, familyId } })
  if (!event) throw Errors.NotFound('Event')
  await prisma.familyEvent.delete({ where: { id: eventId } })
}
