/**
 * @module admin.controller
 * @description Controller dành riêng cho quản trị viên hệ thống (`SUPER_ADMIN`).
 * Cung cấp các endpoint để xem thống kê tổng quan, quản lý người dùng và gia đình,
 * kiểm tra sức khỏe hệ thống (system health), và xuất dữ liệu backup toàn bộ.
 *
 * Tất cả các route trong module này đều được bảo vệ bởi middleware `requireRole('SUPER_ADMIN')`.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import { z } from 'zod'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Lấy thống kê tổng quan của hệ thống: tổng số gia đình, người dùng, và người dùng đang hoạt động.
 * Dùng `Promise.all` để chạy các truy vấn song song, tối ưu thời gian phản hồi.
 *
 * @route GET /admin/stats
 * @param _req - Express Request (không dùng)
 * @param res - Express Response; trả về `{ totalFamilies, totalUsers, activeUsers }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    // Chạy song song để giảm thời gian chờ so với tuần tự
    const [totalFamilies, totalUsers, activeUsers] = await Promise.all([
      prisma.family.count(),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
    ])
    res.json({ totalFamilies, totalUsers, activeUsers })
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách tất cả gia đình trong hệ thống, kèm thông tin thành viên,
 * số lượng thành viên và gói đăng ký hiện tại.
 *
 * Chỉ lấy thành viên đầu tiên (theo thời gian tham gia) để hiển thị người tạo/chủ gia đình.
 *
 * @route GET /admin/families
 * @param _req - Express Request (không dùng)
 * @param res - Express Response; trả về mảng `Family[]` kèm thông tin đầy đủ
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getFamilies(_req: Request, res: Response, next: NextFunction) {
  try {
    const families = await prisma.family.findMany({
      include: {
        // Đếm tổng số thành viên mà không load toàn bộ dữ liệu
        _count: { select: { members: true } },
        subscriptionPlan: true,
        provision: true,
        // Ưu tiên chủ hộ, sau đó đến thành viên đầu tiên để hiển thị trên bảng quản lý
        members: {
          include: { user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } } },
          orderBy: [{ isOwner: 'desc' }, { joinedAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(families)
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách tất cả người dùng trong hệ thống với thông tin cần thiết cho quản trị.
 * Chỉ select các trường cần thiết (không lấy password hash hay thông tin nhạy cảm).
 *
 * @route GET /admin/users
 * @param _req - Express Request (không dùng)
 * @param res - Express Response; trả về mảng `User[]` với thông tin cơ bản và tên gia đình
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, displayName: true, role: true,
        isActive: true, createdAt: true,
        // Lấy tên gia đình để hiển thị trên bảng quản lý người dùng
        familyMember: { select: { family: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(users)
  } catch (e) { next(e) }
}

/**
 * Cập nhật thông tin người dùng (hiện chỉ hỗ trợ thay đổi trạng thái `isActive`).
 * Dùng để kích hoạt hoặc vô hiệu hóa tài khoản người dùng.
 *
 * Cú pháp `{ ...(isActive !== undefined && { isActive }) }` giúp bỏ qua trường
 * nếu không được truyền trong body, tránh ghi đè giá trị không mong muốn.
 *
 * @route PUT /admin/users/:id
 * @param req - Express Request; `req.params.id` là ID người dùng;
 *              body: `{ isActive?: boolean }`
 * @param res - Express Response; trả về `{ id, email, isActive }` đã cập nhật
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body as { isActive?: boolean }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      // Chỉ cập nhật isActive nếu được truyền vào, tránh vô tình reset các field khác
      data: { ...(isActive !== undefined && { isActive }) },
      select: { id: true, email: true, isActive: true },
    })
    res.json(user)
  } catch (e) { next(e) }
}

/**
 * Hàm nội bộ đệ quy để thống kê file trong một thư mục và các thư mục con.
 * Dùng cho endpoint health check để báo cáo dung lượng thư mục uploads.
 *
 * @param dir - Đường dẫn tuyệt đối tới thư mục cần thống kê
 * @returns `{ files: number, bytes: number }` - tổng số file và tổng dung lượng (bytes)
 *          Trả về `{ files: 0, bytes: 0 }` nếu thư mục không tồn tại hoặc gặp lỗi
 */
