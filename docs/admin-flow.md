# Family Care — SUPER_ADMIN Flow & Mobile Wireframes

Tài liệu tham khảo cho thiết kế Figma mobile. Tổng hợp toàn bộ flow, screen,
state và token màu cho role **SUPER_ADMIN**.

---

## 1. Site map

```
Login
  └─► role = SUPER_ADMIN ──► Admin Dashboard (/admin)
            │
            ├─ Tab 1: Tổng quan  → /admin
            ├─ Tab 2: Gia đình   → /admin#families  (scroll anchor)
            ├─ Tab 3: Gói        → /admin/plans
            ├─ Tab 4: Doanh thu  → /admin/revenue
            └─ Tab 5: Thêm (bottom sheet)
                  ├─ Hệ thống & Docker (scroll #admin-system)
                  ├─ Xuất backup hệ thống
                  ├─ Về dashboard user thường
                  └─ Đăng xuất
```

## 2. Khung chung mọi screen

```
┌────────────────────────────┐
│ [←]  Tiêu đề          [🔔]  │ ← Topbar (← chỉ hiện ở sub-page)
├────────────────────────────┤
│                            │
│        NỘI DUNG            │
│                            │
├────────────────────────────┤
│  🏠   👥   👑   📊   ⋯     │ ← Bottom nav (5 tab)
│  TQ  GĐ   Gói  DT  Thêm   │
└────────────────────────────┘
```

## 3. Bản đồ API ↔ UI

| API | UI element |
|---|---|
| `GET /admin/stats` | Home — 3 KPI |
| `GET /admin/system/health` (30s) | Home — Health card |
| `GET /admin/system/docker` (30s) | Home — Docker list |
| `GET /admin/system/logs/:container` | Home — Xem log |
| `GET /admin/backup/export` | Home — Xuất backup |
| `GET /admin/families` | Home — list & operations |
| `PUT /admin/families/:id/owner` | Operations — đổi chủ hộ |
| `PATCH /admin/families/:id/status` | Operations — đổi status |
| `PATCH /admin/families/:id/subscription` | Operations — đổi hạn |
| `POST /admin/families/:id/renew` | Operations — Gia hạn nhanh |
| `POST /admin/families/:id/provision` | Operations — Provision |
| `GET /admin/families/:id/backup` | Operations — Backup family |
| `POST /admin/families/:id/restore` | Operations — Restore |
| `PUT /admin/families/:id/plan` | Families card — đổi gói |
| `GET/POST/PUT/DELETE /admin/plans` | /admin/plans |
| `GET /admin/users` + `PUT /admin/users/:id` | Home — khóa/mở user |
| `GET /admin/revenue` + `/revenue/export` | /admin/revenue |

## 4. Screen 1 — Login

```
┌─────────────────────────────┐
│                             │
│        🏡 Family Care       │
│      Quản trị hệ thống      │
│                             │
│  Email                      │
│  ┌─────────────────────┐    │
│  │ admin@familycare.vn │    │
│  └─────────────────────┘    │
│                             │
│  Mật khẩu              👁    │
│  ┌─────────────────────┐    │
│  │ ●●●●●●●●●●          │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────────┐│
│  │      Đăng nhập          ││
│  └─────────────────────────┘│
│                             │
│  Quên mật khẩu?             │
└─────────────────────────────┘
```

**Flow:** POST `/auth/login` → nhận token + user → nếu `role === 'SUPER_ADMIN'`
push `/admin`, ngược lại push `/dashboard`.

## 5. Screen 2 — Admin Home `/admin`

