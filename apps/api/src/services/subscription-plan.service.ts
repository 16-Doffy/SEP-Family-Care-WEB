/**
 * @file subscription-plan.service.ts
 * @module services/subscription-plan
 *
 * Dịch vụ quản lý các gói đăng ký (subscription plans) trong hệ thống.
 *
 * Mỗi gói định nghĩa:
 *   - Giới hạn tài nguyên (số thành viên, số task/tháng, dung lượng album/system)
 *   - Quyền AI (aiEnabled, aiFinanceEnabled)
 *   - Thời hạn sử dụng (durationDays — số ngày kể từ ngày kích hoạt)
 *   - Bậc (tier) để so sánh nhanh gói cao/thấp
 *   - Danh sách feature hiển thị trên UI
 *
 * Khi server khởi động lần đầu và database chưa có gói nào,
 * `ensureDefaultPlans` sẽ tự động seed 4 gói mặc định: FREE, BASIC, STANDARD, PREMIUM.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

/**
 * Dữ liệu đầu vào để tạo hoặc cập nhật một gói subscription.
 */
export interface PlanInput {
  /** Mã định danh duy nhất, dạng UPPER_SNAKE_CASE (e.g. FREE, BASIC, PREMIUM) */
  code: string
  /** Tên hiển thị của gói */
  name: string
  /** Mô tả ngắn về gói (hiển thị trên trang pricing) */
  description?: string | null
  /** Giá gói (đơn vị: VND) */
  price?: number
  /** Giá theo tháng khi một gói có nhiều chu kỳ thanh toán */
  priceMonthly?: number | null
  /** Giá theo năm khi một gói có nhiều chu kỳ thanh toán */
  priceYearly?: number | null
  /** Đơn vị tiền tệ (mặc định: VND) */
  currency?: string
  /** Chu kỳ thanh toán: FREE | MONTHLY | YEARLY | LIFETIME */
  billingPeriod?: string
  /**
   * Thời hạn sử dụng kể từ ngày kích hoạt (ngày).
   * Vd: 30 (MONTHLY), 365 (YEARLY), null = LIFETIME.
   * Gói càng rẻ → thường có durationDays càng ngắn.
   */
  durationDays?: number | null
  /** Số thành viên tối đa trong gia đình (`null` = không giới hạn) */
  maxMembers?: number | null
  /** Số nhiệm vụ có thể tạo trong tháng (`null` = không giới hạn) */
  maxTasksPerMonth?: number | null
  /** Giới hạn dung lượng album ảnh (MB). `null` = không giới hạn. */
  albumStorageMb?: number | null
  /** Giới hạn tổng dung lượng hệ thống (MB). `null` = không giới hạn. */
  systemStorageMb?: number | null
  /** Cho phép sử dụng các tính năng AI cơ bản (chatbot, gợi ý) */
  aiEnabled?: boolean
  /** Cho phép sử dụng AI tài chính (dự báo, phân tích, gợi ý chi tiêu) */
  aiFinanceEnabled?: boolean
  /** Truy cập báo cáo tài chính / task nâng cao */
  advancedReports?: boolean
  /** Hỗ trợ ưu tiên */
  prioritySupport?: boolean
  /** Bậc gói. 0 = FREE, càng cao càng mạnh — dùng để so sánh nhanh */
  tier?: number
  /** Danh sách tính năng đi kèm gói (hiển thị trên UI) */
  features?: string[]
  /** Trạng thái gói: `true` = đang bán, `false` = ẩn */
  isActive?: boolean
  /** Thứ tự hiển thị trên trang pricing (số nhỏ hơn hiển thị trước) */
  sortOrder?: number
}

/**
 * Lấy danh sách tất cả các gói subscription.
 *
 * Bao gồm số lượng gia đình đang dùng mỗi gói (`_count.families`)
 * để admin biết gói nào đang được sử dụng nhiều.
 *
 * @param includeInactive - Nếu `true`, trả về cả gói đang ẩn (mặc định: chỉ gói active)
 * @returns Mảng các gói subscription kèm số gia đình đang dùng
 */
export async function listPlans(includeInactive = false) {
  return prisma.subscriptionPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    // Sắp xếp theo sortOrder trước, sau đó theo giá tăng dần
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    include: { _count: { select: { families: true } } },
  })
}

/**
 * Lấy thông tin chi tiết một gói subscription theo ID.
 */