async function getDirectoryStats(dir: string): Promise<{ files: number; bytes: number }> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    let files = 0
    let bytes = 0
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Đệ quy vào thư mục con và cộng dồn kết quả
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
    // Thư mục không tồn tại hoặc không có quyền đọc — trả về 0 thay vì ném lỗi
    return { files: 0, bytes: 0 }
  }
}

/**
 * Kiểm tra sức khỏe hệ thống và trả về báo cáo đầy đủ về trạng thái các thành phần.
 *
 * Bao gồm:
 * - Kết nối database (ping `SELECT 1`)
 * - Biến môi trường, nền tảng OS và thời gian hoạt động (uptime)
 * - Thông tin CPU: số core và load average
 * - Thông tin bộ nhớ: RSS, heap, RAM hệ thống
 * - Thống kê thư mục uploads (số file, dung lượng)
 * - Thời điểm kiểm tra (timestamp ISO)
 *
 * `status` là `'ok'` khi database hoạt động bình thường, `'degraded'` khi có sự cố.
 *
 * @route GET /admin/system/health
 * @param _req - Express Request (không dùng)
 * @param res - Express Response; trả về object health report đầy đủ
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getSystemHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    let database = 'ok'
    try {
      // Ping đơn giản để kiểm tra kết nối database có hoạt động không
      await prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'error'
    }

    const uploads = await getDirectoryStats(path.join(process.cwd(), 'uploads'))
    const memory = process.memoryUsage()

    res.json({
      // 'degraded' thay vì 'error' vì server vẫn chạy được dù database có vấn đề
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      platform: `${os.type()} ${os.release()}`,
      uptimeSeconds: Math.round(process.uptime()),
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg(), // Mảng [1 phút, 5 phút, 15 phút]
      },
      memory: {
        rss: memory.rss,           // Tổng bộ nhớ process đang chiếm (bytes)
        heapUsed: memory.heapUsed, // Heap V8 đang dùng (bytes)
        heapTotal: memory.heapTotal,
        systemFree: os.freemem(),  // RAM hệ thống còn trống (bytes)
        systemTotal: os.totalmem(),
      },
      uploads,
      timestamp: new Date().toISOString(),
    })
  } catch (e) { next(e) }
}

/**
 * Xuất toàn bộ dữ liệu hệ thống dưới dạng file JSON để backup.
 * Trả về file có tên dạng `family-care-backup-YYYY-MM-DD.json` với header
 * `Content-Disposition: attachment` để browser tự động tải xuống.
 *
 * Dữ liệu được tải song song từ tất cả các bảng chính để tối ưu tốc độ.
 *
 * Cảnh báo: Endpoint này tải toàn bộ dữ liệu vào bộ nhớ trước khi gửi,
 * nên có thể gây áp lực RAM lớn nếu database có nhiều dữ liệu.
 * Chỉ dành cho admin và nên dùng ở môi trường bảo mật.
 *
 * @route GET /admin/backup/export
 * @param _req - Express Request (không dùng)
 * @param res - Express Response; trả về JSON file đính kèm (attachment)
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function exportBackup(_req: Request, res: Response, next: NextFunction) {
  try {
    // Tải song song từ tất cả bảng để giảm thời gian chờ
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
          // Không export password hash vì lý do bảo mật
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

    // Tên file kèm ngày xuất để dễ nhận biết khi lưu trữ
    const filename = `family-care-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json({
      exportedAt: new Date().toISOString(),
      version: 1, // Phiên bản schema backup để hỗ trợ migration sau này nếu cần
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

/**
 * Gia hạn subscription cho một gia đình (FE-33).
 * Admin có thể gia hạn thêm N tháng cho gia đình, kể cả khi subscription đã EXPIRED.
 *
 * @route POST /admin/families/:familyId/renew
 * @param req - body: `{ months: number }` (mặc định 1)
 */
