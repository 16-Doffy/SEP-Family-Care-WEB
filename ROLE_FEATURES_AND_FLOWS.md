# Family Care - Role Features & Detailed Flows

Tài liệu này tổng hợp chức năng theo từng vai trò trong project Family Care và mô tả flow hoạt động chính của hệ thống.

## 1. Tổng quan hệ thống

Family Care là hệ thống quản lý gia đình số, tập trung vào việc hỗ trợ phụ huynh quản lý thành viên, ví tiền, nhiệm vụ, lịch sinh hoạt, vị trí, SOS, chat và các tiện ích gia đình.

Kiến trúc hiện tại gồm:

- **Web app**: Next.js/React, chạy ở `http://localhost:3000`.
- **API server**: Express/TypeScript, chạy ở `http://localhost:4000`.
- **Database**: PostgreSQL, truy cập qua Prisma ORM.
- **Realtime**: Socket.IO dùng cho chat, notification, money request và các cập nhật realtime.
- **Cache/infra**: Redis trong Docker stack.
- **Container runtime**: Docker Compose gồm `web`, `api`, `postgres`, `redis`.

Flow tổng quát:

```txt
User Browser
  -> Next.js Web App
  -> Express API
  -> Prisma ORM
  -> PostgreSQL
```

Flow realtime:

```txt
User Browser
  -> Socket.IO Client
  -> Socket.IO Server trong API
  -> Join room theo familyId
  -> Emit event realtime cho các thành viên trong family
```

## 2. Các role chính

Hệ thống hiện có 3 role:

- **SUPER_ADMIN**: quản trị toàn hệ thống.
- **PARENT**: phụ huynh/chủ hộ, quản lý trong phạm vi gia đình.
- **CHILD**: con/thành viên phụ, chỉ thao tác dữ liệu cá nhân hoặc dữ liệu được giao.

Ranh giới dữ liệu quan trọng nhất là `familyId`. Hầu hết chức năng trong app chỉ được phép truy cập dữ liệu thuộc cùng một gia đình.

## 3. SUPER_ADMIN

### 3.1 Mục tiêu vai trò

`SUPER_ADMIN` là quản trị viên hệ thống, dùng để quản lý toàn bộ nền tảng Family Care, theo dõi vận hành, doanh thu, gói dịch vụ, tài khoản và gia đình.

### 3.2 Chức năng chính

#### Quản lý dashboard admin

- Xem tổng quan hệ thống.
- Xem số lượng user.
- Xem số lượng family.
- Xem số lượng subscription/payment.
- Xem trạng thái hệ thống.
- Xem các chỉ số sức khỏe backend/database.

#### Quản lý người dùng

- Xem danh sách user trong hệ thống.
- Tìm kiếm/lọc user.
- Xem thông tin user, role và trạng thái hoạt động.
- Khóa/mở khóa tài khoản.
- Theo dõi user thuộc family nào.

#### Quản lý gia đình

- Xem danh sách family.
- Xem thông tin family, plan, subscription status.
- Xem số lượng thành viên trong family.
- Theo dõi trạng thái subscription của family.
- Hỗ trợ kiểm tra dữ liệu family nếu có lỗi vận hành.

#### Quản lý subscription plans

- Xem danh sách gói dịch vụ.
- Tạo gói mới.
- Cập nhật tên, giá, giới hạn và feature của plan.
- Bật/tắt plan.
- Quản lý giới hạn như số thành viên, số task/tháng và quyền sử dụng feature.

#### Quản lý doanh thu

- Xem tổng doanh thu.
- Xem payment/subscription theo thời gian.
- Xem revenue chart/report.
- Theo dõi payment status.

#### System monitoring

- Xem tình trạng API.
- Xem tình trạng database.
- Xem uptime/health check.
- Kiểm tra backup/export.

#### Backup/export

- Export backup dữ liệu ở mức demo.
- Dùng cho mục đích báo cáo/kiểm thử vận hành.

### 3.3 Quyền hạn API

`SUPER_ADMIN` thường đi qua middleware:

```txt
authenticate
  -> requireRole('SUPER_ADMIN')
  -> admin controller/service
```

Với các API trong phạm vi family, `SUPER_ADMIN` thường được xem như role đặc quyền tương tự parent hoặc cao hơn.