export async function getPlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
  if (!plan) throw Errors.NotFound('Plan')
  return plan
}

/**
 * Lấy thông tin gói subscription theo mã code (e.g. 'FREE', 'PREMIUM').
 * Trả về `null` nếu không tìm thấy (không ném lỗi) để caller tự xử lý.
 */
export async function getPlanByCode(code: string) {
  return prisma.subscriptionPlan.findUnique({ where: { code } })
}

/**
 * Suy ra `durationDays` mặc định từ billingPeriod nếu caller không truyền.
 * MONTHLY → 30, YEARLY → 365, LIFETIME/FREE → null (vô hạn).
 */
function inferDuration(billingPeriod?: string, durationDays?: number | null): number | null {
  if (durationDays !== undefined) return durationDays
  if (billingPeriod === 'MONTHLY') return 30
  if (billingPeriod === 'YEARLY') return 365
  return null
}

/**
 * Tạo mới một gói subscription.
 *
 * Kiểm tra trùng `code` trước khi tạo vì `code` là unique identifier.
 *
 * @throws Conflict nếu `code` đã tồn tại
 */
export async function createPlan(data: PlanInput) {
  const existing = await prisma.subscriptionPlan.findUnique({ where: { code: data.code } })
  if (existing) throw Errors.Conflict('Plan code already exists')

  return prisma.subscriptionPlan.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price ?? 0,
      priceMonthly: data.priceMonthly ?? (data.billingPeriod === 'MONTHLY' ? data.price ?? 0 : null),
      priceYearly: data.priceYearly ?? (data.billingPeriod === 'YEARLY' ? data.price ?? 0 : null),
      currency: data.currency ?? 'VND',
      billingPeriod: data.billingPeriod ?? 'MONTHLY',
      durationDays: inferDuration(data.billingPeriod, data.durationDays),
      maxMembers: data.maxMembers ?? null,
      maxTasksPerMonth: data.maxTasksPerMonth ?? null,
      albumStorageMb: data.albumStorageMb ?? null,
      systemStorageMb: data.systemStorageMb ?? null,
      aiEnabled: data.aiEnabled ?? false,
      aiFinanceEnabled: data.aiFinanceEnabled ?? false,
      advancedReports: data.advancedReports ?? false,
      prioritySupport: data.prioritySupport ?? false,
      tier: data.tier ?? 0,
      // features là JSON trong Prisma nên cần cast về object
      features: (data.features ?? []) as unknown as object,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

/**
 * Cập nhật thông tin một gói subscription (partial update).
 *
 * Dùng spread conditional `...(field !== undefined && { field })` để
 * phân biệt giữa "không muốn thay đổi" và "muốn set về null".
 *
 * @throws NotFound nếu gói không tồn tại
 */
export async function updatePlan(id: string, data: Partial<PlanInput>) {
  await getPlan(id)
  return prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.priceMonthly !== undefined && { priceMonthly: data.priceMonthly }),
      ...(data.priceYearly !== undefined && { priceYearly: data.priceYearly }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.billingPeriod !== undefined && { billingPeriod: data.billingPeriod }),
      ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
      ...(data.maxMembers !== undefined && { maxMembers: data.maxMembers }),
      ...(data.maxTasksPerMonth !== undefined && { maxTasksPerMonth: data.maxTasksPerMonth }),
      ...(data.albumStorageMb !== undefined && { albumStorageMb: data.albumStorageMb }),
      ...(data.systemStorageMb !== undefined && { systemStorageMb: data.systemStorageMb }),
      ...(data.aiEnabled !== undefined && { aiEnabled: data.aiEnabled }),
      ...(data.aiFinanceEnabled !== undefined && { aiFinanceEnabled: data.aiFinanceEnabled }),
      ...(data.advancedReports !== undefined && { advancedReports: data.advancedReports }),
      ...(data.prioritySupport !== undefined && { prioritySupport: data.prioritySupport }),
      ...(data.tier !== undefined && { tier: data.tier }),
      ...(data.features !== undefined && { features: data.features as unknown as object }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  })
}

/**
 * Xóa một gói subscription.
 * Sẽ thất bại nếu còn gia đình đang dùng gói này.
 */
export async function deletePlan(id: string) {
  const inUse = await prisma.family.count({ where: { planId: id } })
  if (inUse > 0) throw Errors.BadRequest(`Plan is in use by ${inUse} families. Reassign first.`)
  await prisma.subscriptionPlan.delete({ where: { id } })
}

