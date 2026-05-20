/**
 * @file plan-limits.service.ts
 * @module services/plan-limits
 *
 * Dịch vụ kiểm tra và thực thi giới hạn tài nguyên theo gói subscription.
 *
 * Được gọi tại các service khác (family.service, task.service, album.service,
 * ai-chat.service) **trước khi** thực hiện hành động để ngăn vượt giới hạn gói.
 *
 * Chiến lược lấy giới hạn (theo độ ưu tiên):
 * 1. Nếu gia đình có `subscriptionPlan` (gói động từ database) → dùng limits của gói đó.
 * 2. Nếu không có gói động → fallback về `FALLBACK_BY_ENUM` theo trường `family.plan`.
 * 3. Nếu không khớp enum nào → dùng limits của FREE (an toàn nhất).
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

/**
 * Cấu trúc giới hạn tài nguyên của một gói subscription.
 * `null` có nghĩa là không giới hạn.
 */
interface PlanLimits {
  maxMembers: number | null
  maxTasksPerMonth: number | null
  /** Dung lượng album (MB). null = không giới hạn. */
  albumStorageMb: number | null
  /** Tổng dung lượng hệ thống (MB). null = không giới hạn. */
  systemStorageMb: number | null
  /** Cho phép dùng AI cơ bản */
  aiEnabled: boolean
  /** Cho phép dùng AI tài chính */
  aiFinanceEnabled: boolean
  /** Truy cập báo cáo nâng cao */
  advancedReports: boolean
  features: string[]
}

/**
 * Giá trị giới hạn mặc định theo enum `plan` của bảng `Family`.
 * Dùng làm fallback khi gia đình chưa có hoặc đã mất `subscriptionPlan`.
 */
const FALLBACK_BY_ENUM: Record<string, PlanLimits> = {
  FREE: {
    maxMembers: 4,
    maxTasksPerMonth: 20,
    albumStorageMb: 100,
    systemStorageMb: 200,
    aiEnabled: false,
    aiFinanceEnabled: false,
    advancedReports: false,
    features: [],
  },
  BASIC: {
    maxMembers: 8,
    maxTasksPerMonth: 100,
    albumStorageMb: 1024,
    systemStorageMb: 2048,
    aiEnabled: false,
    aiFinanceEnabled: false,
    advancedReports: false,
    features: [],
  },
  PREMIUM: {
    maxMembers: null,
    maxTasksPerMonth: null,
    albumStorageMb: 51200,
    systemStorageMb: 102400,
    aiEnabled: true,
    aiFinanceEnabled: true,
    advancedReports: true,
    features: [],
  },
}

/**
 * Lấy giới hạn tài nguyên hiện tại của một gia đình.
 *
 * Ưu tiên dùng `subscriptionPlan` từ database (linh động, có thể thay đổi).
 * Fallback về enum cứng nếu không có gói động.
 */
export async function getFamilyLimits(familyId: string): Promise<PlanLimits> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { subscriptionPlan: true },
  })
  if (!family) throw Errors.NotFound('Family')

  if (family.subscriptionPlan) {
    const p = family.subscriptionPlan
    return {
      maxMembers: p.maxMembers,
      maxTasksPerMonth: p.maxTasksPerMonth,
      albumStorageMb: p.albumStorageMb,
      systemStorageMb: p.systemStorageMb,
      aiEnabled: p.aiEnabled,
      aiFinanceEnabled: p.aiFinanceEnabled,
      advancedReports: p.advancedReports,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
    }
  }

  return FALLBACK_BY_ENUM[family.plan] ?? FALLBACK_BY_ENUM.FREE
}

/**
 * Kiểm tra gia đình có thể thêm thành viên mới không.
 */
export async function assertCanAddMember(familyId: string) {
  const limits = await getFamilyLimits(familyId)
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
 */
export async function assertCanCreateTask(familyId: string) {
  const limits = await getFamilyLimits(familyId)
  if (limits.maxTasksPerMonth == null) return

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

/**
 * Yêu cầu gói có quyền dùng AI cơ bản (chatbot, gợi ý).
 * Dùng để gate endpoint AI khi gói thấp.
 */
export async function assertAiEnabled(familyId: string) {
  const limits = await getFamilyLimits(familyId)
  if (!limits.aiEnabled) {
    throw Errors.BadRequest('Gói hiện tại chưa hỗ trợ AI. Vui lòng nâng cấp lên STANDARD trở lên.')
  }
}

/**
 * Yêu cầu gói có quyền dùng AI tài chính (dự báo, phân tích chi tiêu).
 * Dùng để gate endpoint /ai-chat khi câu hỏi liên quan finance.
 */
export async function assertAiFinanceEnabled(familyId: string) {
  const limits = await getFamilyLimits(familyId)
  if (!limits.aiFinanceEnabled) {
    throw Errors.BadRequest('Gói hiện tại chưa hỗ trợ AI tài chính. Vui lòng nâng cấp lên PREMIUM.')
  }
}
