# Handoff — ERD alignment & Finance wiring

> File này tóm tắt toàn bộ thay đổi đã làm, để chat mới / người khác đọc lại được.
> Tất cả thay đổi đã ghi xuống đĩa + DB (đã migrate + seed). Không nằm trong hội thoại.

## Bối cảnh
Đồ án Family Care (monorepo: `apps/api` Express+Prisma+Postgres, `apps/web` Next.js).
Mục tiêu: làm schema khớp ERD (54 bảng) và wiring 1 flow finance dùng đúng model ERD.

## Phase 1 — Web-first alignment (wording/role/UI)
Đổi UI/wording sang hướng "sổ quỹ nội bộ / ledger" thay vì "ví điện tử"; map role hiển thị
Family Manager/Deputy/Member; gỡ top-up family fund qua payment; subscription annual-only.
(Không đổi schema.)

## Phase 2 — Schema khớp ERD 100%
**File:** `apps/api/prisma/schema.prisma`, 2 migration mới, `seed.ts`, `auth.service.ts`.

- **+18 enum** (MonthlyFinanceVisibility, TaskRepeatType, MediaType, NotificationPriority,
  WearableDeviceKind, FamilyInvitationStatus, AnnouncementStatus, …).
- **+6 bảng mới**: `MemberMonthlyFinance`, `TaskSchedule`, `MessageAttachment`,
  `CalendarEventParticipant`, `AlbumMediaTag`, `MediaModerationCheck`.
- **Đổi tên** `RefreshToken` → **`AuthSession`** (giữ data qua `ALTER TABLE RENAME`).
  → đã sửa `auth.service.ts`: `prisma.refreshToken` → `prisma.authSession` (10 chỗ).
- **Bù field ERD** (nullable/default, không phá service) cho ~22 bảng: FinanceJar
  (purpose/threshold/visibility/status), LedgerEntry (jarId/sourceId), FinanceCategory,
  BudgetPlan/BudgetLine/FinancialGoal/GoalAllocation/SpendingSupportRequest/BudgetAlert,
  RewardSetting/RewardSettlement/RewardAllocation, TaskAssignment, Notification,
  Conversation/Message, FamilyEvent, AlbumPhoto, WearableDevice/SensorEvent,
  AiConversation/AiMessage, SubscriptionPayment, WorkspaceProvisioningLog,
  FamilyInvite (invitedEmail/invitedPhone/status/createdByMemberId/acceptedByUserId/acceptedAt),
  Announcement (title/priority/status).
- **Migrations đã apply**: `20260615071500_erd_completion`, `20260615073500_erd_full_parity`.
- **Kết quả: 54/54 bảng ERD đều có** (một số map tên khác để khỏi vỡ app:
  `Family`=family_workspaces, `FamilyEvent`=calendar_events, `AlbumPhoto`=album_media,
  `FamilyInvite`=family_invitations, `Announcement`=family_announcements, `AuthSession`=auth_sessions).
- Vẫn còn **17 model legacy** ngoài ERD (Wallet/Transaction/MoneyRequest/FamilyBudget/
  PersonalExpense/FamilyExpense/ActualIncome/IncomeSource/MonthlyFundSnapshot/
  RecurringTaskTemplate/Device/DeviceRoutePoint/LocationShare/AlbumCategory/Payment/
  FamilyProvision) — giữ vì service đang dùng.

### Lưu ý migration
`prisma migrate dev` KHÔNG dùng được (migration lịch sử `20260518000001_admin_operations`
hỏng shadow DB). Cách dùng: sửa `schema.prisma` → `prisma migrate diff --from-schema-datasource
... --to-schema-datamodel ... --script` để sinh SQL → viết tay file migration → `migrate deploy`.

## Phase 3 — Wiring Finance theo ERD (flow chạy thật)
Flow đầu tiên thực sự DÙNG model ERD (FinanceLedger/LedgerEntry/FinanceJar/BudgetPlan),
tách hẳn hệ Wallet cũ.

**Backend (mới):**
- `apps/api/src/services/finance-erd.service.ts` — ensureFamilyLedger, setupModel (5 lọ/80-20),
  categories, ledger entries (gắn jar+category+essentialType), budget plan + lines,
  getOverview (balance, tổng tháng, jar allocation %, budget planned-vs-actual).
- `apps/api/src/controllers/finance-erd.controller.ts` — Zod validation.
- `apps/api/src/routes/finance.routes.ts` — +7 route dưới **`/api/finance/erd`**:
  `GET /overview`, `GET|POST /categories`, `POST /model`, `GET|POST /entries`, `POST /budget-plans`.
  (Cấu hình model/category/budget chỉ PARENT/SUPER_ADMIN; ghi entry thì mọi member.)

**Frontend (mới):**
- `apps/web/src/components/finance/ErdFinancePanel.tsx` — panel: thẻ tổng quan, lưới lọ,
  ngân sách planned-vs-actual, form ghi giao dịch, danh sách giao dịch, công cụ quản gia.
- `apps/web/src/app/(app)/wallet/page.tsx` — thêm tab **"Sổ quỹ & Lọ"** (activeTab `'jars'`).

**Cách xem:** đăng nhập `manager@demo.com` / `demo1234` → trang Ví → tab "Sổ quỹ & Lọ".
Demo family đã có sẵn: mô hình 5 chiếc lọ (6 lọ), 2 danh mục, 4 giao dịch, 1 ngân sách tháng.

## Đã verify
- `prisma validate` OK; `migrate deploy` OK; `db:generate` OK; `db:seed` OK.
- API `tsc --noEmit` OK; Web `tsc --noEmit` OK.
- Login 200 (qua AuthSession đổi tên); `/finance/erd/*` smoke-test pass (planned-vs-actual đúng).

## Lệnh hay dùng (Docker; trên Windows docker.exe ở "C:\Program Files\Docker\Docker\resources\bin")
```
docker compose exec api pnpm prisma validate
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm db:generate
docker compose exec api pnpm db:seed
docker compose exec api npx tsc --noEmit -p tsconfig.json
docker compose exec web npx tsc --noEmit
docker compose exec postgres psql -U familycare -d familycare_db
```
DB: user `familycare`, db `familycare_db`.

## Việc còn lại (phase sau — CHƯA làm)
- Wiring các flow ERD khác: Calendar participants, RewardSettlement/RewardAllocation,
  MessageAttachment, MemberMonthlyFinance, AlbumMediaTag/MediaModerationCheck,
  FamilyInvite (email/status).
- (Tuỳ chọn) gộp Wallet/Transaction legacy vào FinanceLedger/LedgerEntry.
- (Tuỳ chọn) cập nhật `packages/shared` types cho domain mới.
- Announcement.title đang để nullable (ERD là NOT NULL) — nếu cần ép thì sửa service + backfill.