### 3.4 Flow đăng nhập admin

```txt
Admin mở /login
  -> nhập admin@familycare.app / demo1234
  -> POST /api/auth/login
  -> API xác thực email/password
  -> API tạo accessToken + refreshToken
  -> Web lưu token
  -> Web gọi /api/auth/me
  -> Nếu role = SUPER_ADMIN thì cho vào /admin
```

### 3.5 Tài khoản demo

```txt
Email: admin@familycare.app
Password: demo1234
```

## 4. PARENT

### 4.1 Mục tiêu vai trò

`PARENT` là phụ huynh hoặc chủ hộ trong family. Role này quản lý các hoạt động nội bộ gia đình như thành viên, ví tiền, nhiệm vụ, yêu cầu xin tiền, lịch, SOS và subscription.

### 4.2 Chức năng chính

#### Dashboard gia đình

- Xem tổng quan gia đình.
- Xem thông tin ví.
- Xem task gần đây.
- Xem money request đang chờ.
- Xem notification.
- Xem trạng thái subscription/plan.

#### Quản lý gia đình

- Xem thông tin family.
- Xem danh sách thành viên.
- Tạo mã/link mời thành viên.
- Mời thành viên với role `PARENT` hoặc `CHILD`.
- Đổi role thành viên giữa `PARENT` và `CHILD`.
- Xóa thành viên khỏi family.
- Không được tự xóa chính mình.
- Không được đổi/xóa owner theo logic bảo vệ hiện tại.

#### Quản lý ví

- Xem ví chung của gia đình.
- Xem ví cá nhân của các thành viên.
- Xem lịch sử giao dịch.
- Nạp tiền vào ví.
- Chuyển tiền giữa các ví trong cùng family.
- Cấp tiền tiêu vặt cho child.
- Quản lý balance của ví chung.

#### Quản lý money request

- Xem toàn bộ yêu cầu xin tiền trong family.
- Xem danh sách yêu cầu đang chờ duyệt.
- Duyệt yêu cầu xin tiền.
- Từ chối yêu cầu xin tiền.
- Khi duyệt, hệ thống tự động chuyển tiền từ ví chung sang ví cá nhân của requester.
- Gửi notification kết quả cho requester.

#### Quản lý task

- Tạo task mới.
- Gán task cho thành viên.
- Cập nhật người được giao.
- Xem toàn bộ task trong family.
- Xem chi tiết task và proof.
- Duyệt task đã nộp.
- Từ chối task đã nộp.
- Hủy task.
- Gán reward cho task.
- Khi approve task có reward, hệ thống tự động chuyển tiền thưởng từ ví chung sang ví cá nhân của người được giao.

#### Calendar

- Xem lịch gia đình.
- Tạo sự kiện.
- Cập nhật sự kiện.
- Xóa sự kiện.
- Theo tài liệu nghiệp vụ, parent là role chính quản lý calendar.

#### Chat

- Tham gia group chat gia đình.
- Gửi tin nhắn text.
- Gửi ảnh.
- Tạo hoặc tham gia private conversation.
- Nhận tin nhắn realtime.

#### Album

- Xem ảnh gia đình.
- Upload ảnh.
- Xóa ảnh theo quyền uploader hoặc parent/admin.

#### SOS

- Xem SOS alert trong family.
- Xử lý SOS alert.
- Cập nhật trạng thái SOS.
- Nhận realtime/notification khi child hoặc thành viên gửi SOS.

#### Location

- Xem vị trí thành viên trong family nếu họ chia sẻ.
- Cập nhật vị trí của chính mình.
- Quản lý trạng thái chia sẻ vị trí của mình.

#### Subscription/payment

- Xem gói hiện tại.
- Mở dialog nâng cấp gói.
- Tạo checkout/payment mock.
- Confirm payment mock.
- Sau khi confirm, family subscription được cập nhật.

#### AI assistant

- Sử dụng AI chat assistant.
- Hỏi đáp trong phạm vi hỗ trợ gia đình.

### 4.3 Flow parent tạo family khi đăng ký

```txt
Parent mở /register
  -> nhập email/password/displayName/familyName
  -> POST /api/auth/register
  -> API tạo User role PARENT
  -> API tạo Family
  -> API tạo FamilyMember isOwner = true
  -> API tạo ví chung JOINT
  -> API tạo ví cá nhân PERSONAL cho parent
  -> API tạo accessToken + refreshToken
  -> Web lưu token
  -> Redirect vào dashboard
```

