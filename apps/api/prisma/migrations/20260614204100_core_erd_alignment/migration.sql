-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('NORMAL_USER', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'PENDING');

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('FAMILY_MANAGER', 'DEPUTY_MEMBER', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "FinanceLedgerType" AS ENUM ('FAMILY_SHARED', 'PERSONAL');

-- CreateEnum
CREATE TYPE "FinanceLedgerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE', 'CONTRIBUTION', 'ALLOWANCE', 'REWARD', 'SUPPORT');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "EssentialType" AS ENUM ('ESSENTIAL', 'NON_ESSENTIAL', 'NA');

-- CreateEnum
CREATE TYPE "FinanceEntrySourceType" AS ENUM ('MANUAL', 'TASK_REWARD', 'SUPPORT_REQUEST', 'AI_OCR_SUGGESTION');

-- CreateEnum
CREATE TYPE "FinanceModelType" AS ENUM ('FIVE_JARS', 'EIGHTY_TWENTY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FinanceModelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('FAMILY', 'MANAGER_ONLY', 'MEMBER_PRIVATE');

-- CreateEnum
CREATE TYPE "FinanceCategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BudgetPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FinancialGoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'CANCELED', 'AT_RISK');

-- CreateEnum
CREATE TYPE "SpendingSupportRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BudgetAlertType" AS ENUM ('OVER_BUDGET', 'GOAL_AT_RISK', 'NON_ESSENTIAL_TOO_HIGH');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('AD_HOC', 'RECURRING');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('WAITING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('IMAGE', 'VIDEO', 'NOTE', 'FILE');

-- CreateEnum
CREATE TYPE "UnavailabilityStatus" AS ENUM ('REPORTED', 'HANDLED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('MONEY_RECORD', 'POINT', 'OTHER');

-- CreateEnum
CREATE TYPE "RewardSettlementStatus" AS ENUM ('PENDING_SETTLEMENT', 'WAITING_CONFIRMATION', 'SETTLED', 'DISPUTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExternalSettlementMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'THIRD_PARTY_WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "RewardDisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SosSettingResponseType" AS ENUM ('VIEWED', 'CONFIRM_SAFE', 'NEED_HELP', 'RESOLVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SensorEventType" AS ENUM ('SOS_BUTTON_PRESSED', 'FALL_DETECTED', 'HARD_IMPACT', 'ABNORMAL_MOVEMENT');

-- CreateEnum
CREATE TYPE "LocationSourceType" AS ENUM ('MOBILE_GPS', 'WEARABLE_GPS', 'SIMULATED_GPS');

-- AlterTable
ALTER TABLE "AlbumPhoto" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "activationStatus" "FamilyProvisionStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "familyRole" "FamilyRole" NOT NULL DEFAULT 'FAMILY_MEMBER',
ADD COLUMN     "leftAt" TIMESTAMP(3),
ADD COLUMN     "memberStatus" "MemberStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "SosAlert" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedByMemberId" TEXT,
ADD COLUMN     "severity" "AlertSeverity" NOT NULL DEFAULT 'HIGH',
ADD COLUMN     "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "triggeredByMemberId" TEXT,
ADD COLUMN     "wearableDeviceId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "taskType" "TaskType" NOT NULL DEFAULT 'AD_HOC';

-- AlterTable
ALTER TABLE "TaskProof" ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "proofType" "ProofType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "submissionId" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'NORMAL_USER',
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED';

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "paymentId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceProvisioningLog" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "status" "FamilyProvisionStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceProvisioningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLedger" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ownerMemberId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FinanceLedgerType" NOT NULL DEFAULT 'FAMILY_SHARED',
    "status" "FinanceLedgerStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "openingAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "recordedById" TEXT,
    "categoryId" TEXT,
    "budgetLineId" TEXT,
    "goalId" TEXT,
    "supportRequestId" TEXT,
    "rewardSettlementId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "essentialType" "EssentialType" NOT NULL DEFAULT 'NA',
    "sourceType" "FinanceEntrySourceType" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceModel" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "type" "FinanceModelType" NOT NULL DEFAULT 'CUSTOM',
    "status" "FinanceModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJar" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "ledgerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allocationRatio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "targetAmount" DECIMAL(15,2),
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceJar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceCategoryType" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "periodType" "BudgetPeriodType" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "BudgetPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "plannedAmount" DECIMAL(15,2) NOT NULL,
    "actualAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "essentialType" "EssentialType" NOT NULL DEFAULT 'NA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialGoal" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ledgerId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" DECIMAL(15,2) NOT NULL,
    "currentAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "status" "FinancialGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalAllocation" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "actorId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingSupportRequest" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT,
    "status" "SpendingSupportRequestStatus" NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpendingSupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAlert" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "budgetPlanId" TEXT,
    "goalId" TEXT,
    "type" "BudgetAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'WAITING_REVIEW',
    "note" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUnavailability" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "memberId" TEXT NOT NULL,
    "handledById" TEXT,
    "reason" TEXT,
    "status" "UnavailabilityStatus" NOT NULL DEFAULT 'REPORTED',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSetting" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "rewardType" "RewardType" NOT NULL DEFAULT 'MONEY_RECORD',
    "amount" DECIMAL(15,2),
    "pointValue" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSettlement" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "receiverId" TEXT NOT NULL,
    "settledById" TEXT,
    "amount" DECIMAL(15,2),
    "rewardType" "RewardType" NOT NULL DEFAULT 'MONEY_RECORD',
    "status" "RewardSettlementStatus" NOT NULL DEFAULT 'PENDING_SETTLEMENT',
    "externalMethod" "ExternalSettlementMethod",
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAllocation" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "actorId" TEXT,
    "amount" DECIMAL(15,2),
    "points" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardDispute" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "status" "RewardDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RewardDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOSSetting" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT,
    "autoNotifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fallDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "locationTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emergencyMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOSSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "relationship" "FamilyRelationship" NOT NULL DEFAULT 'OTHER',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WearableDevice" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "legacyDeviceId" TEXT,
    "name" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PAIRED',
    "batteryLevel" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WearableDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "wearableDeviceId" TEXT,
    "sosAlertId" TEXT,
    "type" "SensorEventType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "value" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLocationPoint" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "wearableDeviceId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "source" "LocationSourceType" NOT NULL DEFAULT 'MOBILE_GPS',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLocationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOSLocationPoint" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "sosAlertId" TEXT NOT NULL,
    "wearableDeviceId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "address" TEXT,
    "source" "LocationSourceType" NOT NULL DEFAULT 'MOBILE_GPS',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOSLocationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOSResponse" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "sosAlertId" TEXT NOT NULL,
    "responderId" TEXT,
    "type" "SosSettingResponseType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOSResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_familyId_status_idx" ON "WorkspaceSubscription"("familyId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_planId_idx" ON "WorkspaceSubscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_paymentId_key" ON "SubscriptionPayment"("paymentId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_familyId_createdAt_idx" ON "SubscriptionPayment"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_planId_idx" ON "SubscriptionPayment"("planId");

-- CreateIndex
CREATE INDEX "WorkspaceProvisioningLog_familyId_createdAt_idx" ON "WorkspaceProvisioningLog"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceProvisioningLog_status_idx" ON "WorkspaceProvisioningLog"("status");

-- CreateIndex
CREATE INDEX "FinanceLedger_familyId_type_idx" ON "FinanceLedger"("familyId", "type");

-- CreateIndex
CREATE INDEX "FinanceLedger_ownerMemberId_idx" ON "FinanceLedger"("ownerMemberId");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerId_entryDate_idx" ON "LedgerEntry"("ledgerId", "entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_recordedById_idx" ON "LedgerEntry"("recordedById");

-- CreateIndex
CREATE INDEX "LedgerEntry_categoryId_idx" ON "LedgerEntry"("categoryId");

-- CreateIndex
CREATE INDEX "LedgerEntry_supportRequestId_idx" ON "LedgerEntry"("supportRequestId");

-- CreateIndex
CREATE INDEX "LedgerEntry_rewardSettlementId_idx" ON "LedgerEntry"("rewardSettlementId");

-- CreateIndex
CREATE INDEX "FinanceModel_familyId_status_idx" ON "FinanceModel"("familyId", "status");

-- CreateIndex
CREATE INDEX "FinanceModel_createdById_idx" ON "FinanceModel"("createdById");

-- CreateIndex
CREATE INDEX "FinanceJar_modelId_sortOrder_idx" ON "FinanceJar"("modelId", "sortOrder");

-- CreateIndex
CREATE INDEX "FinanceJar_ledgerId_idx" ON "FinanceJar"("ledgerId");

-- CreateIndex
CREATE INDEX "FinanceCategory_familyId_type_idx" ON "FinanceCategory"("familyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_familyId_name_type_key" ON "FinanceCategory"("familyId", "name", "type");

-- CreateIndex
CREATE INDEX "BudgetPlan_familyId_status_idx" ON "BudgetPlan"("familyId", "status");

-- CreateIndex
CREATE INDEX "BudgetPlan_createdById_idx" ON "BudgetPlan"("createdById");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetPlanId_idx" ON "BudgetLine"("budgetPlanId");

-- CreateIndex
CREATE INDEX "BudgetLine_categoryId_idx" ON "BudgetLine"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialGoal_familyId_status_idx" ON "FinancialGoal"("familyId", "status");

-- CreateIndex
CREATE INDEX "FinancialGoal_ledgerId_idx" ON "FinancialGoal"("ledgerId");

-- CreateIndex
CREATE INDEX "FinancialGoal_createdById_idx" ON "FinancialGoal"("createdById");

-- CreateIndex
CREATE INDEX "GoalAllocation_goalId_allocatedAt_idx" ON "GoalAllocation"("goalId", "allocatedAt");

-- CreateIndex
CREATE INDEX "GoalAllocation_actorId_idx" ON "GoalAllocation"("actorId");

-- CreateIndex
CREATE INDEX "SpendingSupportRequest_familyId_status_idx" ON "SpendingSupportRequest"("familyId", "status");

-- CreateIndex
CREATE INDEX "SpendingSupportRequest_requesterId_idx" ON "SpendingSupportRequest"("requesterId");

-- CreateIndex
CREATE INDEX "SpendingSupportRequest_reviewedById_idx" ON "SpendingSupportRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "BudgetAlert_familyId_status_idx" ON "BudgetAlert"("familyId", "status");

-- CreateIndex
CREATE INDEX "BudgetAlert_budgetPlanId_idx" ON "BudgetAlert"("budgetPlanId");

-- CreateIndex
CREATE INDEX "BudgetAlert_goalId_idx" ON "BudgetAlert"("goalId");

-- CreateIndex
CREATE INDEX "TaskCategory_familyId_isActive_idx" ON "TaskCategory"("familyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategory_familyId_name_key" ON "TaskCategory"("familyId", "name");

-- CreateIndex
CREATE INDEX "TaskAssignment_assignedToId_status_idx" ON "TaskAssignment"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "TaskAssignment_assignedById_idx" ON "TaskAssignment"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_assignedToId_key" ON "TaskAssignment"("taskId", "assignedToId");

-- CreateIndex
CREATE INDEX "TaskSubmission_taskId_status_idx" ON "TaskSubmission"("taskId", "status");

-- CreateIndex
CREATE INDEX "TaskSubmission_assignmentId_idx" ON "TaskSubmission"("assignmentId");

-- CreateIndex
CREATE INDEX "TaskSubmission_submittedById_idx" ON "TaskSubmission"("submittedById");

-- CreateIndex
CREATE INDEX "TaskSubmission_reviewedById_idx" ON "TaskSubmission"("reviewedById");

-- CreateIndex
CREATE INDEX "TaskUnavailability_assignmentId_idx" ON "TaskUnavailability"("assignmentId");

-- CreateIndex
CREATE INDEX "TaskUnavailability_memberId_status_idx" ON "TaskUnavailability"("memberId", "status");

-- CreateIndex
CREATE INDEX "TaskUnavailability_handledById_idx" ON "TaskUnavailability"("handledById");

-- CreateIndex
CREATE UNIQUE INDEX "RewardSetting_taskId_key" ON "RewardSetting"("taskId");

-- CreateIndex
CREATE INDEX "RewardSettlement_taskId_idx" ON "RewardSettlement"("taskId");

-- CreateIndex
CREATE INDEX "RewardSettlement_receiverId_status_idx" ON "RewardSettlement"("receiverId", "status");

-- CreateIndex
CREATE INDEX "RewardSettlement_settledById_idx" ON "RewardSettlement"("settledById");

-- CreateIndex
CREATE UNIQUE INDEX "RewardSettlement_taskId_receiverId_key" ON "RewardSettlement"("taskId", "receiverId");

-- CreateIndex
CREATE INDEX "RewardAllocation_settlementId_idx" ON "RewardAllocation"("settlementId");

-- CreateIndex
CREATE INDEX "RewardAllocation_actorId_idx" ON "RewardAllocation"("actorId");

-- CreateIndex
CREATE INDEX "RewardDispute_settlementId_status_idx" ON "RewardDispute"("settlementId", "status");

-- CreateIndex
CREATE INDEX "RewardDispute_reportedById_idx" ON "RewardDispute"("reportedById");

-- CreateIndex
CREATE INDEX "RewardDispute_resolvedById_idx" ON "RewardDispute"("resolvedById");

-- CreateIndex
CREATE UNIQUE INDEX "SOSSetting_familyId_key" ON "SOSSetting"("familyId");

-- CreateIndex
CREATE INDEX "SOSSetting_createdById_idx" ON "SOSSetting"("createdById");

-- CreateIndex
CREATE INDEX "EmergencyContact_settingId_priority_idx" ON "EmergencyContact"("settingId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "WearableDevice_legacyDeviceId_key" ON "WearableDevice"("legacyDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WearableDevice_deviceCode_key" ON "WearableDevice"("deviceCode");

-- CreateIndex
CREATE INDEX "WearableDevice_familyId_status_idx" ON "WearableDevice"("familyId", "status");

-- CreateIndex
CREATE INDEX "WearableDevice_memberId_idx" ON "WearableDevice"("memberId");

-- CreateIndex
CREATE INDEX "SensorEvent_familyId_occurredAt_idx" ON "SensorEvent"("familyId", "occurredAt");

-- CreateIndex
CREATE INDEX "SensorEvent_wearableDeviceId_occurredAt_idx" ON "SensorEvent"("wearableDeviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "SensorEvent_sosAlertId_idx" ON "SensorEvent"("sosAlertId");

-- CreateIndex
CREATE INDEX "MemberLocationPoint_familyId_recordedAt_idx" ON "MemberLocationPoint"("familyId", "recordedAt");

-- CreateIndex
CREATE INDEX "MemberLocationPoint_memberId_recordedAt_idx" ON "MemberLocationPoint"("memberId", "recordedAt");

-- CreateIndex
CREATE INDEX "MemberLocationPoint_wearableDeviceId_recordedAt_idx" ON "MemberLocationPoint"("wearableDeviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "SOSLocationPoint_familyId_recordedAt_idx" ON "SOSLocationPoint"("familyId", "recordedAt");

-- CreateIndex
CREATE INDEX "SOSLocationPoint_sosAlertId_recordedAt_idx" ON "SOSLocationPoint"("sosAlertId", "recordedAt");

-- CreateIndex
CREATE INDEX "SOSLocationPoint_wearableDeviceId_idx" ON "SOSLocationPoint"("wearableDeviceId");

-- CreateIndex
CREATE INDEX "SOSResponse_familyId_createdAt_idx" ON "SOSResponse"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "SOSResponse_sosAlertId_idx" ON "SOSResponse"("sosAlertId");

-- CreateIndex
CREATE INDEX "SOSResponse_responderId_idx" ON "SOSResponse"("responderId");

-- CreateIndex
CREATE INDEX "Family_createdByUserId_idx" ON "Family"("createdByUserId");

-- CreateIndex
CREATE INDEX "SosAlert_triggeredByMemberId_idx" ON "SosAlert"("triggeredByMemberId");

-- CreateIndex
CREATE INDEX "SosAlert_wearableDeviceId_idx" ON "SosAlert"("wearableDeviceId");

-- CreateIndex
CREATE INDEX "Task_categoryId_idx" ON "Task"("categoryId");

-- CreateIndex
CREATE INDEX "TaskProof_submissionId_idx" ON "TaskProof"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WorkspaceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProvisioningLog" ADD CONSTRAINT "WorkspaceProvisioningLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedger" ADD CONSTRAINT "FinanceLedger_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedger" ADD CONSTRAINT "FinanceLedger_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "FinanceLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FinancialGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "SpendingSupportRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_rewardSettlementId_fkey" FOREIGN KEY ("rewardSettlementId") REFERENCES "RewardSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceModel" ADD CONSTRAINT "FinanceModel_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceModel" ADD CONSTRAINT "FinanceModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJar" ADD CONSTRAINT "FinanceJar_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "FinanceModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJar" ADD CONSTRAINT "FinanceJar_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "FinanceLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "FinanceLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FinancialGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingSupportRequest" ADD CONSTRAINT "SpendingSupportRequest_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingSupportRequest" ADD CONSTRAINT "SpendingSupportRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingSupportRequest" ADD CONSTRAINT "SpendingSupportRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FinancialGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProof" ADD CONSTRAINT "TaskProof_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCategory" ADD CONSTRAINT "TaskCategory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUnavailability" ADD CONSTRAINT "TaskUnavailability_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUnavailability" ADD CONSTRAINT "TaskUnavailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUnavailability" ADD CONSTRAINT "TaskUnavailability_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSetting" ADD CONSTRAINT "RewardSetting_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSettlement" ADD CONSTRAINT "RewardSettlement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSettlement" ADD CONSTRAINT "RewardSettlement_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardSettlement" ADD CONSTRAINT "RewardSettlement_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RewardSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDispute" ADD CONSTRAINT "RewardDispute_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RewardSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDispute" ADD CONSTRAINT "RewardDispute_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDispute" ADD CONSTRAINT "RewardDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosAlert" ADD CONSTRAINT "SosAlert_triggeredByMemberId_fkey" FOREIGN KEY ("triggeredByMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosAlert" ADD CONSTRAINT "SosAlert_resolvedByMemberId_fkey" FOREIGN KEY ("resolvedByMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosAlert" ADD CONSTRAINT "SosAlert_wearableDeviceId_fkey" FOREIGN KEY ("wearableDeviceId") REFERENCES "WearableDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSSetting" ADD CONSTRAINT "SOSSetting_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSSetting" ADD CONSTRAINT "SOSSetting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "SOSSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearableDevice" ADD CONSTRAINT "WearableDevice_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearableDevice" ADD CONSTRAINT "WearableDevice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearableDevice" ADD CONSTRAINT "WearableDevice_legacyDeviceId_fkey" FOREIGN KEY ("legacyDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorEvent" ADD CONSTRAINT "SensorEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorEvent" ADD CONSTRAINT "SensorEvent_wearableDeviceId_fkey" FOREIGN KEY ("wearableDeviceId") REFERENCES "WearableDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorEvent" ADD CONSTRAINT "SensorEvent_sosAlertId_fkey" FOREIGN KEY ("sosAlertId") REFERENCES "SosAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocationPoint" ADD CONSTRAINT "MemberLocationPoint_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocationPoint" ADD CONSTRAINT "MemberLocationPoint_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocationPoint" ADD CONSTRAINT "MemberLocationPoint_wearableDeviceId_fkey" FOREIGN KEY ("wearableDeviceId") REFERENCES "WearableDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSLocationPoint" ADD CONSTRAINT "SOSLocationPoint_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSLocationPoint" ADD CONSTRAINT "SOSLocationPoint_sosAlertId_fkey" FOREIGN KEY ("sosAlertId") REFERENCES "SosAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSLocationPoint" ADD CONSTRAINT "SOSLocationPoint_wearableDeviceId_fkey" FOREIGN KEY ("wearableDeviceId") REFERENCES "WearableDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSResponse" ADD CONSTRAINT "SOSResponse_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSResponse" ADD CONSTRAINT "SOSResponse_sosAlertId_fkey" FOREIGN KEY ("sosAlertId") REFERENCES "SosAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSResponse" ADD CONSTRAINT "SOSResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