export async function renewSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { months } = z.object({ months: z.number().int().min(1).max(24).default(1) }).parse(req.body)
    const { familyId } = req.params

    const family = await prisma.family.findUnique({ where: { id: familyId } })
    if (!family) {
      res.status(404).json({ error: 'Family not found' })
      return
    }

    // Nếu subscription đã hết hạn, tính từ hiện tại; nếu còn hiệu lực thì cộng thêm
    const base = family.subscriptionExpiresAt && family.subscriptionExpiresAt > new Date()
      ? family.subscriptionExpiresAt
      : new Date()

    const newExpiresAt = new Date(base)
    newExpiresAt.setMonth(newExpiresAt.getMonth() + months)

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: newExpiresAt,
      },
      select: { id: true, name: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    })

    res.json(updated)
  } catch (e) { next(e) }
}

const familyStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']),
  reason: z.string().max(500).optional().nullable(),
})

export async function updateFamilyStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, reason } = familyStatusSchema.parse(req.body)
    const family = await prisma.family.update({
      where: { id: req.params.familyId },
      data: {
        status,
        statusReason: reason ?? null,
        lockedAt: status === 'ACTIVE' ? null : new Date(),
      },
      select: { id: true, name: true, status: true, statusReason: true, lockedAt: true },
    })
    res.json(family)
  } catch (e) { next(e) }
}

export async function getFamilyOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await prisma.familyMember.findFirst({
      where: { familyId: req.params.familyId, isOwner: true },
      include: { user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } } },
      orderBy: { joinedAt: 'asc' },
    }) ?? await prisma.familyMember.findFirst({
      where: { familyId: req.params.familyId },
      include: { user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    if (!owner) {
      res.status(404).json({ error: 'Owner not found' })
      return
    }
    res.json({ owner })
  } catch (e) { next(e) }
}

const ownerSchema = z.object({ userId: z.string().min(1) })

export async function updateFamilyOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = ownerSchema.parse(req.body)
    const member = await prisma.familyMember.findFirst({
      where: { familyId: req.params.familyId, userId },
      include: { user: true },
    })
    if (!member) {
      res.status(404).json({ error: 'Family member not found' })
      return
    }

    const owner = await prisma.$transaction(async (tx) => {
      await tx.familyMember.updateMany({
        where: { familyId: req.params.familyId },
        data: { isOwner: false },
      })
      await tx.user.update({ where: { id: userId }, data: { role: 'PARENT' } })
      return tx.familyMember.update({
        where: { id: member.id },
        data: { isOwner: true },
        include: { user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } } },
      })
    })

    res.json({ owner })
  } catch (e) { next(e) }
}

const subscriptionSchema = z.object({
  planId: z.string().nullable().optional(),
  subscriptionStatus: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE']).optional(),
  subscriptionExpiresAt: z.string().datetime().nullable().optional(),
})

export async function updateFamilySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data = subscriptionSchema.parse(req.body)
    if (data.planId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } })
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' })
        return
      }
    }

    const family = await prisma.family.update({
      where: { id: req.params.familyId },
      data: {
        ...(data.planId !== undefined && { planId: data.planId }),
        ...(data.subscriptionStatus !== undefined && { subscriptionStatus: data.subscriptionStatus }),
        ...(data.subscriptionExpiresAt !== undefined && {
          subscriptionExpiresAt: data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null,
        }),
      },
      include: { subscriptionPlan: true },
    })
    res.json({ family })
  } catch (e) { next(e) }
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export async function exportRevenue(req: Request, res: Response, next: NextFunction) {
  try {
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined
    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCEEDED',
        ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      include: { family: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const rows = [
      ['paymentId', 'createdAt', 'familyId', 'familyName', 'type', 'amount', 'currency', 'provider', 'planId', 'description'],
      ...payments.map((p) => [
        p.id,
        p.createdAt.toISOString(),
        p.familyId,
        p.family.name,
        p.type,
        p.amount,
        p.currency,
        p.provider,
        p.planId ?? '',
        p.description ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(`\uFEFF${csv}`)
  } catch (e) { next(e) }
}

async function runDocker(args: string[], timeout = 8000) {
  try {
    const { stdout, stderr } = await execFileAsync('docker', args, { timeout, maxBuffer: 1024 * 1024 * 4 })
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as { message?: string; stdout?: string; stderr?: string }
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? 'Docker command failed' }
  }
}

function parseJsonLines(text: string) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line) } catch { return { raw: line } }
  })
}

