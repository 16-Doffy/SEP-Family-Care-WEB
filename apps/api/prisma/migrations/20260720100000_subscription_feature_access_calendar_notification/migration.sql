-- Store entitlement flags independently from the display-only `features` list.
ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "featureAccess" JSONB NOT NULL DEFAULT '{}';

-- Event-created notifications are distinct from scheduled reminder notifications.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CALENDAR';
