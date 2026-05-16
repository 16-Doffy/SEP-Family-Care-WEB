/**
 * @module task.controller
 * @description Controller xử lý các HTTP request liên quan đến nhiệm vụ (task).
 *
 * Mỗi handler chịu trách nhiệm:
 *  1. Validate dữ liệu đầu vào bằng Zod schema.
 *  2. Gọi tầng service để thực thi nghiệp vụ.
 *  3. Trả về response JSON hoặc chuyển lỗi sang middleware xử lý lỗi toàn cục.
 *
 * Thông tin người dùng (userId, familyId, familyMemberId) được lấy từ `req.user`
 * — được gắn vào request bởi middleware `authenticate` + `requireFamily`.
 */

import type { Request, Response, NextFunction } from 'express'
import * as taskService from '../services/task.service'
import { z } from 'zod'
import type { TaskStatus } from '@family-care/shared'

/**
 * Lấy danh sách nhiệm vụ của gia đình, hỗ trợ lọc theo trạng thái và người được giao.
 *
 * @route GET /tasks?status=&assignedToId=
 * @param req - Express Request. Query params: `status` (tuỳ chọn), `assignedToId` (tuỳ chọn).
 * @param res - Express Response. Trả về mảng JSON các task.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, assignedToId } = req.query
    const tasks = await taskService.getTasks(req.user.familyId!, {
      status: status as string | undefined,
      assignedToId: assignedToId as string | undefined,
    }, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(tasks)
  } catch (e) { next(e) }
}

/**
 * Lấy thông tin chi tiết của một nhiệm vụ.
 *
 * @route GET /tasks/:id
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ.
 * @param res - Express Response. Trả về JSON thông tin task kèm proofs.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.getTask(req.params.id, req.user.familyId!, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Tạo một nhiệm vụ mới trong gia đình.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép tạo nhiệm vụ.
 *
 * @route POST /tasks
 * @param req - Express Request. Body: `{ title, description?, reward?, dueDate?, assignedToId? }`.
 * @param res - Express Response. Trả về task mới với HTTP 201 Created.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate: tiêu đề không được rỗng và không quá 300 ký tự; reward không âm
    const data = z.object({
      title: z.string().min(1).max(300),
      description: z.string().optional(),
      reward: z.number().min(0).optional(),
      dueDate: z.string().optional(),
      assignedToId: z.string().optional(),
    }).parse(req.body)

    // familyMemberId là ID của bản ghi FamilyMember (không phải userId) để gắn vào createdById
    const task = await taskService.createTask(req.user.familyId!, req.user.familyMemberId!, data)
    res.status(201).json(task)
  } catch (e) { next(e) }
}

/**
 * Bắt đầu thực hiện một nhiệm vụ: chuyển trạng thái từ PENDING sang IN_PROGRESS.
 * Thường do thành viên được giao việc tự thực hiện.
 *
 * @route PATCH /tasks/:id/start
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ.
 * @param res - Express Response. Trả về task sau khi cập nhật trạng thái.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function startTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'IN_PROGRESS', req.user.userId, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Nộp bằng chứng hoàn thành nhiệm vụ.
 * Chấp nhận file ảnh upload (field name: `image`) và/hoặc ghi chú văn bản.
 * Nhiệm vụ sẽ tự động chuyển sang trạng thái SUBMITTED sau khi nộp.
 *
 * @route POST /tasks/:id/proof
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ; Body: `{ note? }`; File: `req.file`.
 * @param res - Express Response. Trả về task sau khi chuyển sang SUBMITTED.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function submitProof(req: Request, res: Response, next: NextFunction) {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body)
    // Nếu có file được upload, tạo đường dẫn tương đối để lưu vào database
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined
    const task = await taskService.submitProof(req.params.id, req.user.familyId!, req.user.userId, { imageUrl, note }, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Phê duyệt bằng chứng và hoàn thành nhiệm vụ: chuyển trạng thái sang APPROVED.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được duyệt.
 * Nếu task có thưởng, service sẽ tự động chuyển tiền từ ví chung sang ví cá nhân.
 *
 * @route PATCH /tasks/:id/approve
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ.
 * @param res - Express Response. Trả về task sau khi được phê duyệt.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function approveTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'APPROVED', req.user.userId, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Từ chối bằng chứng của nhiệm vụ: chuyển trạng thái sang REJECTED.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được từ chối.
 * Người được giao việc sẽ nhận thông báo và cần làm lại, nộp lại bằng chứng.
 *
 * @route PATCH /tasks/:id/reject
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ.
 * @param res - Express Response. Trả về task sau khi bị từ chối.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function rejectTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.transitionTask(req.params.id, req.user.familyId!, 'REJECTED', req.user.userId, {
      role: req.user.role,
      familyMemberId: req.user.familyMemberId,
    })
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Huỷ một nhiệm vụ: chuyển trạng thái sang CANCELLED.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được huỷ.
 * Dùng DELETE method theo convention REST để xoá/vô hiệu hoá tài nguyên.
 *
 * @route DELETE /tasks/:id
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ.
 * @param res - Express Response. Trả về task sau khi bị huỷ.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function cancelTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.cancelTask(req.params.id, req.user.familyId!)
    res.json(task)
  } catch (e) { next(e) }
}

/**
 * Giao nhiệm vụ cho một thành viên trong gia đình (hoặc thay đổi người được giao).
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép giao việc.
 *
 * @route PATCH /tasks/:id/assign
 * @param req - Express Request. `req.params.id` là ID nhiệm vụ; Body: `{ assignedToId }`.
 * @param res - Express Response. Trả về task sau khi cập nhật người được giao.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function assignTask(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate: assignedToId là bắt buộc khi gọi endpoint này
    const { assignedToId } = z.object({ assignedToId: z.string() }).parse(req.body)
    const task = await taskService.updateTask(req.params.id, req.user.familyId!, { assignedToId })
    res.json(task)
  } catch (e) { next(e) }
}