export async function getDockerStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const [ps, stats, df] = await Promise.all([
      runDocker(['ps', '-a', '--format', '{{json .}}']),
      runDocker(['stats', '--no-stream', '--format', '{{json .}}']),
      runDocker(['system', 'df', '--format', '{{json .}}']),
    ])

    res.json({
      available: ps.ok,
      containers: ps.ok ? parseJsonLines(ps.stdout) : [],
      stats: stats.ok ? parseJsonLines(stats.stdout) : [],
      disk: df.ok ? parseJsonLines(df.stdout) : [],
      error: ps.ok ? null : ps.stderr,
      timestamp: new Date().toISOString(),
    })
  } catch (e) { next(e) }
}

export async function getContainerLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const container = req.params.container
    if (!/^[a-zA-Z0-9_.-]+$/.test(container)) {
      res.status(400).json({ error: 'Invalid container name' })
      return
    }
    const tail = Math.min(Math.max(Number(req.query.tail ?? 200), 1), 1000)
    const result = await runDocker(['logs', '--tail', String(tail), container], 10000)
    res.json({
      container,
      ok: result.ok,
      logs: `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`,
      timestamp: new Date().toISOString(),
    })
  } catch (e) { next(e) }
}

export async function exportFamilyBackup(req: Request, res: Response, next: NextFunction) {
  try {
    const familyId = req.params.familyId
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: { include: { user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } } } },
        subscriptionPlan: true,
        provision: true,
      },
    })
    if (!family) {
      res.status(404).json({ error: 'Family not found' })
      return
    }

    const wallets = await prisma.wallet.findMany({ where: { familyId } })
    const walletIds = wallets.map((w) => w.id)
    const tasks = await prisma.task.findMany({ where: { familyId }, include: { proofs: true } })
    const taskIds = tasks.map((t) => t.id)
    const [transactions, events, sosAlerts, moneyRequests, albumPhotos, payments, invites, announcements, locationShares] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [
            { fromWalletId: { in: walletIds } },
            { toWalletId: { in: walletIds } },
            { taskId: { in: taskIds } },
          ],
        },
      }),
      prisma.familyEvent.findMany({ where: { familyId } }),
      prisma.sosAlert.findMany({ where: { familyId } }),
      prisma.moneyRequest.findMany({ where: { familyId } }),
      prisma.albumPhoto.findMany({ where: { familyId } }),
      prisma.payment.findMany({ where: { familyId } }),
      prisma.familyInvite.findMany({ where: { familyId } }),
      prisma.announcement.findMany({ where: { familyId } }),
      prisma.locationShare.findMany({ where: { familyId } }),
    ])

    const filename = `family-${familyId}-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      scope: 'family',
      data: { family, wallets, transactions, tasks, events, sosAlerts, moneyRequests, albumPhotos, payments, invites, announcements, locationShares },
    })
  } catch (e) { next(e) }
}

function strip<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...row }
  keys.forEach((key) => delete copy[key])
  return copy
}

export async function restoreFamilyBackup(req: Request, res: Response, next: NextFunction) {
  try {
    const familyId = req.params.familyId
    const payload = (req.body?.data ?? req.body) as Record<string, any>
    if (!payload?.family) {
      res.status(400).json({ error: 'Invalid family backup payload' })
      return
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.family.findUnique({ where: { id: familyId } })
      if (!existing) throw new Error('Family not found')

      const walletIds = (await tx.wallet.findMany({ where: { familyId }, select: { id: true } })).map((w) => w.id)
      const taskIds = (await tx.task.findMany({ where: { familyId }, select: { id: true } })).map((t) => t.id)

      await tx.taskProof.deleteMany({ where: { taskId: { in: taskIds } } })
      await tx.transaction.deleteMany({
        where: { OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }, { taskId: { in: taskIds } }] },
      })
      await tx.announcement.deleteMany({ where: { familyId } })
      await tx.familyInvite.deleteMany({ where: { familyId } })
      await tx.albumPhoto.deleteMany({ where: { familyId } })
      await tx.payment.deleteMany({ where: { familyId } })
      await tx.locationShare.deleteMany({ where: { familyId } })
      await tx.moneyRequest.deleteMany({ where: { familyId } })
      await tx.sosAlert.deleteMany({ where: { familyId } })
      await tx.familyEvent.deleteMany({ where: { familyId } })
      await tx.task.deleteMany({ where: { familyId } })
      await tx.wallet.deleteMany({ where: { familyId } })

      await tx.family.update({
        where: { id: familyId },
        data: {
          name: payload.family.name,
          planId: payload.family.planId ?? null,
          status: payload.family.status ?? 'ACTIVE',
          statusReason: payload.family.statusReason ?? null,
          lockedAt: payload.family.lockedAt ? new Date(payload.family.lockedAt) : null,
          subscriptionStatus: payload.family.subscriptionStatus ?? 'ACTIVE',
          subscriptionExpiresAt: payload.family.subscriptionExpiresAt ? new Date(payload.family.subscriptionExpiresAt) : null,
        },
      })

      if (payload.wallets?.length) await tx.wallet.createMany({ data: payload.wallets.map((w: any) => ({ ...strip(w, ['family', 'owner', 'sentTransactions', 'receivedTransactions']), familyId })) })
      if (payload.transactions?.length) await tx.transaction.createMany({ data: payload.transactions.map((t: any) => strip(t, ['fromWallet', 'toWallet', 'task'])) })
      if (payload.tasks?.length) await tx.task.createMany({ data: payload.tasks.map((t: any) => ({ ...strip(t, ['family', 'createdBy', 'assignedTo', 'proofs', 'transactions']), familyId })) })
      const proofs = (payload.tasks ?? []).flatMap((t: any) => (t.proofs ?? []).map((p: any) => strip(p, ['task', 'submitter'])))
      if (proofs.length) await tx.taskProof.createMany({ data: proofs })
      if (payload.events?.length) await tx.familyEvent.createMany({ data: payload.events.map((e: any) => ({ ...strip(e, ['family', 'createdBy']), familyId })) })
      if (payload.sosAlerts?.length) await tx.sosAlert.createMany({ data: payload.sosAlerts.map((s: any) => ({ ...strip(s, ['family', 'sender', 'resolvedBy']), familyId })) })
      if (payload.moneyRequests?.length) await tx.moneyRequest.createMany({ data: payload.moneyRequests.map((m: any) => ({ ...strip(m, ['family', 'requester', 'resolvedBy']), familyId })) })
      if (payload.albumPhotos?.length) await tx.albumPhoto.createMany({ data: payload.albumPhotos.map((a: any) => ({ ...strip(a, ['family', 'uploader']), familyId })) })
      if (payload.payments?.length) await tx.payment.createMany({ data: payload.payments.map((p: any) => ({ ...strip(p, ['family']), familyId })) })
      if (payload.invites?.length) await tx.familyInvite.createMany({ data: payload.invites.map((i: any) => ({ ...strip(i, ['family']), familyId })) })
      if (payload.announcements?.length) await tx.announcement.createMany({ data: payload.announcements.map((a: any) => ({ ...strip(a, ['family', 'sender']), familyId })) })
      if (payload.locationShares?.length) await tx.locationShare.createMany({ data: payload.locationShares.map((l: any) => ({ ...strip(l, ['family', 'user']), familyId })) })
    })

    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function provisionFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const family = await prisma.family.findUnique({ where: { id: req.params.familyId } })
    if (!family) {
      res.status(404).json({ error: 'Family not found' })
      return
    }
    const containerName = `family-${family.id.slice(0, 8)}`
    const databaseName = `family_${family.id.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24)}`
    const provision = await prisma.familyProvision.upsert({
      where: { familyId: family.id },
      create: {
        familyId: family.id,
        status: 'READY',
        containerName,
        databaseName,
        imageTag: 'shared-runtime',
        metadata: { mode: 'shared-db', note: 'Provisioned manually by admin' },
        provisionedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'READY',
        containerName,
        databaseName,
        imageTag: 'shared-runtime',
        metadata: { mode: 'shared-db', note: 'Provisioned manually by admin' },
        provisionedAt: new Date(),
        lastError: null,
      },
    })
    res.json({ provision })
  } catch (e) { next(e) }
}
