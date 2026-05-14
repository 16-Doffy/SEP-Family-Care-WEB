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
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

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
        // Chỉ lấy thành viên đầu tiên (người tạo gia đình) để hiển thị trên bảng quản lý
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
