/**
 * @module calendar.controller
 * @description Xử lý các HTTP request liên quan đến lịch sự kiện gia đình.
 * Controller này validate dữ liệu đầu vào bằng Zod trước khi chuyển
 * xuống calendar.service để thực hiện các thao tác nghiệp vụ.
 *
 * Tất cả route yêu cầu người dùng đã xác thực và thuộc về một gia đình
 * (được đảm bảo bởi middleware authenticate + requireFamily ở tầng route).
 */

import type { Request, Response, NextFunction } from 'express'
import * as calendarService from '../services/calendar.service'
import { z } from 'zod'

/**
 * Lấy danh sách sự kiện lịch của gia đình trong một tháng cụ thể.
 * Mặc định trả về sự kiện của tháng hiện tại và tháng tiếp theo.
 *
 * @route GET /calendar
 * @param req - Request có thể có query param `month` (ví dụ: "2024-03-01")
 * @param res - JSON array các sự kiện trong khoảng thời gian
 * @param next - Middleware tiếp theo (error handler)
 */
export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await calendarService.getEvents(req.user.familyId!, req.query.month as string | undefined)
    res.json(events)
  } catch (e) { next(e) }
}

/**
 * Tạo sự kiện mới trong lịch gia đình.
 * Validate dữ liệu đầu vào: tiêu đề bắt buộc (1-200 ký tự), startDate bắt buộc.
 *
 * @route POST /calendar
 * @param req - Request body cần có `title`, `startDate`; các trường khác là tùy chọn
 * @param res - HTTP 201 với JSON của sự kiện vừa tạo
 * @param next - Middleware tiếp theo (error handler)
 */
export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate và parse dữ liệu đầu vào - Zod sẽ ném ZodError nếu không hợp lệ
    const data = z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
      isRecurring: z.boolean().optional(),
    }).parse(req.body)

    // familyMemberId là ID của FamilyMember record (khác với userId)
    // dùng để xác định người tạo sự kiện trong ngữ cảnh gia đình
    const event = await calendarService.createEvent(req.user.familyId!, req.user.familyMemberId!, data)
    res.status(201).json(event)
  } catch (e) { next(e) }
}

/** Bật/tắt reminder của chính member đang đăng nhập cho một event. */
export async function setReminder(req: Request, res: Response, next: NextFunction) {
  try {
    const { reminderEnabled } = z.object({ reminderEnabled: z.boolean() }).parse(req.body)
    const participant = await calendarService.setReminder(
      req.params.id,
      req.user.familyId!,
      req.user.familyMemberId!,
      reminderEnabled,
    )
    res.json(participant)
  } catch (e) { next(e) }
}

/**
 * Cập nhật một sự kiện lịch hiện có.
 * Hỗ trợ partial update: chỉ cần truyền các trường muốn thay đổi.
 * Lưu ý: nếu thay đổi `startDate`, hệ thống sẽ tự reset nhắc nhở.
 * Chỉ người tạo sự kiện hoặc PARENT / SUPER_ADMIN mới được cập nhật.
 *
 * @route PUT /calendar/:id
 * @param req - `params.id` là ID sự kiện; body chứa các trường cần cập nhật (đều tùy chọn)
 * @param res - JSON của sự kiện sau khi cập nhật
 * @param next - Middleware tiếp theo (error handler)
 */
export async function updateEvent(req: Request, res: Response, next: NextFunction) {
  try {
    // Tất cả các trường đều optional để hỗ trợ partial update
    const data = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
    }).parse(req.body)

    const event = await calendarService.updateEvent(
      req.params.id,
      req.user.familyId!,
      data,
      req.user.familyMemberId,
      req.user.role,
    )
    res.json(event)
  } catch (e) { next(e) }
}

/**
 * Xóa một sự kiện khỏi lịch gia đình.
 * Service sẽ kiểm tra sự kiện có thuộc về gia đình của người dùng không
 * trước khi xóa, đảm bảo không xóa sự kiện của gia đình khác.
 *
 * @route DELETE /calendar/:id
 * @param req - `params.id` là ID của sự kiện cần xóa
 * @param res - JSON `{ message: 'Deleted' }` xác nhận xóa thành công
 * @param next - Middleware tiếp theo (error handler)
 */
export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  try {
    await calendarService.deleteEvent(req.params.id, req.user.familyId!)
    res.json({ message: 'Deleted' })
  } catch (e) { next(e) }
}