### 4.4 Flow parent mời thành viên

```txt
Parent vào trang Family
  -> chọn role muốn mời: PARENT hoặc CHILD
  -> POST /api/family/invite
  -> API tạo invite code có hạn dùng
  -> Web tạo link /register?invite=CODE
  -> Parent gửi link cho thành viên
```

Người được mời:

```txt
Member mở link invite
  -> Web đọc invite code
  -> Member đăng ký tài khoản
  -> API validate invite code
  -> API tạo User
  -> API tạo FamilyMember trong family tương ứng
  -> API tạo ví cá nhân cho member
  -> Invite code được đánh dấu đã dùng
```

### 4.5 Flow parent chuyển tiền

```txt
Parent mở Wallet
  -> chọn ví nguồn và ví đích
  -> nhập số tiền và mô tả
  -> POST /api/wallets/transfer
  -> Middleware kiểm tra authenticate + requireFamily + requireRole(PARENT/SUPER_ADMIN)
  -> Service kiểm tra 2 ví thuộc cùng family
  -> Service kiểm tra số dư ví nguồn
  -> Prisma transaction:
       - trừ tiền ví nguồn
       - cộng tiền ví đích
       - tạo transaction record
  -> API trả transaction mới
  -> Web refresh danh sách ví/giao dịch
```

### 4.6 Flow parent duyệt money request

```txt
Child tạo money request
  -> Parent nhận notification/realtime event
  -> Parent vào Money Request/Wallet page
  -> Parent chọn approve hoặc reject
  -> PATCH /api/money-requests/:id
  -> API kiểm tra role PARENT/SUPER_ADMIN
  -> Nếu approve:
       - tìm ví chung của family
       - tìm ví cá nhân của requester
       - chuyển tiền từ ví chung sang ví cá nhân
       - cập nhật request status APPROVED
  -> Nếu reject:
       - cập nhật request status REJECTED
  -> API gửi notification cho requester
  -> API emit socket event money-request:update
```

### 4.7 Flow parent duyệt task

```txt
Child submit proof
  -> Task chuyển sang SUBMITTED
  -> Parent nhận notification
  -> Parent mở Task detail
  -> Parent xem proof/note
  -> Parent approve hoặc reject
```

Nếu approve:

```txt
PATCH /api/tasks/:id/approve
  -> API kiểm tra role PARENT/SUPER_ADMIN
  -> Service kiểm tra transition hợp lệ
  -> Task chuyển APPROVED
  -> Nếu task có reward:
       - tìm ví chung
       - tìm ví cá nhân của child
       - chuyển reward
       - tạo transaction liên kết task
  -> Gửi notification cho child
```

Nếu reject:

```txt
PATCH /api/tasks/:id/reject
  -> Task chuyển REJECTED
  -> Gửi notification cho child
```

## 5. CHILD

### 5.1 Mục tiêu vai trò

`CHILD` là thành viên phụ trong family. Role này được thiết kế để dùng các chức năng cá nhân, nhận nhiệm vụ, gửi bằng chứng hoàn thành, xin tiền, chat, chia sẻ vị trí và gửi SOS.

### 5.2 Chức năng chính

#### Dashboard cá nhân

- Xem thông tin tổng quan cá nhân.
- Xem task được giao.
- Xem ví cá nhân.
- Xem notification.
- Xem trạng thái money request của mình.

#### Wallet cá nhân

- Xem ví cá nhân của mình.
- Xem giao dịch liên quan đến ví cá nhân.
- Không xem ví cá nhân của người khác.
- Không xem ví chung nếu không được backend cho phép.
- Không được nạp tiền.
- Không được chuyển tiền trực tiếp.

#### Money request

- Tạo yêu cầu xin tiền.
- Nhập số tiền và lý do.
- Xem danh sách request do chính mình tạo.
- Xem trạng thái pending/approved/rejected của request của mình.
- Nhận notification khi parent xử lý.
- Không xem request của thành viên khác.
- Không được approve/reject request.

#### Task

