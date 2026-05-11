import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

export interface PlanInput {
  code: string
  name: string
  description?: string | null
  price?: number
  currency?: string
  billingPeriod?: string
  maxMembers?: number | null
  maxTasksPerMonth?: number | null
  features?: string[]
  isActive?: boolean
  sortOrder?: number
}

export async function listPlans(includeInactive = false) {
  return prisma.subscriptionPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    include: { _count: { select: { families: true } } },
  })
}

export async function getPlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
  if (!plan) throw Errors.NotFound('Plan')
  return plan
}

export async function getPlanByCode(code: string) {
  return prisma.subscriptionPlan.findUnique({ where: { code } })
}

export async function createPlan(data: PlanInput) {
  const existing = await prisma.subscriptionPlan.findUnique({ where: { code: data.code } })
  if (existing) throw Errors.Conflict('Plan code already exists')

  return prisma.subscriptionPlan.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price ?? 0,
      currency: data.currency ?? 'VND',
      billingPeriod: data.billingPeriod ?? 'MONTHLY',
      maxMembers: data.maxMembers ?? null,
      maxTasksPerMonth: data.maxTasksPerMonth ?? null,
      features: (data.features ?? []) as unknown as object,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

export async function updatePlan(id: string, data: Partial<PlanInput>) {
  await getPlan(id)
  return prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.billingPeriod !== undefined && { billingPeriod: data.billingPeriod }),
      ...(data.maxMembers !== undefined && { maxMembers: data.maxMembers }),
      ...(data.maxTasksPerMonth !== undefined && { maxTasksPerMonth: data.maxTasksPerMonth }),
      ...(data.features !== undefined && { features: data.features as unknown as object }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  })
}

export async function deletePlan(id: string) {
  const inUse = await prisma.family.count({ where: { planId: id } })
  if (inUse > 0) throw Errors.BadRequest(`Plan is in use by ${inUse} families. Reassign first.`)
  await prisma.subscriptionPlan.delete({ where: { id } })
}

export async function assignPlanToFamily(familyId: string, planId: string | null) {
  if (planId) {
    await getPlan(planId)
  }
  return prisma.family.update({
    where: { id: familyId },
    data: { planId },
    include: { subscriptionPlan: true },
  })
}

export async function ensureDefaultPlans() {
  const count = await prisma.subscriptionPlan.count()
  if (count > 0) return

  const defaults: PlanInput[] = [
    {
      code: 'FREE',
      name: 'Miễn phí',
      description: 'Dùng thử dành cho gia đình nhỏ',
      price: 0,
      billingPeriod: 'FREE',
      maxMembers: 4,
      maxTasksPerMonth: 20,
      features: ['Quản lý nhiệm vụ cơ bản', 'Chat gia đình', 'SOS khẩn cấp'],
      sortOrder: 0,
    },
    {
      code: 'BASIC',
      name: 'Cơ bản',
      description: 'Gói tiêu chuẩn cho gia đình',
      price: 49000,
      billingPeriod: 'MONTHLY',
      maxMembers: 8,
      maxTasksPerMonth: 100,
      features: ['Tất cả tính năng FREE', 'Album ảnh không giới hạn', 'Lịch gia đình', 'Yêu cầu nạp tiền'],
      sortOrder: 1,
    },
    {
      code: 'PREMIUM',
      name: 'Cao cấp',
      description: 'Đầy đủ tính năng, không giới hạn',
      price: 99000,
      billingPeriod: 'MONTHLY',
      maxMembers: null,
      maxTasksPerMonth: null,
      features: ['Tất cả tính năng BASIC', 'Chia sẻ vị trí realtime', 'AI Chatbot', 'Hỗ trợ ưu tiên'],
      sortOrder: 2,
    },
  ]

  for (const p of defaults) {
    await createPlan(p)
  }
  console.log(`📦 Seeded ${defaults.length} default subscription plans`)
}
