/**
 * @file subscription-plan.controller.ts
 * @module controllers/subscription-plan
 *
 * Controller xử lý các HTTP request quản lý gói đăng ký (subscription plans).
 *
 * Các endpoint được expose:
 * - GET    /subscription-plans/           → Xem danh sách gói (public với auth)
 * - GET    /subscription-plans/:id        → Xem chi tiết một gói (admin)
 * - POST   /subscription-plans/           → Tạo gói mới (admin)
 * - PUT    /subscription-plans/:id        → Cập nhật gói (admin)
 * - DELETE /subscription-plans/:id        → Xóa gói (admin)
 * - PUT    /subscription-plans/:familyId/assign → Gán gói cho gia đình (admin)
 *
 * Lưu ý: Các route admin được bảo vệ bằng middleware ở tầng admin.routes.ts,
 * không phải tại đây.
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as planService from '../services/subscription-plan.service'

/**
 * Schema validate cho body tạo/cập nhật gói subscription.
 *
 * `code` phải là UPPER_SNAKE_CASE để nhất quán và dễ dùng trong enum.
 * `maxMembers` và `maxTasksPerMonth` cho phép `null` để biểu thị không giới hạn.
 * `features` là mảng chuỗi, mỗi chuỗi tối đa 200 ký tự.
 */
const planSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  billingPeriod: z.enum(['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME']).optional(),
  maxMembers: z.number().int().positive().nullable().optional(),
  maxTasksPerMonth: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().max(200)).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

/**
 * Lấy danh sách gói subscription.
 *
 * Query param `includeInactive=true` cho phép admin xem cả gói đang ẩn.
 * Mặc định chỉ trả về gói đang active (hiển thị trên trang pricing).
 *
 * @param req - Express Request (query: `includeInactive?`)
 * @param res - Express Response trả về `{ plans }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 */
export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true'
    const plans = await planService.listPlans(includeInactive)
    res.json({ plans })
  } catch (e) { next(e) }
}

/**
 * Lấy thông tin chi tiết một gói subscription theo ID.
 *
 * @param req - Express Request (params: `id`)
 * @param res - Express Response trả về `{ plan }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws NotFound nếu gói không tồn tại
 */
export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await planService.getPlan(req.params.id)
    res.json({ plan })
  } catch (e) { next(e) }
}

/**
 * Tạo mới một gói subscription.
 *
 * Validate đầy đủ body bằng `planSchema` (không partial).
 * Trả về `201 Created` khi tạo thành công.
 *
 * @param req - Express Request (body: PlanInput)
 * @param res - Express Response trả về `201` kèm `{ plan }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws ZodError nếu body không hợp lệ
 * @throws Conflict nếu `code` đã tồn tại
 */
export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = planSchema.parse(req.body)
    const plan = await planService.createPlan(data)
    res.status(201).json({ plan })
  } catch (e) { next(e) }
}

/**
 * Cập nhật thông tin một gói subscription (partial update).
 *
 * Dùng `planSchema.partial()` để cho phép chỉ truyền các trường cần thay đổi.
 *
 * @param req - Express Request (params: `id`, body: Partial<PlanInput>)
 * @param res - Express Response trả về `{ plan }` đã cập nhật
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws ZodError nếu body không hợp lệ
 * @throws NotFound nếu gói không tồn tại
 */
export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = planSchema.partial().parse(req.body)
    const plan = await planService.updatePlan(req.params.id, data)
    res.json({ plan })
  } catch (e) { next(e) }
}

/**
 * Xóa một gói subscription.
 *
 * Sẽ thất bại nếu còn gia đình đang dùng gói này.
 *
 * @param req - Express Request (params: `id`)
 * @param res - Express Response trả về `{ ok: true }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws BadRequest nếu gói đang được ít nhất một gia đình sử dụng
 */
export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    await planService.deletePlan(req.params.id)
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/**
 * Schema validate khi gán gói cho gia đình.
 * `planId` cho phép `null` để gỡ gói khỏi gia đình.
 */
const assignSchema = z.object({ planId: z.string().nullable() })

/**
 * Gán gói subscription cho một gia đình cụ thể (admin only).
 *
 * Đây là luồng admin để gán gói trực tiếp mà không qua thanh toán,
 * thường dùng để tặng gói, xử lý refund hoặc test.
 *
 * @param req - Express Request (params: `familyId`, body: `{ planId: string | null }`)
 * @param res - Express Response trả về `{ family }` kèm thông tin gói mới
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws ZodError nếu body không hợp lệ
 * @throws NotFound nếu gói không tồn tại
 */
export async function assignToFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId } = assignSchema.parse(req.body)
    const family = await planService.assignPlanToFamily(req.params.familyId, planId)
    res.json({ family })
  } catch (e) { next(e) }
}
