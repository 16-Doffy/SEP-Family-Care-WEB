import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

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
        subscriptionPlan: true,
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

async function getDirectoryStats(dir: string): Promise<{ files: number; bytes: number }> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    let files = 0
    let bytes = 0
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const child = await getDirectoryStats(fullPath)
        files += child.files
        bytes += child.bytes
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath)
        files += 1
        bytes += stat.size
      }
    }
    return { files, bytes }
  } catch {
    return { files: 0, bytes: 0 }
  }
}

export async function getSystemHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    let database = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'error'
    }

    const uploads = await getDirectoryStats(path.join(process.cwd(), 'uploads'))
    const memory = process.memoryUsage()

    res.json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      platform: `${os.type()} ${os.release()}`,
      uptimeSeconds: Math.round(process.uptime()),
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        systemFree: os.freemem(),
        systemTotal: os.totalmem(),
      },
      uploads,
      timestamp: new Date().toISOString(),
    })
  } catch (e) { next(e) }
}

export async function exportBackup(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      users,
      families,
      plans,
      wallets,
      transactions,
      tasks,
      events,
      sosAlerts,
      payments,
      albumPhotos,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          role: true, isActive: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.family.findMany({ include: { members: true } }),
      prisma.subscriptionPlan.findMany(),
      prisma.wallet.findMany(),
      prisma.transaction.findMany(),
      prisma.task.findMany({ include: { proofs: true } }),
      prisma.familyEvent.findMany(),
      prisma.sosAlert.findMany(),
      prisma.payment.findMany(),
      prisma.albumPhoto.findMany(),
    ])

    const filename = `family-care-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        users,
        families,
        plans,
        wallets,
        transactions,
        tasks,
        events,
        sosAlerts,
        payments,
        albumPhotos,
      },
    })
  } catch (e) { next(e) }
}