```
┌─────────────────────────────┐
│  Admin Dashboard       🔔   │
├─────────────────────────────┤
│  ┌───────┬───────┬───────┐  │
│  │👑 Gói │📈 DT  │⬇ B/up │  │
│  └───────┴───────┴───────┘  │
│                             │
│ ┌─────────┬───────┬───────┐ │
│ │🏠 128   │👥1204 │⚡ 342 │ │
│ │Gia đình │Users  │Active │ │
│ └─────────┴───────┴───────┘ │
│                             │
│ ┌───┬───┬───┬───┐           │
│ │API│ DB│CPU│⬆  │           │
│ │ ✅│ ✅│8c │2.4G│           │
│ └───┴───┴───┴───┘           │
│                             │
│  🐳 Docker & logs           │
│ ┌─────────────────────────┐ │
│ │ ● fc_api      running   │ │
│ │   CPU 12% · RAM 380MB   │ │
│ ├─────────────────────────┤ │
│ │ ● fc_postgres running   │ │
│ │   CPU 3% · RAM 120MB    │ │
│ └─────────────────────────┘ │
│  [fc_api    ] [Xem log]     │
│                             │
│  Danh sách gia đình         │
│  ┌─────────────────────┐    │
│  │ Gia đình Nguyễn     │    │
│  │ 👥 5 · 14/01/2026   │    │
│  │ Gói: [Premium    ▼] │    │
│  └─────────────────────┘    │
│                             │
│  Vận hành gia đình          │
│  ┌─────────────────────┐    │
│  │ Gia đình Nguyễn  ✅ │    │
│  │ Chủ hộ:  [A  ▼]     │    │
│  │ Status / Hết hạn    │    │
│  │ Gia hạn: [+1 ▼]     │    │
│  │ [Provis][Backup][R] │    │
│  └─────────────────────┘    │
│                             │
│  Người dùng                 │
│  ┌─────────────────────┐    │
│  │ Trần B   🔵PARENT   │    │
│  │ b@gmail.com  Active │    │
│  │ [    Khóa    ]      │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  🏠   👥   👑   📊   ⋯      │
└─────────────────────────────┘
```

## 6. Screen 3 — Plans `/admin/plans`

