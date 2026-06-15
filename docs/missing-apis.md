# API còn thiếu cho Frontend (Family Care)

> So sánh giữa nhu cầu của **frontend** (`apps/web`) và **API team đã deploy** tại
> `http://103.110.84.66` (Swagger: `/api/docs`, OpenAPI: `/api/docs-json`).
>
> Quy ước chung của API team — đề nghị giữ nguyên cho các endpoint mới:
> - Prefix: `/api/v1`
> - Response envelope: `{ "success": boolean, "message": string, "data": <payload> }`
> - Tài nguyên gia đình scope theo `/families/{familyId}/...`
> - Số tiền trả về dạng chuỗi (Decimal)
>
> Trạng thái hiện tại của FE: các phần **auth / families / finance / invitations** đã wire vào
> API team và chạy được. Các nhóm dưới đây là phần FE cần nhưng swagger **chưa có**.

---

## 1. Auth — self-service (ưu tiên cao)

Đã có: `register`, `login`, `refresh`, `logout`, `GET /auth/me`. Còn thiếu:

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `PATCH` | `/auth/me` | Người dùng tự cập nhật hồ sơ | `{ fullName?, phone?, avatarUrl? }` → `data: User` |
| `POST` | `/auth/change-password` | Đổi mật khẩu | `{ currentPassword, newPassword }` |
| `GET` | `/auth/me/sessions` | Danh sách phiên (refresh token) đang hoạt động | `data: [{ id, createdAt, expiresAt, userAgent? }]` |
| `DELETE` | `/auth/me/sessions/{id}` | Thu hồi 1 phiên | — |

## 2. Quản lý thành viên ở cấp gia đình

Hiện chỉ có ở khu admin (`/admin/family-members/...`). Family Manager cần:

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `PATCH` | `/families/{familyId}/members/{userId}` | Đổi vai trò / hồ sơ thành viên | `{ familyRole?, relationship?, displayName?, status? }` |
| `GET` | `/families/{familyId}/invitations` | Liệt kê lời mời (đang chờ / đã dùng) | `data: [Invitation]` — hiện chỉ `POST` được, không list được |

> Ghi chú: `GET /families/my` đang trả members **rút gọn** (`{ familyRole, relationship, joinedAt }`).
> FE đang phải gọi thêm `GET /families/{id}` để lấy members đầy đủ. Nếu `/families/my`
> trả luôn `id/userId/user` cho members thì FE đỡ 1 vòng request.

## 3. Nhiệm vụ (Tasks) — thiếu hoàn toàn

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `GET` | `/families/{familyId}/tasks` | Danh sách nhiệm vụ | query: `status?, assigneeId?` |
| `POST` | `/families/{familyId}/tasks` | Giao nhiệm vụ | `{ title, description?, assigneeMemberId?, dueDate?, reward? }` |
| `PATCH` | `/families/{familyId}/tasks/{taskId}` | Cập nhật trạng thái (IN_PROGRESS / SUBMITTED / APPROVED / REJECTED) | `{ status, proofImageUrl?, note? }` |
| `GET/POST` | `/families/{familyId}/recurring-tasks` | Nhiệm vụ lặp lại | `{ title, schedule, assigneeMemberId? }` |
| `POST` | `/families/{familyId}/recurring-tasks/generate-today` | Sinh nhiệm vụ cho hôm nay | — |

## 4. Thông báo & Realtime — thiếu hoàn toàn

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/notifications` | `data: { notifications: [...], unreadCount }` |
| `PATCH` | `/notifications/read-all` | Đánh dấu đã đọc tất cả |
| WebSocket | `socket.io` (vd `/socket.io`) | Sự kiện `notification:new`, tin nhắn chat, cảnh báo SOS realtime |

## 5. Trò chuyện (Chat) — thiếu hoàn toàn

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `GET/POST` | `/families/{familyId}/chat/conversations` | Danh sách / tạo hội thoại | `{ type: PRIVATE\|GROUP, memberIds[] }` |
| `GET/POST` | `/chat/conversations/{id}/messages` | Lấy / gửi tin nhắn | `{ content }`, hoặc upload ảnh/file/vị trí |

## 6. Album ảnh — thiếu hoàn toàn

| Method | Path | Mục đích |
|---|---|---|
| `GET/POST` | `/families/{familyId}/album` | Danh sách / upload ảnh (multipart) |
| `GET` | `/families/{familyId}/album/categories` | Danh mục album |
| `PATCH` | `/album/{id}/category` | Gán danh mục cho ảnh |
| `DELETE` | `/album/{id}` | Xóa ảnh |

## 7. Lịch gia đình — thiếu hoàn toàn

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `GET/POST` | `/families/{familyId}/calendar` | Sự kiện lịch | `{ title, startAt, endAt?, participantMemberIds[]? }` |
| `PATCH/DELETE` | `/families/{familyId}/calendar/{id}` | Sửa / xóa sự kiện | — |

## 8. Vị trí / Thiết bị / SOS — thiếu hoàn toàn

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/families/{familyId}/location/family` | Vị trí mới nhất của các thành viên |
| `POST` | `/location/update` | Cập nhật vị trí của tôi `{ lat, lng }` |
| `POST` | `/location/toggle` | Bật/tắt chia sẻ vị trí |
| `GET` | `/families/{familyId}/devices` | Thiết bị & GPS |
| `GET` | `/devices/{id}/routes`, `/devices/{id}/location` | Lộ trình / vị trí thiết bị |
| `POST` | `/sos` | Gửi tín hiệu SOS |
| `GET` | `/families/{familyId}/sos/active` | SOS đang hoạt động |

## 9. AI — thiếu hoàn toàn

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `POST` | `/ai/message` | Gửi câu hỏi cho trợ lý AI | `{ message, context? }` |
| `GET` | `/ai/history` | Lịch sử hội thoại AI | — |

## 10. Onboarding / Mua gói cho gia đình — thiếu

Đã có: `GET /subscription-plans` (công khai), CRUD plan ở admin. Còn thiếu luồng để **một gia đình chọn/kích hoạt gói**:

| Method | Path | Mục đích | Payload gợi ý |
|---|---|---|---|
| `GET` | `/families/{familyId}/subscription` | Gói hiện tại + ngày hết hạn | — |
| `POST` | `/families/{familyId}/subscription` | Đăng ký / nâng cấp gói | `{ planId }` (+ luồng thanh toán nếu có) |
| `GET/PATCH` | `/families/{familyId}/onboarding` | Trạng thái kích hoạt workspace | — |

---

## Khác biệt về mô hình (KHÔNG phải thiếu — đã xử lý phía FE)

- **Finance**: team dùng `ledger entries / finance models / jars / budget-plans / financial-goals / support-requests / alerts / reports` thay cho mô hình cũ (`wallets / money-requests / personal-expenses / income-sources`). FE đã viết lại theo model team.
- **Phần team CÓ nhưng FE chưa lên UI** (có thể bổ sung sau, không cần BE làm thêm):
  `budget-plans` (planned-vs-actual), `financial-goals`, `goal-allocations`,
  `support-requests` (yêu cầu hỗ trợ chi tiêu), `alerts` (cảnh báo ngân sách),
  `reports/overview|budget-goal|non-essential-spending`, `monthly-finances/me`.

> Tham chiếu đầy đủ contract hiện có: `docs/api-team-contract.md`.