- Xem task được giao cho mình.
- Xem chi tiết task được giao.
- Bắt đầu task.
- Nộp proof hoàn thành task.
- Upload ảnh proof hoặc nhập note.
- Theo dõi trạng thái task.
- Nhận reward khi task được parent approve.
- Không xem task của người khác.
- Không start/submit proof task không được giao.
- Không tạo/giao/hủy/duyệt task.

#### Chat

- Tham gia chat gia đình.
- Gửi tin nhắn text.
- Gửi ảnh.
- Nhận tin nhắn realtime.
- Chat riêng nếu được tạo conversation.

#### Album

- Xem album gia đình.
- Upload ảnh.
- Xóa ảnh của chính mình nếu service cho phép.
- Không xóa ảnh của người khác nếu không có quyền.

#### Calendar

- Xem lịch gia đình.
- Nhận thông tin sự kiện.
- Tùy cấu hình hiện tại, có thể tạo/sửa event nếu route cho phép.
- Theo nghiệp vụ strict, child nên chủ yếu là view calendar.

#### SOS

- Gửi SOS alert.
- Gửi vị trí hiện tại nếu có.
- Gửi message khẩn cấp.
- Parent/admin nhận alert và xử lý.

#### Location

- Cập nhật vị trí của chính mình.
- Bật/tắt chia sẻ vị trí.
- Xem vị trí các thành viên trong family theo quyền hiện tại.

#### AI assistant

- Sử dụng AI assistant.

### 5.3 Flow child đăng ký qua invite

```txt
Child nhận link invite từ parent
  -> mở /register?invite=CODE
  -> nhập email/password/displayName
  -> POST /api/auth/register
  -> API validate invite code
  -> API tạo User role theo invite
  -> API tạo FamilyMember trong family
  -> API tạo ví cá nhân
  -> API tạo token
  -> Web redirect dashboard
```

### 5.4 Flow child xin tiền

```txt
Child mở Wallet/Money Request
  -> nhập amount và reason
  -> POST /api/money-requests
  -> API kiểm tra user thuộc family
  -> API tạo MoneyRequest status PENDING
  -> API tìm parent/admin trong family
  -> API gửi notification MONEY_REQUEST cho parent/admin
  -> API emit socket event money-request:new vào room family
  -> Child thấy request của mình trong danh sách
```

Khi parent xử lý:

```txt
Parent approve/reject
  -> API cập nhật request
  -> API gửi notification MONEY_RESOLVED cho child
  -> API emit money-request:update
  -> Child UI cập nhật trạng thái
```

### 5.5 Flow child làm task

```txt
Child mở Tasks
  -> GET /api/tasks
  -> Backend lọc assignedToId = familyMemberId của child
  -> Child chỉ thấy task của mình
```

Bắt đầu task:

```txt
Child chọn Start
  -> PATCH /api/tasks/:id/start
  -> Backend kiểm tra task thuộc family
  -> Backend kiểm tra task.assignedToId == child.familyMemberId
  -> Backend kiểm tra transition PENDING -> IN_PROGRESS hợp lệ
  -> Task cập nhật IN_PROGRESS
```

Nộp proof:

```txt
Child upload ảnh/ghi chú
  -> POST /api/tasks/:id/proof
  -> Backend kiểm tra task.assignedToId == child.familyMemberId
  -> Backend kiểm tra task đang IN_PROGRESS
  -> Backend lưu TaskProof
  -> Backend chuyển task sang SUBMITTED
  -> Backend gửi notification cho parent/creator
```

Nhận thưởng:

```txt
Parent approve task
  -> Backend chuyển task sang APPROVED
  -> Nếu reward > 0:
       ví chung bị trừ reward
       ví cá nhân child được cộng reward
       transaction được tạo
  -> Child nhận notification
```

## 6. Flow authentication chi tiết

### 6.1 Login

```txt
Client gửi email/password
  -> POST /api/auth/login
  -> API tìm user theo email
  -> So sánh password với passwordHash bằng bcrypt
  -> Kiểm tra isActive
  -> Lấy familyMember nếu có
  -> Tạo accessToken chứa:
       userId
       email
       role
       familyId
       familyMemberId
  -> Tạo refreshToken chứa:
       userId
       jti random
  -> Lưu refreshToken vào DB
  -> Trả token và user về client
```

### 6.2 Authenticated request

