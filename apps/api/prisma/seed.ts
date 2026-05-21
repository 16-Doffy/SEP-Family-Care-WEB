import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('demo1234', 10)

  // ── System Admin ──────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@familycare.app' },
    update: { passwordHash },
    create: {
      email: 'admin@familycare.app',
      passwordHash,
      displayName: 'System Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })
  console.log(`Admin: ${admin.email}`)

  // ── Subscription Plans (đảm bảo tồn tại trước Family) ────────────────────
  const planSeeds = [
    {
      code: 'FREE',
      name: 'Miễn phí',
      description: 'Dùng thử 14 ngày cho gia đình nhỏ',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'VND',
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
      features: ['Quản lý nhiệm vụ cơ bản', 'Chat gia đình', 'SOS khẩn cấp', 'Tối đa 4 thành viên'],
      sortOrder: 0,
    },
    {
      code: 'BASIC',
      name: 'Cơ bản',
      description: 'Gói tiêu chuẩn cho gia đình',
      price: 49000,
      priceMonthly: 49000,
      priceYearly: 490000,
      currency: 'VND',
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
      features: ['Tất cả tính năng FREE', 'Album ảnh 1GB', 'Lịch gia đình', 'Yêu cầu nạp tiền', 'Quản lý chi tiêu chung'],
      sortOrder: 1,
    },
    {
      code: 'STANDARD',
      name: 'Tiêu chuẩn',
      description: 'Phù hợp gia đình đa thế hệ — có AI cơ bản',
      price: 99000,
      priceMonthly: 99000,
      priceYearly: 990000,
      currency: 'VND',
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
      currency: 'VND',
      billingPeriod: 'MONTHLY',
      durationDays: 30,
      maxMembers: null as number | null,
      maxTasksPerMonth: null as number | null,
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

  for (const p of planSeeds) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        currency: p.currency,
        billingPeriod: p.billingPeriod,
        durationDays: p.durationDays,
        maxMembers: p.maxMembers,
        maxTasksPerMonth: p.maxTasksPerMonth,
        albumStorageMb: p.albumStorageMb,
        systemStorageMb: p.systemStorageMb,
        aiEnabled: p.aiEnabled,
        aiFinanceEnabled: p.aiFinanceEnabled,
        advancedReports: p.advancedReports,
        prioritySupport: p.prioritySupport,
        tier: p.tier,
        features: p.features,
        sortOrder: p.sortOrder,
        isActive: true,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        price: p.price,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        currency: p.currency,
        billingPeriod: p.billingPeriod,
        durationDays: p.durationDays,
        maxMembers: p.maxMembers,
        maxTasksPerMonth: p.maxTasksPerMonth,
        albumStorageMb: p.albumStorageMb,
        systemStorageMb: p.systemStorageMb,
        aiEnabled: p.aiEnabled,
        aiFinanceEnabled: p.aiFinanceEnabled,
        advancedReports: p.advancedReports,
        prioritySupport: p.prioritySupport,
        tier: p.tier,
        features: p.features,
        sortOrder: p.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`Subscription plans seeded: ${planSeeds.length}`)

  const premiumPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'PREMIUM' } })

  // ── Demo Family (đã active sẵn để chạy demo) ─────────────────────────────
  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  const family = await prisma.family.upsert({
    where: { id: 'demo-family-001' },
    update: {
      planId: premiumPlan.id,
      subscriptionStatus: 'ACTIVE',
      subscriptionStartedAt: now,
      subscriptionExpiresAt: oneYearLater,
      activatedAt: now,
      onboardingStep: 'ACTIVE',
    },
    create: {
      id: 'demo-family-001',
      name: 'Gia Đình Nguyễn',
      plan: 'PREMIUM',
      planId: premiumPlan.id,
      subscriptionStatus: 'ACTIVE',
      subscriptionStartedAt: now,
      subscriptionExpiresAt: oneYearLater,
      activatedAt: now,
      onboardingStep: 'ACTIVE',
    },
  })

  // Parent (chủ hộ / head of household)
  const parent = await prisma.user.upsert({
    where: { email: 'parent@demo.com' },
    update: { passwordHash, role: 'PARENT' },
    create: {
      email: 'parent@demo.com',
      passwordHash,
      displayName: 'Nguyễn Văn An',
      role: 'PARENT',
    },
  })

  const parentMember = await prisma.familyMember.upsert({
    where: { userId: parent.id },
    update: { isOwner: true, relationship: 'FATHER' },
    create: {
      userId: parent.id,
      familyId: family.id,
      nickname: 'Bố',
      relationship: 'FATHER',
      isOwner: true,
    },
  })

  // Family Member 1 (con — Minh)
  const member1 = await prisma.user.upsert({
    where: { email: 'minh@demo.com' },
    update: { passwordHash, role: 'FAMILY_MEMBER' },
    create: {
      email: 'minh@demo.com',
      passwordHash,
      displayName: 'Nguyễn Minh',
      role: 'FAMILY_MEMBER',
    },
  })

  const member1Member = await prisma.familyMember.upsert({
    where: { userId: member1.id },
    update: { relationship: 'CHILD' },
    create: {
      userId: member1.id,
      familyId: family.id,
      nickname: 'Anh Minh',
      relationship: 'CHILD',
    },
  })

  // Family Member 2 (em — Lan)
  const member2 = await prisma.user.upsert({
    where: { email: 'lan@demo.com' },
    update: { passwordHash, role: 'FAMILY_MEMBER' },
    create: {
      email: 'lan@demo.com',
      passwordHash,
      displayName: 'Nguyễn Lan',
      role: 'FAMILY_MEMBER',
    },
  })

  const member2Member = await prisma.familyMember.upsert({
    where: { userId: member2.id },
    update: { relationship: 'CHILD' },
    create: {
      userId: member2.id,
      familyId: family.id,
      nickname: 'Bé Lan',
      relationship: 'CHILD',
    },
  })

  console.log(`Family: ${family.name}`)
  console.log(`   Parent: ${parent.email}`)
  console.log(`   Member1: ${member1.email}`)
  console.log(`   Member2: ${member2.email}`)

  // ── Wallets ───────────────────────────────────────────────────────────────
  const jointWallet = await prisma.wallet.upsert({
    where: { id: 'wallet-joint-001' },
    update: {},
    create: {
      id: 'wallet-joint-001',
      familyId: family.id,
      name: 'Ví Gia Đình',
      type: 'JOINT',
      balance: 5000000,
    },
  })

  await prisma.wallet.upsert({
    where: { ownerId: parentMember.id },
    update: {},
    create: {
      familyId: family.id,
      name: 'Ví Bố',
      type: 'PERSONAL',
      balance: 500000,
      ownerId: parentMember.id,
    },
  })

  const member1Wallet = await prisma.wallet.upsert({
    where: { ownerId: member1Member.id },
    update: {},
    create: {
      familyId: family.id,
      name: 'Ví Minh',
      type: 'PERSONAL',
      balance: 150000,
      ownerId: member1Member.id,
    },
  })

  const member2Wallet = await prisma.wallet.upsert({
    where: { ownerId: member2Member.id },
    update: {},
    create: {
      familyId: family.id,
      name: 'Ví Lan',
      type: 'PERSONAL',
      balance: 200000,
      ownerId: member2Member.id,
    },
  })

  console.log('Wallets created (Joint: 5,000,000đ)')

  // ── Sample Transactions ───────────────────────────────────────────────────
  await prisma.transaction.createMany({
    data: [
      {
        fromWalletId: jointWallet.id,
        toWalletId: member1Wallet.id,
        amount: 100000,
        type: 'TRANSFER',
        description: 'Tiền tiêu vặt tuần này',
      },
      {
        fromWalletId: jointWallet.id,
        toWalletId: member2Wallet.id,
        amount: 150000,
        type: 'TRANSFER',
        description: 'Tiền học phí bơi lội',
      },
      {
        toWalletId: jointWallet.id,
        amount: 2000000,
        type: 'DEPOSIT',
        description: 'Nạp tiền lương tháng 1',
      },
    ],
    skipDuplicates: true,
  })

  // ── Sample Tasks ──────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      {
        familyId: family.id,
        title: 'Rửa bát sau bữa tối',
        description: 'Rửa sạch và úp khô tất cả bát đĩa sau bữa tối',
        status: 'PENDING',
        reward: 20000,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdById: parentMember.id,
        assignedToId: member1Member.id,
      },
      {
        familyId: family.id,
        title: 'Dọn dẹp phòng khách',
        description: 'Quét nhà, lau bàn ghế và sắp xếp đồ đạc gọn gàng',
        status: 'IN_PROGRESS',
        reward: 30000,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        createdById: parentMember.id,
        assignedToId: member2Member.id,
      },
      {
        familyId: family.id,
        title: 'Tưới cây trong vườn',
        description: 'Tưới tất cả cây trong vườn vào buổi sáng',
        status: 'SUBMITTED',
        reward: 15000,
        createdById: parentMember.id,
        assignedToId: member1Member.id,
      },
      {
        familyId: family.id,
        title: 'Học bài ôn thi',
        description: 'Ôn tập toán và văn chuẩn bị cho bài kiểm tra',
        status: 'APPROVED',
        reward: 50000,
        createdById: parentMember.id,
        assignedToId: member1Member.id,
      },
    ],
    skipDuplicates: true,
  })

  console.log('Sample tasks created')
  console.log('\nSeed completed!')
  console.log('\nDemo accounts (password: demo1234):')
  console.log('  Admin:         admin@familycare.app')
  console.log('  Parent:        parent@demo.com')
  console.log('  Family Member: minh@demo.com')
  console.log('  Family Member: lan@demo.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
