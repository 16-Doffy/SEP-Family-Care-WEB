/**
 * @module family.controller
 * @description Controller xử lý các HTTP request liên quan đến gia đình.
 *
 * Lớp này chỉ chịu trách nhiệm:
 *   1. Validate dữ liệu đầu vào bằng Zod schema.
 *   2. Đọc context người dùng từ `req.user` (được gắn bởi authenticate middleware).
 *   3. Chuyển tiếp sang family.service để xử lý business logic.
 *   4. Trả về HTTP response phù hợp hoặc chuyển lỗi sang error middleware.
 *
 * Mọi route trong module này đều yêu cầu xác thực (authenticate) được áp dụng
 * ở cấp router trong family.routes.ts.
 */

import type { Request, Response, NextFunction } from 'express'
import * as familyService from '../services/family.service'
import { z } from 'zod'

const familyRelationship = z.enum([
  'FATHER',
  'MOTHER',
  'CHILD',
  'GRANDPARENT',
  'SIBLING',
  'SPOUSE',
  'RELATIVE',
  'OTHER',
])

/**
 * Lấy thông tin chi tiết gia đình của người dùng đang đăng nhập.
 *
 * GET /families/
 *
 * familyId được lấy từ JWT payload (req.user.familyId), không cho phép
 * client tự chỉ định để tránh truy cập trái phép vào gia đình khác.
 *
 * @param req - Express Request, req.user.familyId được gắn bởi authenticate middleware
 * @param res - Express Response, trả về thông tin gia đình kèm thành viên và ví
 * @param next - Chuyển lỗi sang error middleware
 */
export async function getFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const family = await familyService.getFamily(req.user.familyId!)
    res.json(family)
  } catch (e) {
    next(e)
  }
}

/**
 * Cập nhật tên gia đình.
 *
 * PUT /families/
 *
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép thực hiện (requireRole ở routes).
 *
 * @param req - Express Request với body `{ name: string }` (1–200 ký tự)
 * @param res - Express Response, trả về đối tượng Family sau khi cập nhật
 * @param next - Chuyển lỗi sang error middleware
 */
export async function updateFamily(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate độ dài tên gia đình trước khi gọi service
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.body)
    const family = await familyService.updateFamily(req.user.familyId!, name)
    res.json(family)
  } catch (e) {
    next(e)
  }
}

/**
 * Sinh mã mời để thêm thành viên mới vào gia đình.
 *
 * POST /families/invite
 *
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép thực hiện (requireRole ở routes).
 * Mã mời có hiệu lực 7 ngày và chỉ dùng được một lần.
 *
 * @param req - Express Request với body `{ role: 'PARENT' | 'FAMILY_MEMBER' }`
 * @param res - Express Response, trả về `{ code, expiresIn }` để client chia sẻ
 * @param next - Chuyển lỗi sang error middleware
 */
export async function generateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { role, relationship } = z
      .object({
        role: z.enum(['PARENT', 'FAMILY_MEMBER']),
        relationship: familyRelationship.optional(),
      })
      .parse(req.body)
    const code = await familyService.generateInviteCode(req.user.familyId!, role, relationship)
    // Trả về expiresIn dạng chuỗi mô tả để client hiển thị mà không cần tính toán
    res.json({ code, expiresIn: '7 days' })
  } catch (e) {
    next(e)
  }
}

/**
 * Xử lý yêu cầu tham gia gia đình bằng mã mời.
 *
 * POST /families/join
 *
 * Route này không yêu cầu requireFamily vì người dùng chưa thuộc gia đình nào.
 * userId được lấy từ JWT (req.user.userId) để đảm bảo đúng người đang đăng nhập.
 *
 * @param req - Express Request với body `{ code: string }`
 * @param res - Express Response, trả về đối tượng FamilyMember vừa được tạo
 * @param next - Chuyển lỗi sang error middleware
 */
export async function joinFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body)
    const member = await familyService.joinFamily(req.user.userId, code)
    res.json(member)
  } catch (e) {
    next(e)
  }
}

/**
 * Xóa một thành viên khỏi gia đình.
 *
 * DELETE /families/members/:userId
 *
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép thực hiện (requireRole ở routes).
 * Thực chất là vô hiệu hóa tài khoản (soft-delete) để giữ lại dữ liệu lịch sử.
 *
 * @param req - Express Request, req.params.userId là ID của thành viên cần xóa
 * @param res - Express Response, trả về thông báo thành công
 * @param next - Chuyển lỗi sang error middleware
 */
export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    // requesterId là người đang đăng nhập — dùng để ngăn tự xóa bản thân
    await familyService.removeMember(req.user.familyId!, req.params.userId, req.user.userId)
    res.json({ message: 'Member removed' })
  } catch (e) {
    next(e)
  }
}

/**
 * Lấy trạng thái onboarding của family workspace hiện tại.
 *
 * GET /families/onboarding
 *
 * Trả về step, isActive flag và thông tin gói (nếu đã chọn) để UI
 * hiển thị wizard onboarding (chọn gói → thanh toán → kích hoạt).
 */
export async function onboardingStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await familyService.getOnboardingStatus(req.user.familyId!)
    res.json(status)
  } catch (e) {
    next(e)
  }
}

/**
 * Cập nhật onboarding step (UI gọi sau khi user thao tác xong từng bước).
 *
 * PATCH /families/onboarding
 * Body: { step: 'WORKSPACE_CREATED' | 'PLAN_SELECTED' | 'PAYMENT_VERIFIED' | 'ACTIVE' }
 */
export async function setOnboardingStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { step } = z
      .object({
        step: z.enum(['WORKSPACE_CREATED', 'PLAN_SELECTED', 'PAYMENT_VERIFIED', 'ACTIVE']),
      })
      .parse(req.body)
    const result = await familyService.setOnboardingStep(req.user.familyId!, step)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function changeMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = z.object({ role: z.enum(['PARENT', 'FAMILY_MEMBER']) }).parse(req.body)
    const result = await familyService.changeMemberRole(
      req.user.familyId!,
      req.params.userId,
      role,
      req.user.userId,
    )
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function updateMemberProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        nickname: z.string().max(80).nullable().optional(),
        relationship: familyRelationship.optional(),
        birthDate: z.string().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(req.body)
    const result = await familyService.updateMemberProfile(req.user.familyId!, req.params.memberId, data)
    res.json(result)
  } catch (e) {
    next(e)
  }
}
