/**
 * @module location.controller
 * @description Controller xử lý các yêu cầu HTTP liên quan đến chia sẻ vị trí GPS
 * giữa các thành viên trong gia đình. Sau mỗi thao tác ghi, sự kiện realtime
 * sẽ được phát qua Socket.IO tới phòng (room) của gia đình để cập nhật bản đồ
 * cho tất cả thành viên đang online.
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as locationService from '../services/location.service'
import { getIO } from '../config/socket'

/**
 * Lấy vị trí hiện tại của tất cả thành viên trong gia đình đang bật chia sẻ.
 *
 * @route GET /location/family
 * @param req - Express Request, yêu cầu `req.user.familyId` hợp lệ (middleware `requireFamily` đảm bảo)
 * @param res - Express Response, trả về `{ shares: LocationShare[] }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getFamilyLocations(req: Request, res: Response, next: NextFunction) {
  try {
    const shares = await locationService.getFamilyLocations(req.user.familyId!)
    res.json({ shares })
  } catch (e) { next(e) }
}

/**
 * Lấy trạng thái chia sẻ vị trí hiện tại của người dùng đang đăng nhập.
 *
 * @route GET /location/me
 * @param req - Express Request, yêu cầu `req.user.userId` hợp lệ
 * @param res - Express Response, trả về `{ share: LocationShare | null }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getMyShare(req: Request, res: Response, next: NextFunction) {
  try {
    const share = await locationService.getMyShare(req.user.userId)
    res.json({ share })
  } catch (e) { next(e) }
}

/**
 * Schema xác thực body khi bật/tắt chia sẻ vị trí.
 * Chỉ chấp nhận giá trị boolean cho trường `isSharing`.
 */
const toggleSchema = z.object({ isSharing: z.boolean() })

/**
 * Bật hoặc tắt tính năng chia sẻ vị trí của người dùng hiện tại.
 * Sau khi cập nhật database, phát sự kiện `location:update` qua Socket.IO
 * tới tất cả thành viên trong gia đình để đồng bộ giao diện bản đồ.
 *
 * @route PATCH /location/toggle
 * @param req - Express Request với body `{ isSharing: boolean }`
 * @param res - Express Response, trả về `{ share: LocationShare }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {ZodError} Nếu body không hợp lệ (isSharing không phải boolean)
 */
export async function toggleSharing(req: Request, res: Response, next: NextFunction) {
  try {
    const { isSharing } = toggleSchema.parse(req.body)
    const share = await locationService.setSharing(req.user.userId, req.user.familyId!, isSharing)

    // Phát sự kiện realtime để các thành viên khác cập nhật bản đồ ngay lập tức.
    // Dùng try/catch riêng để lỗi Socket.IO không ảnh hưởng tới phản hồi HTTP.
    try {
      getIO().to(`family:${req.user.familyId}`).emit('location:update', { share })
    } catch {}

    res.json({ share })
  } catch (e) { next(e) }
}

/**
 * Schema xác thực tọa độ GPS khi người dùng cập nhật vị trí.
 * - latitude: vĩ độ, hợp lệ trong khoảng [-90, 90]
 * - longitude: kinh độ, hợp lệ trong khoảng [-180, 180]
 * - accuracy: độ chính xác GPS (mét), không âm, tùy chọn
 */
const updateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
})

/**
 * Cập nhật tọa độ GPS mới nhất của người dùng và phát sự kiện realtime tới gia đình.
 * Gọi endpoint này định kỳ từ phía client (mobile app) để giữ vị trí luôn cập nhật
 * trên bản đồ của các thành viên khác.
 *
 * @route POST /location/update
 * @param req - Express Request với body chứa `{ latitude, longitude, accuracy? }`
 * @param res - Express Response, trả về `{ share: LocationShare }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {ZodError} Nếu tọa độ nằm ngoài khoảng hợp lệ hoặc thiếu trường bắt buộc
 */
export async function updateLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body)
    const share = await locationService.updateLocation(req.user.userId, req.user.familyId!, data)

    // Phát vị trí mới ngay lập tức qua Socket.IO để cập nhật bản đồ realtime.
    // Bỏ qua lỗi nếu Socket.IO chưa sẵn sàng (ví dụ: server khởi động chưa xong).
    try {
      getIO().to(`family:${req.user.familyId}`).emit('location:update', { share })
    } catch {}

    res.json({ share })
  } catch (e) { next(e) }
}
