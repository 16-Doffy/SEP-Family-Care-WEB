# Family Care - Phân tích chênh lệch chức năng (Feature Gap Analysis)

Tài liệu so sánh **danh sách chức năng yêu cầu** với **trạng thái triển khai hiện tại** của project Family Care (web + api + prisma schema), từ đó liệt kê những phần còn thiếu hoặc chưa hoàn chỉnh cần bổ sung.

**Ngày cập nhật:** 2026-05-18
**Phạm vi rà soát:** `apps/api/src/routes`, `apps/api/src/controllers`, `apps/api/prisma/schema.prisma`, `apps/web/src/app/(app)`

**Quy ước trạng thái:**
- ✅ Đã có và hoạt động
- 🟡 Có một phần / cần hoàn thiện
- ❌ Chưa có / cần làm mới

---

## 1. Admin (SUPER_ADMIN)

| Mã | Chức năng yêu cầu | Trạng thái | Nơi triển khai hiện tại | Ghi chú / Cần bổ sung |
|---|---|---|---|---|
| A1 | Quản lý subscription plans (CRUD, max members) | ✅ | [admin.routes.ts](apps/api/src/routes/admin.routes.ts) `/admin/plans` + [subscription-plan.controller.ts](apps/api/src/controllers/subscription-plan.controller.ts) | Đã có CRUD + `maxMembers`, `maxTasksPerMonth` |
| A2 | Configure plan pricing (monthly/yearly) | 🟡 | `SubscriptionPlan.billingPeriod` (default "MONTHLY") | Schema chỉ lưu **một** chu kỳ thanh toán mỗi plan. Nếu muốn cùng 1 plan có cả monthly + yearly thì cần đổi sang `priceMonthly` + `priceYearly` hoặc tách 2 plan |
| A3 | Configure plan member limit | ✅ | `SubscriptionPlan.maxMembers` | OK |
| A4 | Manage families | ✅ | `GET /admin/families` | OK |
| A5 | Manage heads of households | 🟡 | `GET /admin/families` (lấy member đầu tiên) | Chưa có endpoint chuyên biệt để **chỉnh sửa** owner (đổi owner, xem chi tiết owner). Cần `GET /admin/families/:id/owner` + `PUT /admin/families/:id/owner` |
| A6 | Manage family status (activate/suspend/lock/unlock) | ❌ | Chỉ có `Family.subscriptionStatus` (ACTIVE/EXPIRED/CANCELLED/PAST_DUE) | **Thiếu**: endpoint admin để **suspend/lock** một family độc lập với subscription. Cần thêm field `Family.isLocked` hoặc `Family.status` (ACTIVE/SUSPENDED/LOCKED) + endpoint `PATCH /admin/families/:id/status` |
| A7 | Manage subscription expiry date | 🟡 | `POST /admin/families/:id/renew` (cộng N tháng) | Chỉ có gia hạn, **chưa có** set thẳng `subscriptionExpiresAt = X`. Cần `PATCH /admin/families/:id/subscription` để chỉnh trực tiếp ngày hết hạn |
| A8 | Revenue statistics & charts (MRR, ARR) | 🟡 | `GET /admin/revenue` ([payment.controller.ts](apps/api/src/controllers/payment.controller.ts)) | Cần xác minh đã có **MRR / ARR / breakdown theo tháng-năm**; nếu chưa, bổ sung aggregate theo tháng + plan |
| A9 | Export revenue reports | ❌ | Chỉ có backup JSON toàn hệ thống | **Thiếu**: `GET /admin/revenue/export?format=csv|xlsx` xuất riêng dữ liệu doanh thu |
| A10 | Monitor Docker infrastructure (CPU/RAM/disk/container) | 🟡 | `GET /admin/system/health` mới có CPU/RAM/uptime/uploads của **API process** | **Thiếu**: trạng thái container Docker (`web`, `postgres`, `redis`). Cần module Docker SDK (dockerode) để `docker ps` / `docker stats` |
| A11 | View container logs | ❌ | Chưa có | **Thiếu**: `GET /admin/system/logs/:container?tail=...` (dùng dockerode `container.logs()`) |
| A12 | Backup family data | 🟡 | `GET /admin/backup/export` (toàn hệ thống) | **Thiếu**: backup theo **từng family** (`GET /admin/families/:id/backup`) trả về JSON chỉ chứa dữ liệu family đó |
| A13 | Restore family data from backup | ❌ | Chưa có | **Thiếu**: `POST /admin/families/:id/restore` chấp nhận file JSON backup |
| A14 | Auto-provision family containers sau khi payment thành công | ❌ | Project hiện dùng **shared DB**, không tách container per-family | Nếu yêu cầu thực sự là tách container/DB cho mỗi family thì là **thay đổi kiến trúc lớn**. Đề xuất giữ shared DB và xem A14 là "auto-provision family + wallet sau payment" — phần này đã có trong [payment.controller.ts](apps/api/src/controllers/payment.controller.ts) khi confirm subscription |
| A15 | Manually renew subscription | ✅ | `POST /admin/families/:id/renew` | OK |
| A16 | Lock/unlock user accounts | ✅ | `PUT /admin/users/:id` với `isActive` | OK |