```txt
Client gọi API kèm Authorization: Bearer accessToken
  -> authenticate middleware verify token
  -> Gắn req.user gồm userId, role, familyId, familyMemberId
  -> Route tiếp tục xử lý
```

### 6.3 Role guard

```txt
Request vào protected route
  -> authenticate
  -> requireRole(...allowedRoles)
  -> Nếu role hợp lệ: cho qua
  -> Nếu không: trả 403 Forbidden
```

### 6.4 Family guard

```txt
Request vào family route
  -> authenticate
  -> requireFamily
  -> Nếu token có familyId/familyMemberId: cho qua
  -> Nếu không: trả lỗi chưa thuộc family
```

### 6.5 Refresh token

```txt
Client gửi refreshToken
  -> API kiểm tra token có tồn tại trong DB không
  -> API kiểm tra expiresAt
  -> API verify chữ ký JWT
  -> API tạo cặp token mới
  -> API xóa refreshToken cũ
  -> API lưu refreshToken mới
  -> Trả token mới
```

Refresh token hiện có `jti` random để tránh lỗi trùng unique token khi login/refresh nhiều lần gần nhau.

## 7. Flow dữ liệu theo family

Hầu hết bảng nghiệp vụ gắn với `familyId`:

- Wallet
- Task
- MoneyRequest
- Conversation
- FamilyEvent
- SosAlert
- Album/Photo
- Location
- Notification gián tiếp theo user

Nguyên tắc:

```txt
User chỉ được truy cập dữ liệu thuộc familyId trong token
```

Với child, ngoài `familyId`, nhiều module còn lọc thêm theo `familyMemberId` hoặc `userId`.

Ví dụ:

```txt
Child xem task
  -> where familyId = req.user.familyId
  -> and assignedToId = req.user.familyMemberId
```

```txt
Child xem money request
  -> where familyId = req.user.familyId
  -> and requesterId = req.user.familyMemberId
```

```txt
Child xem wallet
  -> where familyId = req.user.familyId
  -> and ownerId = req.user.familyMemberId
```

## 8. Flow wallet chi tiết

### 8.1 Các loại ví

- **JOINT**: ví chung của family.
- **PERSONAL**: ví cá nhân của từng member.

### 8.2 Xem danh sách ví

Parent/admin:

```txt
GET /api/wallets
  -> trả toàn bộ ví trong family
```

Child:

```txt
GET /api/wallets
  -> trả ví cá nhân có ownerId = child.familyMemberId
```

### 8.3 Xem chi tiết ví

Parent/admin:

```txt
GET /api/wallets/:id
  -> xem ví thuộc family
  -> xem 50 transaction gần nhất liên quan đến ví
```

Child:

```txt
GET /api/wallets/:id
  -> chỉ xem được nếu wallet.ownerId = child.familyMemberId
```

### 8.4 Transfer

```txt
POST /api/wallets/transfer
  -> chỉ PARENT/SUPER_ADMIN
  -> kiểm tra fromWallet và toWallet thuộc cùng family
  -> kiểm tra balance
  -> Prisma transaction:
       update balance ví nguồn
       update balance ví đích
       create transaction
```

### 8.5 Deposit

```txt
POST /api/wallets/deposit
  -> chỉ PARENT/SUPER_ADMIN
  -> kiểm tra wallet thuộc family
  -> cộng balance
  -> tạo transaction DEPOSIT
```

## 9. Flow task chi tiết

### 9.1 State machine

Task có thể đi qua các trạng thái chính:

```txt
PENDING
  -> IN_PROGRESS
  -> SUBMITTED
  -> APPROVED
```

Hoặc:

```txt
SUBMITTED
  -> REJECTED
```

Hoặc:

```txt
PENDING/IN_PROGRESS/SUBMITTED
  -> CANCELLED
```

### 9.2 Tạo task

```txt
Parent tạo task
  -> kiểm tra plan limit
  -> validate assignedToId thuộc family
  -> tạo task
  -> gửi notification nếu có assignee
```

### 9.3 Làm task

```txt
Child start task
  -> kiểm tra task được giao cho child
  -> PENDING -> IN_PROGRESS
```

```txt
Child submit proof
  -> kiểm tra task được giao cho child
  -> kiểm tra status IN_PROGRESS
  -> tạo TaskProof
  -> IN_PROGRESS -> SUBMITTED
```

