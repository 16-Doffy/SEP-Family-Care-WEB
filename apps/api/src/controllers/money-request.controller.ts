/**
 * @module money-request.controller
 * @description Controller xử lý các yêu cầu HTTP liên quan đến tính năng xin tiền trong gia đình.
 * Thành viên có thể gửi yêu cầu xin tiền; phụ huynh có thể duyệt hoặc từ chối.
 *
 * Mỗi thao tác tạo/xử lý yêu cầu đều gửi thông báo (notification) tới người liên quan
 * và phát sự kiện realtime qua Socket.IO để cập nhật giao diện ngay lập tức.
 */

import type { Request, Response, NextFunction } from 'express'
import * as mrService from '../services/money-request.service'
import * as notificationService from '../services/notification.service'
import { prisma } from '../config/database'
import { getIO } from '../config/socket'

/**
 * Tạo một yêu cầu xin tiền mới và thông báo tới tất cả phụ huynh trong gia đình.
 *
 * Luồng xử lý:
 * 1. Kiểm tra người dùng có trong gia đình không.
 * 2. Validate số tiền hợp lệ.
 * 3. Tạo yêu cầu trong database.
 * 4. Gửi thông báo đến tất cả phụ huynh/admin (chạy song song với Promise.all).
 * 5. Phát sự kiện `money-request:new` qua Socket.IO tới toàn bộ gia đình.
 *
 * @route POST /money-requests
 * @param req - Express Request; body: `{ amount: number, reason?: string }`
 * @param res - Express Response; trả về `{ request: MoneyRequest }` với status 201
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function createMoneyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId || !req.user.familyMemberId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { amount, reason } = req.body
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Số tiền không hợp lệ' })
      return
    }

    const request = await mrService.createMoneyRequest({
      familyId: req.user.familyId,
      requesterId: req.user.familyMemberId,
      amount: Number(amount),
      reason,
    })

    // Lấy danh sách phụ huynh rồi gửi thông báo đồng thời (song song) để giảm thời gian chờ
    const parentUserIds = await mrService.getParentUserIds(req.user.familyId)
    const requesterName = request.requester.user.displayName

    await Promise.all(
      parentUserIds.map((userId) =>
        notificationService.createNotification({
          userId,
          type: 'MONEY_REQUEST',
          title: '💰 Yêu cầu xin tiền',
          body: `${requesterName} xin ${Number(amount).toLocaleString('vi-VN')}₫${reason ? ` – ${reason}` : ''}`,
          metadata: { moneyRequestId: request.id, requesterId: req.user.userId },
        }),
      ),
    )

    // Phát realtime để UI cập nhật ngay; bỏ qua lỗi socket
    try {
      getIO().to(`family:${req.user.familyId}`).emit('money-request:new', { request })
    } catch {}

    res.status(201).json({ request })
  } catch (e) { next(e) }
}

/**
 * Lấy toàn bộ lịch sử yêu cầu xin tiền của gia đình hiện tại.
 *
 * @route GET /money-requests
 * @param req - Express Request
 * @param res - Express Response; trả về `{ requests: MoneyRequest[] }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getMoneyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const requests = await mrService.getMoneyRequests(req.user.familyId)
    res.json({ requests })
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách các yêu cầu xin tiền đang chờ xử lý (PENDING).
 * Thường dùng cho giao diện phụ huynh để xem nhanh các yêu cầu cần duyệt.
 *
 * @route GET /money-requests/pending
 * @param req - Express Request
 * @param res - Express Response; trả về `{ requests: MoneyRequest[] }` chỉ gồm PENDING
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getPendingRequests(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const requests = await mrService.getPendingRequests(req.user.familyId)
    res.json({ requests })
  } catch (e) { next(e) }
}

/**
 * Xử lý (duyệt hoặc từ chối) một yêu cầu xin tiền.
 * Chỉ phụ huynh (`PARENT`) hoặc quản trị viên (`SUPER_ADMIN`) mới có quyền.
 *
 * Khi duyệt: tiền được chuyển tự động từ ví chung sang ví cá nhân của người yêu cầu.
 * Sau khi xử lý: gửi thông báo kết quả tới người yêu cầu và phát sự kiện realtime.
 *
 * @route PATCH /money-requests/:id
 * @param req - Express Request; `req.params.id` là ID yêu cầu;
 *              body: `{ status: 'APPROVED' | 'REJECTED', note?: string }`
 * @param res - Express Response; trả về `{ request: MoneyRequest }` đã cập nhật
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {BadRequestError} Nếu `status` không phải APPROVED hoặc REJECTED
 * @throws {NotFoundError} Nếu yêu cầu không tồn tại hoặc đã được xử lý
 * @throws {InsufficientFundsError} Nếu ví chung không đủ tiền (khi APPROVED)
 */
export async function resolveMoneyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId || !req.user.familyMemberId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { status, note } = req.body
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const resolved = await mrService.resolveMoneyRequest({
      id: req.params.id,
      familyId: req.user.familyId,
      status,
      resolvedById: req.user.familyMemberId,
      note,
    })

    // Gửi thông báo kết quả tới người đã gửi yêu cầu
    const requesterUserId = resolved.requester.user.id
    const resolverName = resolved.resolvedBy?.user.displayName ?? 'Phụ huynh'
    const isApproved = status === 'APPROVED'
    const amount = Number(resolved.amount).toLocaleString('vi-VN')

    await notificationService.createNotification({
      userId: requesterUserId,
      type: 'MONEY_RESOLVED',
      title: isApproved ? '✅ Yêu cầu được duyệt' : '❌ Yêu cầu bị từ chối',
      body: isApproved
        ? `${resolverName} đã duyệt ${amount}₫ vào ví của bạn`
        : `${resolverName} đã từ chối yêu cầu ${amount}₫${note ? ` – ${note}` : ''}`,
      metadata: { moneyRequestId: resolved.id },
    })

    // Phát cập nhật realtime cho toàn bộ gia đình (bao gồm cả người yêu cầu)
    try {
      getIO().to(`family:${req.user.familyId}`).emit('money-request:update', { request: resolved })
    } catch {}

    res.json({ request: resolved })
  } catch (e) { next(e) }
}