```
┌─────────────────────────────┐
│ ← Quản lý gói thuê bao  🔔  │
├─────────────────────────────┤
│  Tạo các gói và gán cho     │
│  từng gia đình.             │
│                  [+ Tạo gói]│
│                             │
│  ┌─────────────────────┐    │
│  │ Pro tháng     ✏️ 🗑 │    │
│  │ PRO_MONTHLY MONTHLY │    │
│  │ 49.000 VND          │    │
│  │ 👥 8 · ✓ 100 task/th│    │
│  │ ✓ Chat gia đình     │    │
│  │ ✓ Album KGH         │    │
│  │ ●Active · 32 gia đình│   │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ Free          ✏️ 🗑 │    │
│  │ FREE · FREE         │    │
│  │ Miễn phí            │    │
│  │ 👥 3 · ✓ 20 task/th │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### Sub-screen — Form Tạo/Sửa gói (full-screen)

```
┌─────────────────────────────┐
│ ✕  Tạo gói mới         Lưu  │
├─────────────────────────────┤
│ Mã (UPPER_SNAKE)            │
│ [ PRO_MONTHLY      ]        │
│                             │
│ Tên hiển thị                │
│ [ Pro tháng        ]        │
│                             │
│ Mô tả                       │
│ [                  ]        │
│                             │
│ Giá  / Tiền tệ / Chu kỳ     │
│ [49000][VND][MONTHLY ▼]     │
│                             │
│ Giá tháng / Giá năm         │
│ [49000] [490000]            │
│                             │
│ Max thành viên / Task/tháng │
│ [   8 ] [  100  ]           │
│ (trống = không giới hạn)    │
│                             │
│ Tính năng (mỗi dòng 1)      │
│ [ Chat gia đình      ]      │
│ [ Album không giới hạn]     │
│                             │
│ Thứ tự [0]  ☑ Đang dùng     │
└─────────────────────────────┘
```

**Rule xoá:** chặn nếu `_count.families > 0` → toast lỗi.

## 7. Screen 4 — Revenue `/admin/revenue`

```
┌─────────────────────────────┐
│ ← Thống kê doanh thu  ⬇CSV  │
├─────────────────────────────┤
│ ┌─────────────────────┐     │
│ │ 💵 MRR              │     │
│ │ 12.450.000 ₫        │     │
│ └─────────────────────┘     │
│ ┌─────────────────────┐     │
│ │ 📈 ARR              │     │
│ │ 149.400.000 ₫       │     │
│ └─────────────────────┘     │
│ ┌─────────────────────┐     │
│ │ 💳 30 ngày · 142 GD │     │
│ │ 8.920.000 ₫         │     │
│ └─────────────────────┘     │
│ ┌─────────────────────┐     │
│ │ 👥 Subs active 87    │    │
│ └─────────────────────┘     │
│                             │
│  Cơ cấu 30 ngày             │
│  Đăng ký gói   60%          │
│  ████████░░░░  5.4M ₫       │
│  Nạp ví        40%          │
│  ██████░░░░░░  3.5M ₫       │
│                             │
│  12 tháng gần nhất          │
│   ▁▂▃▄▅▆▇█▇▆▅▆             │
│   05 06 07 08 09 10 11 12   │
└─────────────────────────────┘
```

## 8. Bottom sheet "Thêm" (tab 5)

```
┌─────────────────────────────┐
│  Khác                  ✕    │
├─────────────────────────────┤
│  ┌──────────────────────┐   │
│  │ Super Admin          │   │
│  │ admin@familycare.vn  │   │
│  └──────────────────────┘   │
│                             │
│  🖥  Hệ thống & Docker      │
│  ⬇  Xuất backup hệ thống    │
│  🏠  Về dashboard user      │
│  ──────────────────────────  │
│  🚪  Đăng xuất    (đỏ)      │
└─────────────────────────────┘
```

## 9. 7 user flow demo

| # | Flow | Bấm vào đâu |
|---|---|---|
| 1 | **Đăng nhập admin** | Login → submit → check role → /admin |
| 2 | **Theo dõi sức khỏe** | Home → cuộn health/Docker (auto refetch 30s) |
| 3 | **Tạo gói + áp gia đình** | Tab Gói → "+" → form → Lưu → Tab TQ → card family → đổi gói |
| 4 | **Vận hành 1 gia đình** | Home #families → card Vận hành → đổi chủ hộ / status / hạn / Gia hạn / Provision |
| 5 | **Backup & restore family** | Card Vận hành → Backup (JSON) / Restore (upload JSON) |
| 6 | **Khóa user vi phạm** | Home → cuộn Users → card user → "Khóa tài khoản" |
| 7 | **Báo cáo doanh thu** | Tab DT → xem KPI + chart → "Xuất CSV" |

## 10. State variants cần vẽ cho mỗi screen

- **Loading**: skeleton cards xám nhấp nháy
- **Empty**: icon + "Chưa có dữ liệu"
- **Error 403**: "Bạn không phải SUPER_ADMIN" → redirect
- **Confirm dialog**: Xoá gói / SOS / Logout
- **Toast**: success (xanh) / error (đỏ) — góc trên
- **Bottom sheet "Thêm"**: như section 8

## 11. Design tokens

| Token | Giá trị |
|---|---|
| Frame | 375 × 812 (iPhone 14) |
| Primary admin | `violet-600` `#7C3AED` |
| Success / Active | `green-600` |
| Warning / Suspend | `amber-500` |
| Danger / Lock | `red-600` |
| Role badge | SUPER_ADMIN đỏ · PARENT xanh · CHILD xám |
| Radius | 8 card · 12 sheet · 999 pill |
| Spacing | 4 / 8 / 12 / 16 / 24 |
| Font | Inter — 12 / 14 / 16 / 20 / 24 / 32 |
| Bottom nav h | 64 px |
| Topbar h | 64 px |
| Touch target | ≥ 44 px |

## 12. Component cần build trong Figma

- `Topbar` (variants: with-back / no-back)
- `BottomNav` (5 tabs, active state violet)
- `Card`
- `StatCard` (icon + label + value + hint)
- `RoleBadge` (3 variants)
- `StatusChip` (Active / Suspended / Locked)
- `BottomSheet`
- `Dialog` (Confirm / Form)
- `Toast` (Success / Error)
- `EmptyState`
- `Skeleton`
- `BarChart` (12 cột)
- `ProgressBar` (cơ cấu doanh thu)

## 13. Còn có thể mở rộng

API hiện có nhưng chưa wire UI = **không có**. Tất cả endpoint đã được dùng.

Đề xuất mở rộng (chưa có API):
- Search/filter/pagination cho families & users
- Trang chi tiết family / user riêng
- Audit log (ai-làm-gì-khi-nào)
- Đổi role user
- Xoá user/family (hiện chỉ khóa)
- Gửi thông báo broadcast tới family/user
- Cấu hình hệ thống (env, feature flag)
- Moderation chat/album
