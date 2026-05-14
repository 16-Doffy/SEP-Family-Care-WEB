/**
 * @module sos.controller
 * @description Xử lý các HTTP request liên quan đến hệ thống cảnh báo khẩn cấp SOS.
 *
 * Luồng kích hoạt SOS (createSOSAlert):
 *  1. Người dùng gửi POST request với thông tin vị trí (tùy chọn)
 *  2. Controller lưu SOS alert vào DB với trạng thái ACTIVE
 *  3. Phát sự kiện `sos:new` qua Socket.IO đến phòng `family:{id}` để cập nhật real-time
 *  4. Gửi push notification đến tất cả thành viên khác trong gia đình
 *
 * Luồng cập nhật trạng thái (updateSOSStatus):
 *  1. Thành viên gửi PATCH request với trạng thái mới
 *  2. Controller cập nhật DB
 *  3. Phát sự kiện `sos:update` qua Socket.IO để tất cả thành viên biết
 *
 * Lý do dùng cả Socket.IO và push notification:
 *  - Socket.IO: Cập nhật tức thì cho các client đang online (app đang mở)
 *  - Push notification: Đánh thức thiết bị của thành viên đang offline hoặc app đóng
 */

import type { Request, Response, NextFunction } from 'express'
import * as sosService from '../services/sos.service'
import * as notificationService from '../services/notification.service'
import { getIO } from '../config/socket'

/**
 * Kích hoạt một SOS alert khẩn cấp.
 * Gửi thông báo real-time qua Socket.IO VÀ push notification đến tất cả thành viên gia đình.
 *
 * @route POST /sos
 * @param req - Request body có thể có: `latitude`, `longitude`, `address`, `message`
 * @param res - HTTP 201 với JSON `{ alert }` chứa thông tin SOS vừa tạo
 * @param next - Middleware tiếp theo (error handler)
 */
export async function createSOSAlert(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { latitude, longitude, address, message } = req.body

    const alert = await sosService.createSOSAlert({
      familyId: req.user.familyId,
      senderId: req.user.userId,
      // Chuyển đổi sang Number vì dữ liệu từ body có thể là chuỗi
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      address,
      message,
    })

    // Phát sự kiện real-time đến toàn bộ gia đình để cập nhật ngay lập tức
    // Dùng try/catch riêng để lỗi socket không ngăn gửi push notification
    try {
      getIO().to(`family:${req.user.familyId}`).emit('sos:new', { alert })
    } catch {}

    // Lấy danh sách thành viên cần nhận thông báo (trừ người kích hoạt SOS)
    const memberUserIds = await sosService.getFamilyMemberUserIds(req.user.familyId, req.user.userId)

    // Tạo phần mô tả vị trí cho nội dung thông báo
    // Ưu tiên địa chỉ text hơn tọa độ số vì dễ đọc hơn
    const locationText = address
      ? ` Vị trí: ${address}.`
      : latitude
        ? ` Vị trí: ${latitude.toFixed(5)}, ${longitude?.toFixed(5)}.`
        : ''

    // Gửi push notification song song đến tất cả thành viên để tiết kiệm thời gian
    await Promise.all(
      memberUserIds.map((userId) =>
        notificationService.createNotification({
          userId,
          type: 'SOS',
          title: '🆘 SOS Khẩn cấp!',
          body: `${alert.sender.displayName} cần giúp đỡ ngay!${locationText}`,
          metadata: { sosAlertId: alert.id, senderId: req.user.userId },
        }),
      ),
    )

    res.status(201).json({ alert })
  } catch (e) { next(e) }
}

/**
 * Lấy toàn bộ lịch sử SOS alert của gia đình (bao gồm đã giải quyết).
 * Giới hạn 50 bản ghi mới nhất (xử lý bởi service).
 *
 * @route GET /sos
 * @param req - Request có `req.user.familyId`
 * @param res - JSON `{ alerts }` chứa danh sách alert
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getSOSAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const alerts = await sosService.getFamilySOSAlerts(req.user.familyId)
    res.json({ alerts })
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách SOS alert đang cần xử lý (ACTIVE hoặc ACKNOWLEDGED).
 * Dùng để hiển thị cảnh báo nổi bật trên giao diện của ứng dụng.
 *
 * @route GET /sos/active
 * @param req - Request có `req.user.familyId`
 * @param res - JSON `{ alerts }` chứa danh sách alert đang hoạt động
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getActiveSOSAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const alerts = await sosService.getActiveSOSAlerts(req.user.familyId)
    res.json({ alerts })
  } catch (e) { next(e) }
}

/**
 * Cập nhật trạng thái của một SOS alert.
 * Sau khi cập nhật DB, phát sự kiện `sos:update` qua Socket.IO để tất cả
 * thành viên đang online thấy thay đổi trạng thái ngay lập tức.
 *
 * @route PATCH /sos/:id
 * @param req - `params.id` là ID của alert; body cần có `status`
 * @param res - JSON `{ alert }` chứa alert sau khi cập nhật
 * @param next - Middleware tiếp theo (error handler)
 */
export async function updateSOSStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const { status } = req.body
    // Validate trạng thái hợp lệ trước khi gọi service để tránh lỗi DB không mong muốn
    if (!['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const alert = await sosService.updateSOSStatus(
      req.params.id,
      req.user.familyId,
      status,
      // Truyền userId của người đang thực hiện thao tác để ghi nhận người xử lý
      req.user.userId,
    )

    // Phát sự kiện cập nhật real-time đến tất cả thành viên gia đình đang online
    // Dùng try/catch riêng để lỗi socket không ảnh hưởng đến phản hồi HTTP
    try {
      getIO().to(`family:${req.user.familyId}`).emit('sos:update', { alert })
    } catch {}

    res.json({ alert })
  } catch (e) { next(e) }
}
