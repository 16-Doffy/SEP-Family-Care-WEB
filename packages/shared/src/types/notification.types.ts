/**
 * Định nghĩa các loại thông báo, kiểu dữ liệu Notification và payload Socket.IO.
 * Module này dùng chung cho cả server (phát sự kiện) và client (lắng nghe sự kiện).
 */

/**
 * Tất cả các loại thông báo có thể được gửi trong hệ thống.
 *
 * - `TASK_ASSIGNED`:      Một nhiệm vụ vừa được giao cho thành viên.
 * - `TASK_SUBMITTED`:     Thành viên đã nộp bằng chứng, cần phụ huynh xem xét.
 * - `TASK_APPROVED`:      Nhiệm vụ được phê duyệt, phần thưởng đã được cộng.
 * - `TASK_REJECTED`:      Nhiệm vụ bị từ chối, thành viên cần làm lại.
 * - `TRANSFER_RECEIVED`:  Ví nhận được tiền từ giao dịch chuyển khoản.
 * - `MEMBER_JOINED`:      Thành viên mới gia nhập gia đình qua mã mời.
 * - `CHAT_MESSAGE`:       Tin nhắn mới trong chat nhóm gia đình.
 * - `SOS`:                Tín hiệu khẩn cấp SOS được kích hoạt bởi một thành viên.
 * - `MONEY_REQUEST`:      Thành viên gửi yêu cầu xin tiền đến phụ huynh.
 * - `MONEY_RESOLVED`:     Phụ huynh đã xử lý (đồng ý/từ chối) yêu cầu xin tiền.
 * - `CALENDAR_REMINDER`:  Nhắc nhở sự kiện lịch gia đình sắp đến.
 * - `SYSTEM`:             Thông báo hệ thống chung (bảo trì, cập nhật, v.v.).
 */
export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  TRANSFER_RECEIVED: 'TRANSFER_RECEIVED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  SOS: 'SOS',
  MONEY_REQUEST: 'MONEY_REQUEST',
  MONEY_RESOLVED: 'MONEY_RESOLVED',
  CALENDAR_REMINDER: 'CALENDAR_REMINDER',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  SYSTEM: 'SYSTEM',
  RECURRING_TASK_OPEN_CLAIM: 'RECURRING_TASK_OPEN_CLAIM',
  RECURRING_TASK_OVERDUE_UNCLAIMED: 'RECURRING_TASK_OVERDUE_UNCLAIMED',
  RECURRING_TASK_CLAIMED: 'RECURRING_TASK_CLAIMED',
  BUDGET_WARNING: 'BUDGET_WARNING',
  FUND_LOW_WARNING: 'FUND_LOW_WARNING',
  FUND_SURPLUS_SUGGESTION: 'FUND_SURPLUS_SUGGESTION',
} as const

/**
 * Kiểu union đại diện cho một loại thông báo hợp lệ.
 * Được suy ra từ các khóa của `NOTIFICATION_TYPE`.
 *
 * @example
 * const type: NotificationType = 'TASK_APPROVED'
 */
export type NotificationType = keyof typeof NOTIFICATION_TYPE

/**
 * Đại diện cho một bản ghi thông báo được lưu trong cơ sở dữ liệu.
 * Thông báo được gửi qua Socket.IO theo thời gian thực và cũng được lưu
 * để hiển thị trong danh sách thông báo của người dùng.
 */
export interface Notification {
  /** Định danh duy nhất của thông báo (UUID). */
  id: string
  /** ID người dùng nhận thông báo này. */
  userId: string
  /** Loại thông báo xác định ngữ cảnh và cách hiển thị. */
  type: NotificationType
  /** Tiêu đề ngắn gọn của thông báo (ví dụ: "Nhiệm vụ mới!"). */
  title: string
  /** Nội dung chi tiết của thông báo. */
  body: string
  /** Trạng thái đã đọc; false nếu người dùng chưa xem. */
  isRead: boolean
  /**
   * Dữ liệu bổ sung tuỳ theo loại thông báo.
   * Ví dụ: `{ taskId: '...', familyId: '...' }` để điều hướng khi bấm vào.
   */
  metadata?: Record<string, unknown> | null
  /** Thời điểm thông báo được tạo (ISO 8601). */
  createdAt: string
}

/**
 * Payload được phát qua Socket.IO khi có thông báo mới.
 * Client lắng nghe sự kiện `notification` để cập nhật giao diện theo thời gian thực.
 */
export interface WsNotificationPayload {
  /** Thông tin đầy đủ của thông báo vừa được tạo. */
  notification: Notification
  /** Tổng số thông báo chưa đọc sau khi thêm thông báo mới này. */
  unreadCount: number
}
