CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LOCKED');
CREATE TYPE "FamilyProvisionStatus" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED');

ALTER TABLE "Family"
  ADD COLUMN "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "statusReason" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "priceMonthly" DECIMAL(12,2),
  ADD COLUMN "priceYearly" DECIMAL(12,2);

UPDATE "SubscriptionPlan"
SET "priceMonthly" = CASE WHEN "billingPeriod" = 'MONTHLY' THEN "price" ELSE NULL END,
    "priceYearly" = CASE WHEN "billingPeriod" = 'YEARLY' THEN "price" ELSE NULL END;

CREATE TABLE "FamilyProvision" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "status" "FamilyProvisionStatus" NOT NULL DEFAULT 'PENDING',
  "containerName" TEXT,
  "databaseName" TEXT,
  "imageTag" TEXT,
  "metadata" JSONB,
  "lastError" TEXT,
  "provisionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FamilyProvision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyProvision_familyId_key" ON "FamilyProvision"("familyId");
CREATE INDEX "FamilyProvision_status_idx" ON "FamilyProvision"("status");
CREATE INDEX "Family_status_idx" ON "Family"("status");

ALTER TABLE "FamilyProvision" ADD CONSTRAINT "FamilyProvision_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
