/**
 * @file subscription-plan.service.ts
 * @module services/subscription-plan
 *
 * Dịch vụ quản lý các gói đăng ký (subscription plans) trong hệ thống.
 *
 * Mỗi gói định nghĩa giới hạn tài nguyên (số thành viên, số task/tháng)
 * và danh sách tính năng được phép sử dụng.
 *
 * Khi server khởi động lần đầu và database chưa có gói nào,
 * `ensureDefaultPlans` sẽ tự động seed 3 gói mặc định: FREE, BASIC, PREMIUM.
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
  /** Đơn vị tiền tệ (mặc định: VND) */
  currency?: string
  /** Chu kỳ thanh toán: FREE | MONTHLY | YEARLY | LIFETIME */
  billingPeriod?: string
  /** Số thành viên tối đa trong gia đình (`null` = không giới hạn) */
  maxMembers?: number | null
  /** Số nhiệm vụ có thể tạo trong tháng (`null` = không giới hạn) */
  maxTasksPerMonth?: number | null
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
 *
 * @param id - ID của gói cần lấy
 * @returns Bản ghi `SubscriptionPlan`
 * @throws NotFound nếu gói không tồn tại
 */
export async function getPlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
  if (!plan) throw Errors.NotFound('Plan')
  return plan
}

/**
 * Lấy thông tin gói subscription theo mã code (e.g. 'FREE', 'PREMIUM').
 *
 * Trả về `null` nếu không tìm thấy (không ném lỗi) để caller tự xử lý.
 *
 * @param code - Mã gói (UPPER_SNAKE_CASE)
 * @returns Bản ghi `SubscriptionPlan` hoặc `null`
 */
export async function getPlanByCode(code: string) {
  return prisma.subscriptionPlan.findUnique({ where: { code } })
}

/**
 * Tạo mới một gói subscription.
 *
 * Kiểm tra trùng `code` trước khi tạo vì `code` là unique identifier
 * được dùng để lookup gói theo tên (e.g. khi seed dữ liệu mặc định).
 *
 * @param data - Dữ liệu gói cần tạo
 * @returns Bản ghi `SubscriptionPlan` vừa tạo
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
      currency: data.currency ?? 'VND',
      billingPeriod: data.billingPeriod ?? 'MONTHLY',
      maxMembers: data.maxMembers ?? null,
      maxTasksPerMonth: data.maxTasksPerMonth ?? null,
      // features là JSON trong Prisma nên cần cast về object
      features: (data.features ?? []) as unknown as object,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

/**
 * Cập nhật thông tin một gói subscription.
 *
 * Chỉ cập nhật các trường được truyền vào (partial update).
 * Dùng spread conditional `...(field !== undefined && { field })` để
 * phân biệt giữa "không muốn thay đổi" và "muốn set về null".
 *
 * @param id - ID gói cần cập nhật
 * @param data - Các trường cần thay đổi (partial)
 * @returns Bản ghi `SubscriptionPlan` sau khi cập nhật
 * @throws NotFound nếu gói không tồn tại
 */
export async function updatePlan(id: string, data: Partial<PlanInput>) {
  // Kiểm tra tồn tại trước để trả lỗi rõ ràng hơn là lỗi Prisma
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

/**
 * Xóa một gói subscription.
 *
 * Kiểm tra xem gói có đang được bất kỳ gia đình nào sử dụng không.
 * Nếu có, ném lỗi và yêu cầu admin gán lại gói cho các gia đình đó trước.
 * Điều này ngăn tình trạng gia đình bị mồ côi không có gói.
 *
 * @param id - ID gói cần xóa
 * @throws BadRequest nếu gói đang được ít nhất một gia đình sử dụng
 * @throws NotFound nếu gói không tồn tại (được ném từ `deletePlan` Prisma)
 */
export async function deletePlan(id: string) {
  const inUse = await prisma.family.count({ where: { planId: id } })
  if (inUse > 0) throw Errors.BadRequest(`Plan is in use by ${inUse} families. Reassign first.`)
  await prisma.subscriptionPlan.delete({ where: { id } })
}

/**
 * Gán hoặc gỡ gói subscription cho một gia đình (chỉ dùng cho admin).
 *
 * Nếu `planId` là `null`, gia đình sẽ không có gói nào (không nên dùng
 * trực tiếp — nên set về FREE qua payment flow thông thường).
 *
 * @param familyId - ID gia đình cần gán gói
 * @param planId - ID gói cần gán, hoặc `null` để gỡ gói
 * @returns Bản ghi `Family` đã cập nhật kèm thông tin gói
 * @throws NotFound nếu gói không tồn tại (khi planId != null)
 */
export async function assignPlanToFamily(familyId: string, planId: string | null) {
  if (planId) {
    // Validate gói tồn tại trước khi gán
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
 * Được gọi một lần khi server khởi động. Chỉ seed khi bảng hoàn toàn trống,
 * tránh tạo trùng trong môi trường production đã có dữ liệu.
 *
 * Các gói mặc định:
 * - **FREE**: 4 thành viên, 20 task/tháng — dùng thử miễn phí
 * - **BASIC**: 8 thành viên, 100 task/tháng — 49,000 VND/tháng
 * - **PREMIUM**: không giới hạn — 99,000 VND/tháng (có AI, vị trí realtime)
 */
export async function ensureDefaultPlans() {
  const count = await prisma.subscriptionPlan.count()
  // Bỏ qua nếu đã có dữ liệu (chạy lại server không tạo trùng)
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
      maxMembers: null,       // null = không giới hạn số thành viên
      maxTasksPerMonth: null, // null = không giới hạn số task
      features: ['Tất cả tính năng BASIC', 'Chia sẻ vị trí realtime', 'AI Chatbot', 'Hỗ trợ ưu tiên'],
      sortOrder: 2,
    },
  ]

  for (const p of defaults) {
    await createPlan(p)
  }
  console.log(`📦 Seeded ${defaults.length} default subscription plans`)
}