---

## 2. PARENT (Phụ huynh / Chủ hộ)

| Mã | Chức năng yêu cầu | Trạng thái | Nơi triển khai hiện tại | Ghi chú / Cần bổ sung |
|---|---|---|---|---|
| P1 | Create family | ✅ | `POST /auth/register` (tự tạo Family + JOINT wallet + PERSONAL wallet) | OK |
| P2 | Update family info | ✅ | `PUT /family/` | OK (chỉ đổi tên — cân nhắc thêm avatar, address...) |
| P3 | Invite family members | ✅ | `POST /family/invite` + `POST /family/join` | OK |
| P4 | Remove family members | ✅ | `DELETE /family/members/:userId` | OK |
| P5 | Assign member roles | ✅ | `PATCH /family/members/:userId/role` | OK |
| P6 | Manage joint wallet | ✅ | [wallet.routes.ts](apps/api/src/routes/wallet.routes.ts) | OK |
| P7 | Top-up family wallet qua payment gateway | 🟡 | `POST /payments/checkout` hỗ trợ `PaymentType.WALLET_TOPUP` | Cần xác minh flow `confirm-mock` có **thực sự cộng tiền** vào joint wallet (tạo `Transaction` DEPOSIT) hay chỉ đổi `Payment.status`. Nếu chưa → bổ sung trong [payment.controller.ts](apps/api/src/controllers/payment.controller.ts) |
| P8 | Transfer allowance | ✅ | `POST /wallets/transfer` | OK |
| P9 | Approve withdrawal requests | ✅ | `PATCH /money-requests/:id` | OK |
| P10 | View transaction history | ✅ | `GET /wallets/:id` (50 giao dịch gần nhất) | OK |
| P11 | Create household tasks | ✅ | `POST /tasks` | OK |
| P12 | Assign tasks | ✅ | `POST /tasks` (`assignedToId`) | OK |
| P13 | Approve completed tasks | ✅ | `PATCH /tasks/:id/approve` + `reject` | OK |
| P14 | Auto reward after task approval | ✅ | Khi approve task có `reward` → chuyển từ JOINT sang PERSONAL wallet | OK |
| P15 | Configure task rewards (rules) | 🟡 | Reward set per-task trên `Task.reward` | **Thiếu** "rule auto-reward" tự động (ví dụ: task lặp lại / theo loại task). Hiện chỉ là nhập tay từng task |
| P16 | Pair wearable devices (smartwatch) | ❌ | Chưa có | **Thiếu hoàn toàn**: cần model `WearableDevice { id, userId, deviceType, pairingCode, lastSeenAt, isActive }` + endpoint pair/unpair/list |
| P17 | Configure SOS settings | ❌ | Chưa có model SOS settings | **Thiếu**: model `SosSettings { familyId, autoCallEnabled, emergencyContacts[], shareLocationOnSos, notifyAllMembers, ... }` + endpoint `GET/PUT /family/sos-settings` |
| P18 | View family activity logs | 🟡 | Notification + Transaction là log "gián tiếp" | **Thiếu**: trang `Activity Log` tổng hợp (task, wallet, sos, member changes, login). Có thể tạo model `ActivityLog { familyId, actorId, action, entityType, entityId, metadata }` |
| P19 | Upgrade subscription plans | ✅ | `POST /payments/checkout` (subscription) | OK |
| P20 | Manage calendar events | ✅ | `POST/PUT/DELETE /calendar/:id` | OK (lưu ý: route hiện cho cả parent + child tạo/sửa event, chỉ delete giới hạn PARENT/ADMIN — xem [calendar.routes.ts:28-33](apps/api/src/routes/calendar.routes.ts#L28-L33)) |
| P21 | View family locations on map | 🟡 | `LocationShare` model + [location.routes.ts](apps/api/src/routes/location.routes.ts) đã có data | Cần xác minh UI web có **map view** (Leaflet/Google Map). Nếu chưa → bổ sung component map trong `apps/web/src/app/(app)/location/page.tsx` |

---

## 3. CHILD (Con / Thành viên phụ)

| Mã | Chức năng yêu cầu | Trạng thái | Nơi triển khai hiện tại | Ghi chú / Cần bổ sung |
|---|---|---|---|---|
| C1 | View personal wallet | ✅ | `GET /wallets` (filter theo `ownerId`) | OK |
| C2 | View transaction history | ✅ | `GET /wallets/:id` | OK |
| C3 | Receive assigned tasks | ✅ | `GET /tasks` (filter `assignedToId`) | OK |
| C4 | Submit task completion | ✅ | `PATCH /tasks/:id/start` + `POST /tasks/:id/proof` | OK |
| C5 | Upload task proof | ✅ | `POST /tasks/:id/proof` (image/note) | OK |
| C6 | Request money | ✅ | `POST /money-requests` | OK |
| C7 | Send support requests | ✅ | `POST /announcements` với `type=SUPPORT_REQUEST` | OK ([announcement.controller.ts](apps/api/src/controllers/announcement.controller.ts)) |
| C8 | Send family announcements | ✅ | `POST /announcements` với `type=ANNOUNCEMENT` | OK |
| C9 | Enable/disable location sharing | ✅ | `LocationShare.isSharing` + [location.routes.ts](apps/api/src/routes/location.routes.ts) | OK |
| C10 | Trigger SOS (app hoặc wearable) | 🟡 | App: `POST /sos` ✅ | **Wearable không có** — phụ thuộc P16. Khi có wearable cần endpoint `POST /sos/from-device` xác thực bằng device token |
| C11 | View reward history | 🟡 | Tính được từ `Transaction.type=TASK_REWARD` của ví cá nhân | **Chưa có endpoint chuyên biệt** `GET /rewards/history`. Cần thêm view/page hiển thị riêng |

---

## 3.5. PROFILE / TÀI KHOẢN CÁ NHÂN (Parent + Child)

Phần này **không có trong danh sách yêu cầu gốc** nhưng là chức năng cơ bản mà mọi app người dùng cần. Hiện project chỉ có trang [/settings](apps/web/src/app/(app)/settings/page.tsx) ở dạng **chỉ-đọc**, không cho phép sửa thông tin cá nhân.

| Mã | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| PRF1 | Xem thông tin tài khoản | 🟡 | Đã có `/settings` (read-only) — chưa có `/profile` |
| PRF2 | Sửa `displayName` | ❌ | Schema có `User.displayName`, thiếu endpoint `PATCH /auth/me` |
| PRF3 | Upload / đổi avatar | ❌ | Schema có `User.avatarUrl`, thiếu endpoint upload |
| PRF4 | Đổi mật khẩu (khi đang đăng nhập) | ❌ | Chỉ có `forgot-password` + `reset-password` qua token, **thiếu** `POST /auth/change-password` cho user đã đăng nhập |
| PRF5 | Sửa nickname trong family | ❌ | Schema có `FamilyMember.nickname`, chưa expose UI/endpoint |
| PRF6 | Xem thống kê cá nhân (task hoàn thành, tổng reward, số SOS đã gửi…) | ❌ | Data có sẵn trong DB, thiếu endpoint tổng hợp + UI |
| PRF7 | Xem danh sách thiết bị đang đăng nhập / đăng xuất từ xa | ❌ | `RefreshToken` model có sẵn, có thể list theo `userId` |

### Đề xuất bổ sung

**API endpoints mới:**
```
PATCH /auth/me                    → body: { displayName?, avatarUrl? }
POST  /auth/change-password       → body: { currentPassword, newPassword }
POST  /auth/me/avatar             → upload file ảnh (multer), trả về URL
GET   /auth/me/sessions           → liệt kê RefreshToken active
DELETE /auth/me/sessions/:id      → revoke một refresh token
GET   /auth/me/stats              → thống kê cá nhân (task, reward, sos…)
PATCH /family/members/me/nickname → đổi nickname trong family
```

**Web pages mới:**
- `apps/web/src/app/(app)/profile/page.tsx` với các tab:
  - **Thông tin** — avatar + displayName + nickname + email (readonly)
  - **Bảo mật** — đổi mật khẩu, danh sách phiên đăng nhập
  - **Thống kê** — số task hoàn thành, tổng reward đã nhận, số SOS đã gửi, số lần xin tiền
- Hoặc tích hợp các tab vào `/settings` hiện có để khỏi tạo route mới

---

## 4. ALL MEMBERS (Chung)

| Mã | Chức năng yêu cầu | Trạng thái | Nơi triển khai hiện tại | Ghi chú / Cần bổ sung |
|---|---|---|---|---|
| M1 | Group chat | ✅ | `Conversation.type=GROUP` + [chat.routes.ts](apps/api/src/routes/chat.routes.ts) + Socket.IO | OK |
| M2 | Private chat | ✅ | `Conversation.type=PRIVATE` | OK |
| M3 | Send text messages | ✅ | `MessageType.TEXT` | OK |
| M4 | Send images/files | 🟡 | `MessageType.IMAGE` có | **Thiếu** loại FILE (PDF, docs). Cần thêm `MessageType.FILE` hoặc dùng IMAGE generic |
| M5 | Share location in chat | 🟡 | `MessageType.LOCATION` có trong enum | Cần xác minh client (web) đã gửi/parse được message kiểu LOCATION |
| M6 | Receive notifications | ✅ | `Notification` model + Socket.IO | OK |
| M7 | View family calendar | ✅ | `GET /calendar` | OK |
| M8 | Receive event reminders | 🟡 | `NotificationType.CALENDAR_REMINDER` có + `FamilyEvent.reminderSent` flag | **Cần xác minh** đã có cron job quét `FamilyEvent.startDate` sắp tới và gửi notification chưa. Nếu chưa → tạo `apps/api/src/jobs/event-reminder.ts` |
| M9 | Upload family photos/videos | 🟡 | `AlbumPhoto` chỉ có ảnh | **Thiếu video** — cần thêm field `mediaType` (IMAGE/VIDEO) + endpoint upload video |
| M10 | View shared family album | ✅ | [album.routes.ts](apps/api/src/routes/album.routes.ts) | OK |
| M11 | Interact with AI chatbot | ✅ | [ai.routes.ts](apps/api/src/routes/ai.routes.ts) + `AiConversation`/`AiMessage` | OK |
| M12 | Ask expense statistics (qua AI) | 🟡 | AI có nhưng chưa có **tool/function** chuyên thống kê wallet | Cần thêm function-calling cho AI: `getExpenseStats(familyId, range)` đọc Transaction |
| M13 | Ask task statistics (qua AI) | 🟡 | Tương tự M12 | Thêm `getTaskStats(familyId, range)` |
| M14 | Receive saving suggestions (qua AI) | 🟡 | AI generic có | Cần seed system prompt riêng cho "saving advisor" |

---

## 5. Tổng hợp những phần CẦN BỔ SUNG (Action items)

### 5.1 Schema (Prisma) — cần migrate

```prisma
// 1. Family status mở rộng (A6)
enum FamilyStatus { ACTIVE SUSPENDED LOCKED }
model Family {
  status FamilyStatus @default(ACTIVE)
  // ...
}

// 2. Subscription plan dual pricing (A2)
model SubscriptionPlan {
  priceMonthly Decimal? @db.Decimal(12, 2)
  priceYearly  Decimal? @db.Decimal(12, 2)
  // hoặc giữ price + billingPeriod như hiện tại và tách 2 record
}

// 3. SOS Settings (P17)
model SosSettings {
  id                  String   @id @default(cuid())
  familyId            String   @unique
  autoCallEnabled     Boolean  @default(false)
  shareLocationOnSos  Boolean  @default(true)
  notifyAllMembers    Boolean  @default(true)
  emergencyContacts   Json     @default("[]")
  family              Family   @relation(fields: [familyId], references: [id])
}

// 4. Wearable Device (P16, C10)
model WearableDevice {
  id           String   @id @default(cuid())
  userId       String
  deviceType   String   // "SMARTWATCH" | "TRACKER"
  pairingCode  String   @unique
  deviceToken  String   @unique
  lastSeenAt   DateTime?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// 5. Activity Log (P18)
model ActivityLog {
  id          String   @id @default(cuid())
  familyId    String
  actorId     String?
  action      String   // "TASK_CREATED", "WALLET_TRANSFERRED", ...
  entityType  String
  entityId    String?
  metadata    Json?
  createdAt   DateTime @default(now())
  family      Family   @relation(fields: [familyId], references: [id])
  @@index([familyId, createdAt])
}

// 6. Album hỗ trợ video (M9)
enum AlbumMediaType { IMAGE VIDEO }
model AlbumPhoto {
  mediaType AlbumMediaType @default(IMAGE)
  thumbnailUrl String?
}

// 7. Message hỗ trợ file (M4)
enum MessageType { TEXT IMAGE LOCATION FILE }
```

### 5.2 API endpoints mới cần thêm

**Admin:**
- `PATCH /admin/families/:id/status` — suspend / lock / activate (A6)
- `PATCH /admin/families/:id/subscription` — set thẳng `subscriptionExpiresAt`, `plan` (A7)
- `GET /admin/families/:id/backup` — backup theo family (A12)
- `POST /admin/families/:id/restore` — restore family từ JSON (A13)
- `GET /admin/revenue/export?format=csv` — xuất doanh thu (A9)
- `GET /admin/system/docker` — trạng thái container Docker (A10)
- `GET /admin/system/logs/:container` — xem log container (A11)
- `GET /admin/families/:id/owner` + `PUT /admin/families/:id/owner` — quản lý owner (A5)

**Parent:**
- `GET/PUT /family/sos-settings` — cấu hình SOS (P17)
- `GET /family/activity-log` — lịch sử hoạt động (P18)
- `POST /family/wearables/pair` + `DELETE /family/wearables/:id` (P16)

**Child:**
- `GET /rewards/history` — lịch sử reward (C11)

**Wearable channel:**
- `POST /sos/from-device` — gửi SOS từ wearable (C10)

### 5.3 UI Web cần làm/hoàn thiện

- **Admin dashboard**: trang Docker monitor + log viewer (A10, A11) — có sẵn mockup [admin-dashboard-mockup.html](admin-dashboard-mockup.html)
- **Admin revenue**: chart MRR/ARR + nút export — có mockup [admin-revenue-mockup.html](admin-revenue-mockup.html)
- **Admin plans**: đã có mockup [admin-plans-mockup.html](admin-plans-mockup.html), cần kiểm tra hỗ trợ dual pricing
- **Parent**: trang `Wearables`, `SOS Settings`, `Activity Log`
- **Location page**: hiển thị bản đồ thực tế (Leaflet) thay vì danh sách (P21)
- **Album page**: hỗ trợ upload + preview video (M9)
- **Chat**: gửi/nhận message LOCATION và FILE (M4, M5)
- **AI chat**: tích hợp function-calling cho expense/task stats (M12, M13)

### 5.4 Background jobs

- **Event reminder** (M8): cron mỗi 5–15 phút, quét `FamilyEvent` có `startDate` trong 30 phút tới + `reminderSent=false`, tạo notification cho thành viên family
- **Subscription expiry** (đã có chỗ kiểm `subscriptionStatus`): job hàng ngày chuyển ACTIVE → EXPIRED khi quá hạn

---

## 6. Ưu tiên đề xuất

### Phase 1 — Hoàn thiện gap "nhỏ" (1–2 tuần)
- **PRF2–PRF5 Profile (edit displayName, avatar, password, nickname)** — cơ bản, làm trước
- A6 Family status (suspend/lock)
- A7 Set subscription expiry trực tiếp
- A9 Export revenue CSV
- C11 Reward history endpoint + UI
- M4 Message FILE type
- M8 Event reminder cron
- M9 Album video support
- P7 Verify wallet top-up flow

### Phase 2 — Tính năng vận hành (2–3 tuần)
- A10/A11 Docker monitor + logs (dockerode)
- A12/A13 Per-family backup + restore
- P18 Activity log
- P21 Map UI for location
- **PRF6–PRF7 Profile (thống kê cá nhân + session management)**

### Phase 3 — Tính năng mới lớn (3–4 tuần)
- P16/C10 Wearable device pairing + SOS từ thiết bị
- P17 SOS settings
- M12/M13/M14 AI function-calling cho stats + saving advisor
- A2 Dual pricing nếu nghiệp vụ thực sự cần

### Phase 4 — Tùy chọn (nếu nghiệp vụ yêu cầu thật)
- A14 Auto-provision per-family container — chỉ làm nếu khách hàng/đề bài thực sự yêu cầu kiến trúc multi-tenant tách container; **không** khuyến nghị nếu chỉ là demo
