import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

interface PlanLimits {
  maxMembers: number | null
  maxTasksPerMonth: number | null
  features: string[]
}

const FALLBACK_BY_ENUM: Record<string, PlanLimits> = {
  FREE: { maxMembers: 4, maxTasksPerMonth: 20, features: [] },
  BASIC: { maxMembers: 8, maxTasksPerMonth: 100, features: [] },
  PREMIUM: { maxMembers: null, maxTasksPerMonth: null, features: [] },
}

export async function getFamilyLimits(familyId: string): Promise<PlanLimits> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { subscriptionPlan: true },
  })
  if (!family) throw Errors.NotFound('Family')

  if (family.subscriptionPlan) {
    return {
      maxMembers: family.subscriptionPlan.maxMembers,
      maxTasksPerMonth: family.subscriptionPlan.maxTasksPerMonth,
      features: Array.isArray(family.subscriptionPlan.features)
        ? (family.subscriptionPlan.features as string[])
        : [],
    }
  }
  return FALLBACK_BY_ENUM[family.plan] ?? FALLBACK_BY_ENUM.FREE
}

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
