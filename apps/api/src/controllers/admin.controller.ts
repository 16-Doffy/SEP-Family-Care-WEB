import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [totalFamilies, totalUsers, activeUsers] = await Promise.all([
      prisma.family.count(),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
    ])
    res.json({ totalFamilies, totalUsers, activeUsers })
  } catch (e) { next(e) }
}

export async function getFamilies(_req: Request, res: Response, next: NextFunction) {
  try {
    const families = await prisma.family.findMany({
      include: {
        _count: { select: { members: true } },
        members: {
          include: { user: { select: { email: true, role: true } } },
          take: 1,
          orderBy: { joinedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(families)
  } catch (e) { next(e) }
}

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, displayName: true, role: true,
        isActive: true, createdAt: true,
        familyMember: { select: { family: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(users)
  } catch (e) { next(e) }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body as { isActive?: boolean }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(isActive !== undefined && { isActive }) },
      select: { id: true, email: true, isActive: true },
    })
    res.json(user)
  } catch (e) { next(e) }
}
