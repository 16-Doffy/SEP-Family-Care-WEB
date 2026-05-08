import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const passwordHash = await bcrypt.hash('demo1234', 10)

  // ── System Admin ──────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@familycare.app' },
    update: {},
    create: {
      email: 'admin@familycare.app',
      passwordHash,
      displayName: 'System Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })
  console.log(`✅ Admin: ${admin.email}`)

  // ── Demo Family ───────────────────────────────────────────────────────────
  const family = await prisma.family.upsert({
    where: { id: 'demo-family-001' },
    update: {},
    create: {
      id: 'demo-family-001',
      name: 'Gia Đình Nguyễn',
      plan: 'PREMIUM',
    },
  })

  // Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@demo.com' },
    update: {},
    create: {
      email: 'parent@demo.com',
      passwordHash,
      displayName: 'Nguyễn Văn An',
      role: 'PARENT',
    },
  })

  const parentMember = await prisma.familyMember.upsert({
    where: { userId: parent.id },
    update: {},
    create: {
      userId: parent.id,
      familyId: family.id,
      nickname: 'Bố',
    },
  })

  // Child 1
  const child1 = await prisma.user.upsert({
    where: { email: 'minh@demo.com' },
    update: {},
    create: {
      email: 'minh@demo.com',
      passwordHash,
      displayName: 'Nguyễn Minh',
      role: 'CHILD',
    },
  })

  const child1Member = await prisma.familyMember.upsert({
    where: { userId: child1.id },
    update: {},
    create: {
      userId: child1.id,
      familyId: family.id,
      nickname: 'Bé Minh',
    },
  })

  // Child 2
  const child2 = await prisma.user.upsert({
    where: { email: 'lan@demo.com' },
    update: {},
    create: {
      email: 'lan@demo.com',
      passwordHash,
      displayName: 'Nguyễn Lan',
      role: 'CHILD',
    },
  })

  const child2Member = await prisma.familyMember.upsert({
    where: { userId: child2.id },
    update: {},
    create: {
      userId: child2.id,
      familyId: family.id,
      nickname: 'Bé Lan',
    },
  })

  console.log(`✅ Family: ${family.name}`)
  console.log(`   👨 Parent: ${parent.email}`)
  console.log(`   👦 Child1: ${child1.email}`)
  console.log(`   👧 Child2: ${child2.email}`)

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

  const parentWallet = await prisma.wallet.upsert({
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

  const child1Wallet = await prisma.wallet.upsert({
    where: { ownerId: child1Member.id },
    update: {},
    create: {
      familyId: family.id,
      name: 'Ví Bé Minh',
      type: 'PERSONAL',
      balance: 150000,
      ownerId: child1Member.id,
    },
  })

  const child2Wallet = await prisma.wallet.upsert({
    where: { ownerId: child2Member.id },
    update: {},
    create: {
      familyId: family.id,
      name: 'Ví Bé Lan',
      type: 'PERSONAL',
      balance: 200000,
      ownerId: child2Member.id,
    },
  })

  console.log(`✅ Wallets created (Joint: 5,000,000đ)`)

  // ── Sample Transactions ───────────────────────────────────────────────────
  await prisma.transaction.createMany({
    data: [
      {
        fromWalletId: jointWallet.id,
        toWalletId: child1Wallet.id,
        amount: 100000,
        type: 'TRANSFER',
        description: 'Tiền tiêu vặt tuần này',
      },
      {
        fromWalletId: jointWallet.id,
        toWalletId: child2Wallet.id,
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
        assignedToId: child1Member.id,
      },
      {
        familyId: family.id,
        title: 'Dọn dẹp phòng khách',
        description: 'Quét nhà, lau bàn ghế và sắp xếp đồ đạc gọn gàng',
        status: 'IN_PROGRESS',
        reward: 30000,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        createdById: parentMember.id,
        assignedToId: child2Member.id,
      },
      {
        familyId: family.id,
        title: 'Tưới cây trong vườn',
        description: 'Tưới tất cả cây trong vườn vào buổi sáng',
        status: 'SUBMITTED',
        reward: 15000,
        createdById: parentMember.id,
        assignedToId: child1Member.id,
      },
      {
        familyId: family.id,
        title: 'Học bài ôn thi',
        description: 'Ôn tập toán và văn chuẩn bị cho bài kiểm tra',
        status: 'APPROVED',
        reward: 50000,
        createdById: parentMember.id,
        assignedToId: child1Member.id,
      },
    ],
    skipDuplicates: true,
  })

  console.log(`✅ Sample tasks created`)
  console.log('\n🎉 Seed completed!')
  console.log('\nDemo accounts (password: demo1234):')
  console.log('  Admin:  admin@familycare.app')
  console.log('  Parent: parent@demo.com')
  console.log('  Child1: minh@demo.com')
  console.log('  Child2: lan@demo.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