### 9.4 Duyệt task

```txt
Parent approve
  -> SUBMITTED -> APPROVED
  -> nếu reward > 0 thì chuyển tiền thưởng
```

```txt
Parent reject
  -> SUBMITTED -> REJECTED
```

## 10. Flow money request chi tiết

### 10.1 Tạo request

```txt
Child/Member nhập amount + reason
  -> API validate amount > 0
  -> tạo MoneyRequest PENDING
  -> gửi notification cho parent/admin
  -> emit realtime event
```

### 10.2 Xem request

Parent/admin:

```txt
GET /api/money-requests
  -> toàn bộ request trong family
```

Child:

```txt
GET /api/money-requests
  -> chỉ request do child tạo
```

### 10.3 Resolve request

```txt
Parent approve/reject
  -> nếu APPROVED:
       chuyển tiền từ ví chung sang ví requester
  -> update request status
  -> lưu người xử lý
  -> gửi notification cho requester
  -> emit realtime event
```

## 11. Flow chat chi tiết

### 11.1 Kết nối socket

```txt
Web app load
  -> lấy accessToken
  -> mở Socket.IO connection tới API
  -> API xác thực token
  -> socket join room family:{familyId}
```

### 11.2 Group chat

```txt
Member gửi message
  -> POST hoặc socket event tạo message
  -> message lưu DB
  -> API emit message tới room family
  -> các member khác nhận realtime
```

### 11.3 Private chat

```txt
Member chọn người muốn chat riêng
  -> API tìm hoặc tạo conversation PRIVATE
  -> thêm participants
  -> gửi message trong conversation
```

## 12. Flow notification

Notification được tạo khi có sự kiện quan trọng:

- Task được giao.
- Task được duyệt/từ chối.
- Money request mới.
- Money request được xử lý.
- SOS alert.
- Chat hoặc các event cần realtime khác.

Flow:

```txt
Service nghiệp vụ xử lý xong
  -> gọi notificationService.createNotification
  -> lưu Notification trong DB
  -> emit socket event nếu cần
  -> Web hiển thị badge/toast/list notification
```

## 13. Flow SOS

### 13.1 Tạo SOS

```txt
Member bấm SOS
  -> gửi latitude/longitude/message nếu có
  -> API tạo SosAlert status ACTIVE
  -> API gửi notification tới parent/admin/family
  -> API emit realtime SOS event
```

### 13.2 Xử lý SOS

```txt
Parent/admin mở SOS page
  -> xem alert ACTIVE
  -> cập nhật status RESOLVED/CANCELLED
  -> API lưu resolvedBy/resolvedAt
  -> emit update realtime
```

## 14. Flow location

```txt
Member bật location sharing
  -> Web lấy vị trí từ browser/device
  -> gửi tọa độ lên API
  -> API lưu latest location
  -> Member khác trong family xem map/list location
```

Nguyên tắc:

- Dữ liệu vị trí thuộc family.
- User chỉ cập nhật vị trí của chính mình.
- Các thành viên trong cùng family xem theo quyền hiện tại.

## 15. Flow calendar

```txt
Member mở Calendar
  -> GET events theo familyId
  -> Web hiển thị lịch
```

Tạo/sửa/xóa:

```txt
User tạo event
  -> API lưu FamilyEvent với createdById
  -> Web refresh calendar
```

Theo nghiệp vụ strict:

- Parent nên là người quản lý event.
- Child nên chủ yếu xem event.

Hiện trạng có thể cho phép collaborative calendar tùy route hiện tại.

## 16. Flow album

```txt
Member upload ảnh
  -> API nhận file upload
  -> lưu file
  -> tạo photo record trong DB
  -> Web hiển thị trong album
```

Xóa ảnh:

```txt
Uploader hoặc Parent/SUPER_ADMIN
  -> DELETE photo
  -> API kiểm tra quyền
  -> xóa record/file tương ứng
```

## 17. Flow subscription/payment

### 17.1 Xem plan

```txt
Parent mở upgrade dialog
  -> Web gọi API subscription plans
  -> hiển thị gói FREE/PREMIUM/...
```

### 17.2 Mock checkout

```txt
Parent chọn plan
  -> POST create checkout/payment
  -> API tạo payment record mock
  -> Parent confirm mock payment
  -> API cập nhật payment status
  -> API cập nhật family subscription plan/status/expiresAt
```