/**
 * Gán hoặc gỡ gói subscription cho một gia đình (chỉ dùng cho admin).
 * Đây là luồng admin để gán gói trực tiếp mà không qua thanh toán.
 */
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

/**
 * Seed các gói subscription mặc định nếu database chưa có gói nào.
 *
 * Các gói mặc định:
 * - FREE:      4 thành viên, 20 task/tháng, 100MB album, 14 ngày dùng thử
 * - BASIC:     8 thành viên, 100 task/tháng, 1GB, 30 ngày
 * - STANDARD:  15 thành viên, 500 task/tháng, 5GB, 30 ngày, AI cơ bản
 * - PREMIUM:   không giới hạn, 50GB, AI tài chính, báo cáo nâng cao
 */
export async function ensureDefaultPlans() {
  const count = await prisma.subscriptionPlan.count()
  if (count > 0) return

  const defaults: PlanInput[] = [
    {
      code: 'FREE',
      name: 'Miễn phí',
      description: 'Dùng thử 14 ngày cho gia đình nhỏ',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      billingPeriod: 'FREE',
      durationDays: 14,
      maxMembers: 4,
      maxTasksPerMonth: 20,
      albumStorageMb: 100,
      systemStorageMb: 200,
      aiEnabled: false,
      aiFinanceEnabled: false,
      advancedReports: false,
      prioritySupport: false,
      tier: 0,
      features: [
        'Quản lý nhiệm vụ cơ bản',
        'Chat gia đình',
        'SOS khẩn cấp',
        'Tối đa 4 thành viên',
      ],
      sortOrder: 0,
    },
    {
      code: 'BASIC',
      name: 'Cơ bản',
      description: 'Gói tiêu chuẩn cho gia đình',
      price: 49000,
      priceMonthly: 49000,
      priceYearly: 490000,
      billingPeriod: 'MONTHLY',
      durationDays: 30,
      maxMembers: 8,
      maxTasksPerMonth: 100,
      albumStorageMb: 1024,
      systemStorageMb: 2048,
      aiEnabled: false,
      aiFinanceEnabled: false,
      advancedReports: false,
      prioritySupport: false,
      tier: 1,
      features: [
        'Tất cả tính năng FREE',
        'Album ảnh 1GB',
        'Lịch gia đình',
        'Yêu cầu nạp tiền',
        'Quản lý chi tiêu chung',
      ],
      sortOrder: 1,
    },
    {
      code: 'STANDARD',
      name: 'Tiêu chuẩn',
      description: 'Phù hợp gia đình đa thế hệ — có AI cơ bản',
      price: 99000,
      priceMonthly: 99000,
      priceYearly: 990000,
      billingPeriod: 'MONTHLY',
      durationDays: 30,
      maxMembers: 15,
      maxTasksPerMonth: 500,
      albumStorageMb: 5120,
      systemStorageMb: 10240,
      aiEnabled: true,
      aiFinanceEnabled: false,
      advancedReports: false,
      prioritySupport: false,
      tier: 2,
      features: [
        'Tất cả tính năng BASIC',
        'Album ảnh 5GB',
        'Chia sẻ vị trí realtime',
        'AI Chatbot cơ bản',
        'Quản lý task định kỳ',
      ],
      sortOrder: 2,
    },
    {
      code: 'PREMIUM',
      name: 'Cao cấp',
      description: 'Đầy đủ tính năng AI tài chính & báo cáo nâng cao',
      price: 199000,
      priceMonthly: 199000,
      priceYearly: 1990000,
      billingPeriod: 'MONTHLY',
      durationDays: 30,
      maxMembers: null,
      maxTasksPerMonth: null,
      albumStorageMb: 51200,
      systemStorageMb: 102400,
      aiEnabled: true,
      aiFinanceEnabled: true,
      advancedReports: true,
      prioritySupport: true,
      tier: 3,
      features: [
        'Tất cả tính năng STANDARD',
        'Thành viên không giới hạn',
        'Album ảnh 50GB',
        'AI tài chính: dự báo, gợi ý chi tiêu',
        'Báo cáo nâng cao',
        'Hỗ trợ ưu tiên 24/7',
      ],
      sortOrder: 3,
    },
  ]

  for (const p of defaults) {
    await createPlan(p)
  }
  console.log(`Seeded ${defaults.length} default subscription plans`)
}
