import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function upsertUser(input: {
  id: string
  email: string
  displayName: string
  role: 'SUPER_ADMIN' | 'PARENT' | 'FAMILY_MEMBER'
  passwordHash: string
  phoneNumber?: string
  userType?: 'NORMAL_USER' | 'SYSTEM_ADMIN'
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role,
      phoneNumber: input.phoneNumber,
      userType: input.userType ?? 'NORMAL_USER',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      isActive: true,
      lastLoginAt: new Date(),
    },
    create: {
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role,
      phoneNumber: input.phoneNumber,
      userType: input.userType ?? 'NORMAL_USER',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      isActive: true,
      lastLoginAt: new Date(),
    },
  })
}

async function main() {
  console.log('Seeding ERD demo data...')

  const passwordHash = await bcrypt.hash('demo1234', 10)
  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  const admin = await upsertUser({
    id: 'user-system-admin',
    email: 'admin@familycare.app',
    displayName: 'System Admin',
    role: 'SUPER_ADMIN',
    userType: 'SYSTEM_ADMIN',
    passwordHash,
  })

  const plans = [
    {
      code: 'FREE',
      name: 'Free',
      description: 'Core family workspace for demo onboarding.',
      price: 0,
      priceYearly: 0,
      billingPeriod: 'FREE',
      durationDays: 14,
      tier: 0,
      maxMembers: 4,
      maxTasksPerMonth: 20,
      albumStorageMb: 100,
      systemStorageMb: 200,
      aiEnabled: false,
      aiFinanceEnabled: false,
      advancedReports: false,
      prioritySupport: false,
      features: ['Family workspace', 'Internal ledger', 'Task tracking', 'SOS'],
      sortOrder: 0,
    },
    {
      code: 'PLUS_ANNUAL',
      name: 'Plus Annual',
      description: 'Annual plan for growing families.',
      price: 490000,
      priceYearly: 490000,
      billingPeriod: 'YEARLY',
      durationDays: 365,
      tier: 1,
      maxMembers: 8,
      maxTasksPerMonth: 200,
      albumStorageMb: 1024,
      systemStorageMb: 2048,
      aiEnabled: false,
      aiFinanceEnabled: false,
      advancedReports: false,
      prioritySupport: false,
      features: ['Shared budget', 'Recurring tasks', 'Wearable SOS demo'],
      sortOrder: 1,
    },
    {
      code: 'PREMIUM_ANNUAL',
      name: 'Premium Annual',
      description: 'Annual plan with finance insights and priority support.',
      price: 1990000,
      priceYearly: 1990000,
      billingPeriod: 'YEARLY',
      durationDays: 365,
      tier: 3,
      maxMembers: null,
      maxTasksPerMonth: null,
      albumStorageMb: 51200,
      systemStorageMb: 102400,
      aiEnabled: true,
      aiFinanceEnabled: true,
      advancedReports: true,
      prioritySupport: true,
      features: ['AI finance', 'Advanced reports', 'Unlimited members', 'Priority support'],
      sortOrder: 2,
    },
  ]

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        ...plan,
        priceMonthly: null,
        currency: 'VND',
        isActive: true,
      },
      create: {
        ...plan,
        priceMonthly: null,
        currency: 'VND',
        isActive: true,
      },
    })
  }

  const premiumPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'PREMIUM_ANNUAL' } })

  const manager = await upsertUser({
    id: 'user-manager-demo',
    email: 'manager@demo.com',
    displayName: 'Nguyen Van An',
    role: 'PARENT',
    phoneNumber: '+84900000001',
    passwordHash,
  })
  const deputy = await upsertUser({
    id: 'user-deputy-demo',
    email: 'deputy@demo.com',
    displayName: 'Tran Thu Ha',
    role: 'PARENT',
    phoneNumber: '+84900000002',
    passwordHash,
  })
  const minh = await upsertUser({
    id: 'user-minh-demo',
    email: 'minh@demo.com',
    displayName: 'Nguyen Minh',
    role: 'FAMILY_MEMBER',
    phoneNumber: '+84900000003',
    passwordHash,
  })
  const lan = await upsertUser({
    id: 'user-lan-demo',
    email: 'lan@demo.com',
    displayName: 'Nguyen Lan',
    role: 'FAMILY_MEMBER',
    phoneNumber: '+84900000004',
    passwordHash,
  })

  const family = await prisma.family.upsert({
    where: { id: 'demo-family-001' },
    update: {
      name: 'Nguyen Family Workspace',
      description: 'ERD-aligned demo workspace',
      createdByUserId: manager.id,
      plan: 'PREMIUM',
      planId: premiumPlan.id,
      status: 'ACTIVE',
      activationStatus: 'READY',
      subscriptionStatus: 'ACTIVE',
      subscriptionStartedAt: now,
      subscriptionExpiresAt: oneYearLater,
      activatedAt: now,
      onboardingStep: 'ACTIVE',
    },
    create: {
      id: 'demo-family-001',
      name: 'Nguyen Family Workspace',
      description: 'ERD-aligned demo workspace',
      createdByUserId: manager.id,
      plan: 'PREMIUM',
      planId: premiumPlan.id,
      status: 'ACTIVE',
      activationStatus: 'READY',
      subscriptionStatus: 'ACTIVE',
      subscriptionStartedAt: now,
      subscriptionExpiresAt: oneYearLater,
      activatedAt: now,
      onboardingStep: 'ACTIVE',
    },
  })

  const managerMember = await prisma.familyMember.upsert({
    where: { userId: manager.id },
    update: { familyId: family.id, displayName: manager.displayName, familyRole: 'FAMILY_MANAGER', relationship: 'FATHER', memberStatus: 'ACTIVE', isOwner: true },
    create: { id: 'member-manager-demo', userId: manager.id, familyId: family.id, displayName: manager.displayName, familyRole: 'FAMILY_MANAGER', relationship: 'FATHER', nickname: 'Dad', memberStatus: 'ACTIVE', isOwner: true },
  })
  const deputyMember = await prisma.familyMember.upsert({
    where: { userId: deputy.id },
    update: { familyId: family.id, displayName: deputy.displayName, familyRole: 'DEPUTY_MEMBER', relationship: 'MOTHER', memberStatus: 'ACTIVE', isOwner: false },
    create: { id: 'member-deputy-demo', userId: deputy.id, familyId: family.id, displayName: deputy.displayName, familyRole: 'DEPUTY_MEMBER', relationship: 'MOTHER', nickname: 'Mom', memberStatus: 'ACTIVE', isOwner: false },
  })
  const minhMember = await prisma.familyMember.upsert({
    where: { userId: minh.id },
    update: { familyId: family.id, displayName: minh.displayName, familyRole: 'FAMILY_MEMBER', relationship: 'CHILD', memberStatus: 'ACTIVE' },
    create: { id: 'member-minh-demo', userId: minh.id, familyId: family.id, displayName: minh.displayName, familyRole: 'FAMILY_MEMBER', relationship: 'CHILD', nickname: 'Minh', memberStatus: 'ACTIVE' },
  })
  const lanMember = await prisma.familyMember.upsert({
    where: { userId: lan.id },
    update: { familyId: family.id, displayName: lan.displayName, familyRole: 'FAMILY_MEMBER', relationship: 'CHILD', memberStatus: 'ACTIVE' },
    create: { id: 'member-lan-demo', userId: lan.id, familyId: family.id, displayName: lan.displayName, familyRole: 'FAMILY_MEMBER', relationship: 'CHILD', nickname: 'Lan', memberStatus: 'ACTIVE' },
  })

  await prisma.workspaceSubscription.upsert({
    where: { id: 'workspace-sub-demo' },
    update: { familyId: family.id, planId: premiumPlan.id, status: 'ACTIVE', startedAt: now, expiresAt: oneYearLater, activatedAt: now },
    create: { id: 'workspace-sub-demo', familyId: family.id, planId: premiumPlan.id, status: 'ACTIVE', startedAt: now, expiresAt: oneYearLater, activatedAt: now },
  })
  await prisma.workspaceProvisioningLog.create({
    data: { familyId: family.id, status: 'READY', message: 'Demo workspace provisioned with shared runtime.' },
  })

  await prisma.wallet.upsert({
    where: { id: 'wallet-joint-001' },
    update: { name: 'So quy gia dinh compat', balance: 5000000 },
    create: { id: 'wallet-joint-001', familyId: family.id, name: 'So quy gia dinh compat', type: 'JOINT', balance: 5000000 },
  })
  for (const member of [managerMember, deputyMember, minhMember, lanMember]) {
    await prisma.wallet.upsert({
      where: { ownerId: member.id },
      update: { name: `So ghi nhan ca nhan ${member.displayName ?? member.nickname ?? ''}`.trim() },
      create: { familyId: family.id, ownerId: member.id, name: `So ghi nhan ca nhan ${member.displayName ?? member.nickname ?? ''}`.trim(), type: 'PERSONAL', balance: 0 },
    })
  }

  const ledger = await prisma.financeLedger.upsert({
    where: { id: 'ledger-family-demo' },
    update: { name: 'Family Internal Ledger', openingAmount: 5000000, status: 'ACTIVE' },
    create: { id: 'ledger-family-demo', familyId: family.id, name: 'Family Internal Ledger', type: 'FAMILY_SHARED', openingAmount: 5000000, status: 'ACTIVE', note: 'Internal ledger only, not an e-wallet.' },
  })
  const educationCategory = await prisma.financeCategory.upsert({
    where: { familyId_name_type: { familyId: family.id, name: 'Education', type: 'EXPENSE' } },
    update: { color: '#2563eb', isSystem: true },
    create: { familyId: family.id, name: 'Education', type: 'EXPENSE', color: '#2563eb', isSystem: true },
  })
  const allowanceCategory = await prisma.financeCategory.upsert({
    where: { familyId_name_type: { familyId: family.id, name: 'Allowance Support', type: 'EXPENSE' } },
    update: { color: '#0f766e', isSystem: true },
    create: { familyId: family.id, name: 'Allowance Support', type: 'EXPENSE', color: '#0f766e', isSystem: true },
  })

  const financeModel = await prisma.financeModel.upsert({
    where: { id: 'finance-model-demo' },
    update: { name: 'Five Jars Demo', type: 'FIVE_JARS', status: 'ACTIVE' },
    create: { id: 'finance-model-demo', familyId: family.id, createdById: managerMember.id, name: 'Five Jars Demo', type: 'FIVE_JARS', status: 'ACTIVE' },
  })
  await prisma.financeJar.upsert({
    where: { id: 'finance-jar-education-demo' },
    update: { ledgerId: ledger.id, allocationRatio: 20 },
    create: { id: 'finance-jar-education-demo', modelId: financeModel.id, ledgerId: ledger.id, name: 'Education', allocationRatio: 20, color: '#2563eb', sortOrder: 1 },
  })

  const budgetPlan = await prisma.budgetPlan.upsert({
    where: { id: 'budget-plan-demo' },
    update: { name: 'Monthly Family Budget', status: 'ACTIVE' },
    create: { id: 'budget-plan-demo', familyId: family.id, createdById: managerMember.id, name: 'Monthly Family Budget', periodType: 'MONTHLY', startDate: new Date(now.getFullYear(), now.getMonth(), 1), status: 'ACTIVE' },
  })
  const budgetLine = await prisma.budgetLine.upsert({
    where: { id: 'budget-line-education-demo' },
    update: { plannedAmount: 2000000, actualAmount: 650000 },
    create: { id: 'budget-line-education-demo', budgetPlanId: budgetPlan.id, categoryId: educationCategory.id, name: 'Education costs', plannedAmount: 2000000, actualAmount: 650000, essentialType: 'ESSENTIAL' },
  })
  const goal = await prisma.financialGoal.upsert({
    where: { id: 'goal-school-demo' },
    update: { currentAmount: 1500000, status: 'ACTIVE' },
    create: { id: 'goal-school-demo', familyId: family.id, ledgerId: ledger.id, createdById: deputyMember.id, title: 'School supplies fund', targetAmount: 5000000, currentAmount: 1500000, status: 'ACTIVE' },
  })

  await prisma.ledgerEntry.upsert({
    where: { id: 'ledger-entry-income-demo' },
    update: { amount: 5000000 },
    create: { id: 'ledger-entry-income-demo', ledgerId: ledger.id, recordedById: managerMember.id, type: 'CONTRIBUTION', amount: 5000000, title: 'Monthly family contribution', sourceType: 'MANUAL' },
  })
  await prisma.ledgerEntry.upsert({
    where: { id: 'ledger-entry-education-demo' },
    update: { amount: 650000 },
    create: { id: 'ledger-entry-education-demo', ledgerId: ledger.id, recordedById: deputyMember.id, categoryId: educationCategory.id, budgetLineId: budgetLine.id, type: 'EXPENSE', amount: 650000, title: 'School books', essentialType: 'ESSENTIAL', sourceType: 'MANUAL' },
  })
  await prisma.goalAllocation.upsert({
    where: { id: 'goal-allocation-demo' },
    update: { amount: 1500000 },
    create: { id: 'goal-allocation-demo', goalId: goal.id, actorId: deputyMember.id, amount: 1500000, note: 'Initial allocation' },
  })

  const support = await prisma.spendingSupportRequest.upsert({
    where: { id: 'support-request-demo' },
    update: { status: 'APPROVED', reviewedById: managerMember.id, reviewedAt: now },
    create: { id: 'support-request-demo', familyId: family.id, requesterId: minhMember.id, reviewedById: managerMember.id, amount: 120000, reason: 'School project materials', status: 'APPROVED', managerNote: 'Approved as internal support record.', reviewedAt: now },
  })
  await prisma.ledgerEntry.upsert({
    where: { id: 'ledger-entry-support-demo' },
    update: { amount: 120000 },
    create: { id: 'ledger-entry-support-demo', ledgerId: ledger.id, recordedById: managerMember.id, categoryId: allowanceCategory.id, supportRequestId: support.id, type: 'SUPPORT', amount: 120000, title: 'Approved spending support', sourceType: 'SUPPORT_REQUEST' },
  })

  const taskCategory = await prisma.taskCategory.upsert({
    where: { familyId_name: { familyId: family.id, name: 'Household Chores' } },
    update: { color: '#16a34a', isActive: true },
    create: { familyId: family.id, name: 'Household Chores', color: '#16a34a', isActive: true },
  })
  const task = await prisma.task.upsert({
    where: { id: 'task-approved-demo' },
    update: { status: 'APPROVED', reward: 50000, categoryId: taskCategory.id },
    create: { id: 'task-approved-demo', familyId: family.id, categoryId: taskCategory.id, title: 'Clean the living room', description: 'Completed and approved; reward awaits outside-system settlement.', taskType: 'AD_HOC', priority: 'MEDIUM', status: 'APPROVED', reward: 50000, createdById: managerMember.id, assignedToId: minhMember.id },
  })
  const assignment = await prisma.taskAssignment.upsert({
    where: { taskId_assignedToId: { taskId: task.id, assignedToId: minhMember.id } },
    update: { status: 'APPROVED' },
    create: { taskId: task.id, assignedToId: minhMember.id, assignedById: managerMember.id, status: 'APPROVED', startedAt: now, completedAt: now },
  })
  const submission = await prisma.taskSubmission.upsert({
    where: { id: 'task-submission-demo' },
    update: { status: 'APPROVED', reviewedById: managerMember.id, reviewedAt: now },
    create: { id: 'task-submission-demo', taskId: task.id, assignmentId: assignment.id, submittedById: minhMember.id, reviewedById: managerMember.id, status: 'APPROVED', note: 'Submitted with photo proof.', reviewedAt: now },
  })
  await prisma.taskProof.upsert({
    where: { id: 'task-proof-demo' },
    update: { submissionId: submission.id, note: 'Clean room photo proof' },
    create: { id: 'task-proof-demo', taskId: task.id, submissionId: submission.id, submittedBy: minh.id, proofType: 'IMAGE', imageUrl: 'https://placehold.co/800x600?text=Task+Proof', note: 'Clean room photo proof' },
  })
  await prisma.rewardSetting.upsert({
    where: { taskId: task.id },
    update: { amount: 50000, rewardType: 'MONEY_RECORD' },
    create: { taskId: task.id, rewardType: 'MONEY_RECORD', amount: 50000, description: 'Internal reward record only.' },
  })
  const settlement = await prisma.rewardSettlement.upsert({
    where: { taskId_receiverId: { taskId: task.id, receiverId: minhMember.id } },
    update: { amount: 50000, status: 'PENDING_SETTLEMENT' },
    create: { taskId: task.id, receiverId: minhMember.id, amount: 50000, rewardType: 'MONEY_RECORD', status: 'PENDING_SETTLEMENT', note: 'Reward settlement is handled outside the system.' },
  })
  await prisma.ledgerEntry.upsert({
    where: { id: 'ledger-entry-reward-demo' },
    update: { amount: 50000 },
    create: { id: 'ledger-entry-reward-demo', ledgerId: ledger.id, recordedById: managerMember.id, rewardSettlementId: settlement.id, type: 'REWARD', amount: 50000, title: 'Task reward record pending settlement', sourceType: 'TASK_REWARD' },
  })

  const sosSetting = await prisma.sOSSetting.upsert({
    where: { familyId: family.id },
    update: { autoNotifyEnabled: true, fallDetectionEnabled: true, locationTrackingEnabled: true },
    create: { familyId: family.id, createdById: managerMember.id, autoNotifyEnabled: true, fallDetectionEnabled: true, locationTrackingEnabled: true, emergencyMessage: 'Family SOS demo alert.' },
  })
  await prisma.emergencyContact.upsert({
    where: { id: 'emergency-contact-demo' },
    update: { name: deputy.displayName, phoneNumber: deputy.phoneNumber },
    create: { id: 'emergency-contact-demo', settingId: sosSetting.id, name: deputy.displayName, phoneNumber: deputy.phoneNumber, relationship: 'MOTHER', priority: 1 },
  })
  const legacyDevice = await prisma.device.upsert({
    where: { deviceCode: 'FC-WATCH-LAN-001' },
    update: { familyId: family.id, ownerUserId: lan.id, status: 'ACTIVE', batteryLevel: 86, lastLatitude: 10.841912, lastLongitude: 106.809812, lastSeenAt: now },
    create: { familyId: family.id, ownerUserId: lan.id, name: 'Lan SOS Watch compat', type: 'SMARTWATCH', deviceCode: 'FC-WATCH-LAN-001', status: 'ACTIVE', batteryLevel: 86, lastLatitude: 10.841912, lastLongitude: 106.809812, lastSeenAt: now },
  })
  const wearable = await prisma.wearableDevice.upsert({
    where: { deviceCode: 'ERD-WATCH-LAN-001' },
    update: { memberId: lanMember.id, legacyDeviceId: legacyDevice.id, status: 'ACTIVE', batteryLevel: 86, lastSeenAt: now },
    create: { familyId: family.id, memberId: lanMember.id, legacyDeviceId: legacyDevice.id, name: 'Lan SOS Watch', deviceCode: 'ERD-WATCH-LAN-001', status: 'ACTIVE', batteryLevel: 86, lastSeenAt: now },
  })
  await prisma.memberLocationPoint.upsert({
    where: { id: 'member-location-lan-demo' },
    update: { latitude: 10.841912, longitude: 106.809812 },
    create: { id: 'member-location-lan-demo', familyId: family.id, memberId: lanMember.id, wearableDeviceId: wearable.id, latitude: 10.841912, longitude: 106.809812, accuracy: 12, source: 'WEARABLE_GPS' },
  })
  const sosAlert = await prisma.sosAlert.upsert({
    where: { id: 'sos-alert-demo' },
    update: { status: 'ACKNOWLEDGED', wearableDeviceId: wearable.id, triggeredByMemberId: lanMember.id },
    create: { id: 'sos-alert-demo', familyId: family.id, senderId: lan.id, triggeredByMemberId: lanMember.id, wearableDeviceId: wearable.id, latitude: 10.841912, longitude: 106.809812, address: 'Thu Duc, Ho Chi Minh City', message: 'Demo SOS from wearable', source: 'WEARABLE', fallDetected: true, severity: 'HIGH', status: 'ACKNOWLEDGED' },
  })
  await prisma.sensorEvent.upsert({
    where: { id: 'sensor-event-demo' },
    update: { severity: 'HIGH' },
    create: { id: 'sensor-event-demo', familyId: family.id, wearableDeviceId: wearable.id, sosAlertId: sosAlert.id, type: 'FALL_DETECTED', severity: 'HIGH', value: { acceleration: 2.8 } },
  })
  await prisma.sOSLocationPoint.upsert({
    where: { id: 'sos-location-demo' },
    update: { latitude: 10.841912, longitude: 106.809812 },
    create: { id: 'sos-location-demo', familyId: family.id, sosAlertId: sosAlert.id, wearableDeviceId: wearable.id, latitude: 10.841912, longitude: 106.809812, accuracy: 12, address: 'Thu Duc, Ho Chi Minh City', source: 'WEARABLE_GPS' },
  })
  await prisma.sOSResponse.upsert({
    where: { id: 'sos-response-demo' },
    update: { type: 'VIEWED', responderId: managerMember.id },
    create: { id: 'sos-response-demo', familyId: family.id, sosAlertId: sosAlert.id, responderId: managerMember.id, type: 'VIEWED', note: 'Manager viewed the SOS alert.' },
  })

  // ─── ERD-completion demo data ───────────────────────────────────────────────

  // MemberMonthlyFinance: khai báo tài chính cá nhân theo tháng.
  const period = { periodMonth: now.getMonth() + 1, periodYear: now.getFullYear() }
  await prisma.memberMonthlyFinance.upsert({
    where: { memberId_periodMonth_periodYear: { memberId: managerMember.id, ...period } },
    update: { expectedIncome: 25000000, actualIncome: 24000000, expectedPersonalExpense: 6000000, actualPersonalExpense: 5200000 },
    create: { memberId: managerMember.id, ...period, expectedIncome: 25000000, actualIncome: 24000000, expectedPersonalExpense: 6000000, actualPersonalExpense: 5200000, incomeVisibility: 'SUMMARY_TO_MANAGER', expenseVisibility: 'PRIVATE', note: 'Manager monthly declaration.' },
  })
  await prisma.memberMonthlyFinance.upsert({
    where: { memberId_periodMonth_periodYear: { memberId: minhMember.id, ...period } },
    update: { actualPersonalExpense: 300000 },
    create: { memberId: minhMember.id, ...period, expectedIncome: 0, actualIncome: 0, expectedPersonalExpense: 500000, actualPersonalExpense: 300000, incomeVisibility: 'PRIVATE', expenseVisibility: 'PRIVATE', note: 'Dependent member: personal expense only.' },
  })

  // TaskSchedule: lịch lặp demo gắn vào task hiện có.
  await prisma.taskSchedule.upsert({
    where: { taskId: task.id },
    update: { repeatType: 'WEEKLY', repeatInterval: 1 },
    create: { taskId: task.id, repeatType: 'WEEKLY', repeatInterval: 1, startDate: new Date(now.getFullYear(), now.getMonth(), 1), dayOfWeek: 6, status: 'ACTIVE' },
  })

  // Link reward settlement ↔ submission/setting (ERD fields).
  const rewardSetting = await prisma.rewardSetting.findUnique({ where: { taskId: task.id } })
  await prisma.rewardSettlement.update({
    where: { id: settlement.id },
    data: { taskSubmissionId: submission.id, rewardSettingId: rewardSetting?.id, externalMethod: 'CASH', externalNote: 'Parent will hand cash after the weekend.' },
  })

  // SpendingSupportRequest: ERD category/purpose/decisionNote.
  await prisma.spendingSupportRequest.update({
    where: { id: support.id },
    data: { categoryId: allowanceCategory.id, purpose: 'School project materials', decisionNote: 'Approved as internal support record.' },
  })

  // Conversation + Message + MessageAttachment.
  const conversation = await prisma.conversation.upsert({
    where: { id: 'conversation-demo' },
    update: { name: 'Family Group', status: 'ACTIVE' },
    create: { id: 'conversation-demo', familyId: family.id, createdByMemberId: managerMember.id, type: 'GROUP', name: 'Family Group', status: 'ACTIVE' },
  })
  for (const u of [manager, deputy, minh, lan]) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId: u.id } },
      update: { participantStatus: 'ACTIVE' },
      create: { conversationId: conversation.id, userId: u.id, participantStatus: 'ACTIVE' },
    })
  }
  const message = await prisma.message.upsert({
    where: { id: 'message-demo' },
    update: { content: 'Here is the receipt for the school books.' },
    create: { id: 'message-demo', conversationId: conversation.id, senderId: deputy.id, type: 'FILE', content: 'Here is the receipt for the school books.' },
  })
  await prisma.messageAttachment.upsert({
    where: { id: 'message-attachment-demo' },
    update: { fileUrl: 'https://placehold.co/600x800?text=Receipt' },
    create: { id: 'message-attachment-demo', messageId: message.id, fileType: 'image/png', fileUrl: 'https://placehold.co/600x800?text=Receipt', fileName: 'receipt.png', fileSize: 84211 },
  })

  // CalendarEvent + participants.
  const event = await prisma.familyEvent.upsert({
    where: { id: 'event-demo' },
    update: { title: 'Family Dinner', status: 'ACTIVE' },
    create: { id: 'event-demo', familyId: family.id, createdById: managerMember.id, title: 'Family Dinner', description: 'Weekly family dinner', location: 'Home', startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 18, 0), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 20, 0), isRecurring: true, status: 'ACTIVE' },
  })
  for (const m of [managerMember, deputyMember, minhMember, lanMember]) {
    await prisma.calendarEventParticipant.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: m.id } },
      update: { responseStatus: 'ACCEPTED' },
      create: { eventId: event.id, memberId: m.id, responseStatus: m.id === managerMember.id ? 'ACCEPTED' : 'INVITED', reminderEnabled: true },
    })
  }

  // AlbumPhoto + manual tag + moderation check.
  const albumCategory = await prisma.albumCategory.upsert({
    where: { familyId_name: { familyId: family.id, name: 'Family Moments' } },
    update: {},
    create: { familyId: family.id, name: 'Family Moments', createdById: managerMember.id },
  })
  const photo = await prisma.albumPhoto.upsert({
    where: { id: 'album-photo-demo' },
    update: { caption: 'Family dinner 2026' },
    create: { id: 'album-photo-demo', familyId: family.id, uploaderId: deputyMember.id, categoryId: albumCategory.id, mediaType: 'PHOTO', imageUrl: 'https://placehold.co/1024x768?text=Family', thumbnailUrl: 'https://placehold.co/256x192?text=Family', caption: 'Family dinner 2026', visibilityScope: 'FAMILY', moderationStatus: 'SAFE' },
  })
  await prisma.albumMediaTag.upsert({
    where: { mediaId_taggedMemberId: { mediaId: photo.id, taggedMemberId: minhMember.id } },
    update: { tagNote: 'Minh' },
    create: { mediaId: photo.id, taggedMemberId: minhMember.id, taggedByMemberId: deputyMember.id, tagNote: 'Minh' },
  })
  await prisma.mediaModerationCheck.upsert({
    where: { id: 'media-check-demo' },
    update: { resultStatus: 'SAFE' },
    create: { id: 'media-check-demo', mediaId: photo.id, checkType: 'SENSITIVE_CONTENT', resultStatus: 'SAFE', confidenceScore: 0.0123 },
  })

  // Enrich wearable with ERD device fields.
  await prisma.wearableDevice.update({
    where: { id: wearable.id },
    data: { deviceType: 'SMARTWATCH', deviceIdentifier: 'BLE-LAN-7788', pairingStatus: 'PAIRED', gpsEnabled: true, sosEnabled: true },
  })

  console.log('Seed completed.')
  console.log('Demo accounts, password: demo1234')
  console.log(`  Admin:   ${admin.email}`)
  console.log(`  Manager: ${manager.email}`)
  console.log(`  Deputy:  ${deputy.email}`)
  console.log(`  Member:  ${minh.email}`)
  console.log(`  Member:  ${lan.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