### 17.3 Plan limit

Một số service kiểm tra giới hạn plan:

```txt
Tạo member
  -> kiểm tra maxMembers
```

```txt
Tạo task
  -> kiểm tra maxTasksPerMonth
```

Nếu vượt giới hạn, API trả lỗi yêu cầu nâng cấp gói.

## 18. Flow AI assistant

```txt
Member mở AI Chat
  -> gửi prompt
  -> API nhận request
  -> nếu có OPENAI_API_KEY thì gọi OpenAI
  -> nếu không có thì dùng fallback/mock response
  -> trả câu trả lời về Web
```

## 19. Matrix chức năng theo role

| Chức năng | SUPER_ADMIN | PARENT | CHILD |
|---|---:|---:|---:|
| Đăng nhập | Có | Có | Có |
| Xem dashboard cá nhân | Có | Có | Có |
| Xem admin dashboard | Có | Không | Không |
| Quản lý users toàn hệ thống | Có | Không | Không |
| Quản lý families toàn hệ thống | Có | Không | Không |
| Quản lý subscription plans | Có | Không | Không |
| Xem revenue/admin report | Có | Không | Không |
| Export backup/report | Có | Không | Không |
| Xem family của mình | Có | Có | Có |
| Mời thành viên | Có | Có | Không |
| Đổi role member | Có | Có | Không |
| Xóa member | Có | Có | Không |
| Xem toàn bộ ví trong family | Có | Có | Không |
| Xem ví cá nhân của mình | Có | Có | Có |
| Nạp tiền | Có | Có | Không |
| Chuyển tiền | Có | Có | Không |
| Tạo money request | Có | Có | Có |
| Xem toàn bộ money request family | Có | Có | Không |
| Xem money request của mình | Có | Có | Có |
| Duyệt/từ chối money request | Có | Có | Không |
| Tạo task | Có | Có | Không |
| Giao task | Có | Có | Không |
| Xem toàn bộ task family | Có | Có | Không |
| Xem task được giao | Có | Có | Có |
| Start task được giao | Có | Có | Có |
| Submit proof task được giao | Có | Có | Có |
| Approve/reject task | Có | Có | Không |
| Hủy task | Có | Có | Không |
| Chat family | Có | Có | Có |
| Upload album | Có | Có | Có |
| Xóa ảnh của mình | Có | Có | Có |
| Xóa ảnh người khác | Có | Có | Không |
| Xem calendar | Có | Có | Có |
| Quản lý calendar | Có | Có | Tùy cấu hình route |
| Gửi SOS | Có | Có | Có |
| Xử lý SOS | Có | Có | Không |
| Cập nhật location của mình | Có | Có | Có |
| Xem location family | Có | Có | Có |
| Nâng cấp subscription | Có | Có | Không |
| AI assistant | Có | Có | Có |

## 20. Các tài khoản demo

```txt
Admin:
  Email: admin@familycare.app
  Password: demo1234

Parent:
  Email: parent@demo.com
  Password: demo1234

Child 1:
  Email: minh@demo.com
  Password: demo1234

Child 2:
  Email: lan@demo.com
  Password: demo1234
```

## 21. Các URL thường dùng

```txt
Web app:
  http://localhost:3000

API:
  http://localhost:4000

Login:
  http://localhost:3000/login

Admin dashboard:
  http://localhost:3000/admin

Family page:
  http://localhost:3000/family

Wallet page:
  http://localhost:3000/wallet

Task page:
  http://localhost:3000/tasks
```

## 22. Tóm tắt nghiệp vụ cốt lõi

Family Care vận hành theo mô hình:

```txt
SUPER_ADMIN quản lý platform
PARENT quản lý family
CHILD sử dụng chức năng cá nhân trong family
```

Các nguyên tắc chính:

- `familyId` là ranh giới dữ liệu chính.
- `role` quyết định user được thực hiện hành động nào.
- `familyMemberId` quyết định dữ liệu cá nhân trong family.
- Các thao tác tiền dùng Prisma transaction để đảm bảo an toàn balance.
- Các sự kiện quan trọng tạo notification và có thể emit realtime qua Socket.IO.
- Subscription plan kiểm soát giới hạn sử dụng như số thành viên và số task.
