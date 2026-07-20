# Admin-web — Swagger & Requirement Audit

Updated: 2026-07-20

## Scope confirmed from Flow Tracker

Admin-web is for `SYSTEM_ADMIN` only. The required core admin use cases are:

1. Manage subscription plans and feature access (UC01).
2. View/manage family workspace and subscription status (UC02).
3. Manage user account access (UC03).
4. Monitor workspace activation status (UC04).
5. View basic service status (UC05).
6. View provisioning logs and retry provisioning (UC06–UC07).

Calendar, Face AI, album tagging, member relationship/deputy flow, finance, task, SOS, and chat are family/mobile flows. They must not be implemented as operational screens in Admin-web.

## Swagger mapping result

All endpoints referenced by `apps/web/src/hooks/useAdmin.ts` exist in the deployed Swagger contract:

- Admin users, families, family members, invitations, subscription plans.
- Dashboard, revenue, payments, audit logs, backups/restores, system and Docker infrastructure.
- Family subscription, manual renewal, subscription status, Stripe sync, activation status, provisioning logs and provisioning retry.

The client uses `/api/v1` and unwraps the standard `{ success, message, data }` envelope in `apps/web/src/lib/api.ts`.

## Fixed frontend issues

- Replaced unstable React chart key in `admin/revenue/page.tsx` with a month-based key.
- Normalized subscription/activation/provisioning response wrappers in `useAdmin.ts`.
- Added visible API error states to the Family subscription modal instead of silently rendering `—`.

## Important backend-contract blocker

The current Swagger `CreateSubscriptionPlanDto` and `UpdateSubscriptionPlanDto` expose only:

`annualPrice`, `maxMembers`, `storageLimit`, `featureAccess`, `stripePriceId`, `isActive`.

But the Flow Tracker rules BR-SUB-01, BR-SUB-03, BR-SUB-04 and BR-SUB-08 require Free, **monthly paid**, and **yearly paid** choices. A yearly discount cannot be calculated correctly from this API because no `monthlyPrice` and no `billingPeriod` are returned.

Required BE contract decision before releasing pricing UI:

- Add `billingPeriod: FREE | MONTHLY | YEARLY` and `priceMonthly` / `priceYearly`; or
- Define two plans with a formally documented pairing field, and state which amount each plan price represents.

Until that contract is resolved, the admin web must not treat a plan's `annualPrice` as a monthly price merely because its code contains `MONTHLY`.

## Mobile/backend items to track separately

- Swagger exposes Calendar and Face AI endpoints, but feature-gate behavior, auto-created calendar participants, and `CALENDAR` notifications are implementation details that require backend verification.
- Swagger does not currently expose the family-facing member role/relationship/deputy grant/revoke endpoints requested in the update list. The existing `/admin/family-members` endpoint is admin-only and is not a replacement.
