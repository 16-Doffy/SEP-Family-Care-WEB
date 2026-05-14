/**
 * @file plan-limits.service.ts
 * @module services/plan-limits
 *
 * Dịch vụ kiểm tra và thực thi giới hạn tài nguyên theo gói subscription.
 *
 * Được gọi tại các service khác (family.service, task.service) **trước khi**
 * thực hiện hành động để ngăn vượt giới hạn gói.
 *
 * Chiến lược lấy giới hạn (theo độ ưu tiên):
 * 1. Nếu gia đình có `subscriptionPlan` (gói động từ database) → dùng limits của gói đó.
 * 2. Nếu không có gói động → fallback về `FALLBACK_BY_ENUM` theo trường `family.plan`
 *    (enum cứng trong schema: FREE, BASIC, PREMIUM).
 * 3. Nếu không khớp enum nào → dùng limits của FREE (an toàn nhất).
 *
 * Cơ chế fallback giúp hệ thống vẫn hoạt động đúng kể cả khi
 * `subscriptionPlan` chưa được seed hoặc đã bị xóa.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

/**
 * Cấu trúc giới hạn tài nguyên của một gói subscription.
 * `null` có nghĩa là không giới hạn.
 */
interface PlanLimits {
  /** Số thành viên tối đa được phép trong gia đình */
  maxMembers: number | null
  /** Số nhiệm vụ tối đa có thể tạo trong tháng */
  maxTasksPerMonth: number | null
  /** Danh sách tính năng được phép dùng */
  features: string[]
}

/**
 * Giá trị giới hạn mặc định theo enum `plan` của bảng `Family`.
 *
 * Dùng làm fallback khi gia đình chưa có hoặc đã mất `subscriptionPlan`.
 * Phải giữ đồng bộ với các gói mặc định được seed trong `ensureDefaultPlans`.
 */
const FALLBACK_BY_ENUM: Record<string, PlanLimits> = {
  FREE: { maxMembers: 4, maxTasksPerMonth: 20, features: [] },
  BASIC: { maxMembers: 8, maxTasksPerMonth: 100, features: [] },
  PREMIUM: { maxMembers: null, maxTasksPerMonth: null, features: [] },
}

/**
 * Lấy giới hạn tài nguyên hiện tại của một gia đình.
 *
 * Ưu tiên dùng `subscriptionPlan` từ database (linh động, có thể thay đổi).
 * Fallback về enum cứng nếu không có gói động.
 *
 * @param familyId - ID gia đình cần kiểm tra
 * @returns Đối tượng `PlanLimits` chứa các giới hạn áp dụng
 * @throws NotFound nếu gia đình không tồn tại
 */
export async function getFamilyLimits(familyId: string): Promise<PlanLimits> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { subscriptionPlan: true },
  })
  if (!family) throw Errors.NotFound('Family')

  if (family.subscriptionPlan) {
    // Ưu tiên 1: Dùng giới hạn từ gói subscription động (được admin cấu hình)
    return {
      maxMembers: family.subscriptionPlan.maxMembers,
      maxTasksPerMonth: family.subscriptionPlan.maxTasksPerMonth,
      // Ép kiểu vì Prisma lưu features là JSON (unknown type)
      features: Array.isArray(family.subscriptionPlan.features)
        ? (family.subscriptionPlan.features as string[])
        : [],
    }
  }

  // Ưu tiên 2: Fallback về giá trị cứng theo enum plan của gia đình
  // Nếu enum không khớp, dùng FREE làm giá trị an toàn nhất (giới hạn thấp nhất)
  return FALLBACK_BY_ENUM[family.plan] ?? FALLBACK_BY_ENUM.FREE
}

/**
 * Kiểm tra gia đình có thể thêm thành viên mới không.
 *
 * Nếu gói không giới hạn số thành viên (`maxMembers == null`), bỏ qua kiểm tra.
 * Đếm số thành viên hiện tại và so sánh với giới hạn gói.
 *
 * @param familyId - ID gia đình muốn thêm thành viên
 * @throws BadRequest nếu đã đạt giới hạn số thành viên
 * @throws NotFound nếu gia đình không tồn tại
 */
export async function assertCanAddMember(familyId: string) {
  const limits = await getFamilyLimits(familyId)

  // null = không giới hạn → cho phép thêm
  if (limits.maxMembers == null) return

  const count = await prisma.familyMember.count({ where: { familyId } })
  if (count >= limits.maxMembers) {
    throw Errors.BadRequest(
      `Gói hiện tại chỉ cho phép tối đa ${limits.maxMembers} thành viên. Vui lòng nâng cấp.`,
    )
  }
}

/**
 * Kiểm tra gia đình có thể tạo thêm nhiệm vụ trong tháng này không.
 *
 * Nếu gói không giới hạn số task (`maxTasksPerMonth == null`), bỏ qua kiểm tra.
 * Đếm số task được tạo từ đầu tháng hiện tại (không tính task đã xóa).
 *
 * Cửa sổ đếm: từ ngày 1 của tháng hiện tại lúc 00:00:00 đến thời điểm hiện tại.
 *
 * @param familyId - ID gia đình muốn tạo task mới
 * @throws BadRequest nếu đã đạt giới hạn số task trong tháng
 * @throws NotFound nếu gia đình không tồn tại
 */
export async function assertCanCreateTask(familyId: string) {
  const limits = await getFamilyLimits(familyId)

  // null = không giới hạn → cho phép tạo
  if (limits.maxTasksPerMonth == null) return

  // Tính thời điểm đầu tháng hiện tại để làm cửa sổ đếm
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const count = await prisma.task.count({
    where: { familyId, createdAt: { gte: start } },
  })
  if (count >= limits.maxTasksPerMonth) {
    throw Errors.BadRequest(
      `Gói hiện tại chỉ cho phép ${limits.maxTasksPerMonth} nhiệm vụ/tháng. Vui lòng nâng cấp.`,
    )
  }
}
