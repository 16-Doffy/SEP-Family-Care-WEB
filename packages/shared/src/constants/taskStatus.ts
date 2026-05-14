/**
 * Định nghĩa trạng thái nhiệm vụ và các chuyển đổi trạng thái hợp lệ.
 * Module này xuất hằng số TASK_STATUS, kiểu TaskStatus và bảng TASK_TRANSITIONS.
 */

/**
 * Tập hợp tất cả các trạng thái có thể có của một nhiệm vụ (task).
 *
 * Luồng trạng thái điển hình:
 * PENDING → IN_PROGRESS → SUBMITTED → APPROVED
 *                        └──────────→ REJECTED → IN_PROGRESS (làm lại)
 * Bất kỳ trạng thái nào cũng có thể bị HUỶ (CANCELLED) trước khi hoàn tất.
 *
 * - `PENDING`:     Nhiệm vụ mới tạo, chưa bắt đầu thực hiện.
 * - `IN_PROGRESS`: Đang được thực hiện bởi người được giao.
 * - `SUBMITTED`:   Người thực hiện đã nộp bằng chứng, chờ phụ huynh xem xét.
 * - `APPROVED`:    Phụ huynh đã chấp thuận – phần thưởng được ghi nhận.
 * - `REJECTED`:    Phụ huynh từ chối – người thực hiện có thể làm lại.
 * - `CANCELLED`:   Nhiệm vụ đã bị huỷ, không còn hiệu lực.
 */
export const TASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const

/**
 * Kiểu union đại diện cho một trạng thái nhiệm vụ hợp lệ.
 * Được suy ra từ các khóa của `TASK_STATUS`.
 *
 * @example
 * const status: TaskStatus = 'IN_PROGRESS'
 */
export type TaskStatus = keyof typeof TASK_STATUS

/**
 * Bảng tra cứu các chuyển đổi trạng thái hợp lệ cho nhiệm vụ.
 * Mỗi khóa là trạng thái hiện tại, giá trị là mảng các trạng thái được phép chuyển sang.
 * Mảng rỗng có nghĩa là trạng thái cuối cùng – không thể chuyển tiếp.
 *
 * Dùng để kiểm tra tính hợp lệ trước khi cập nhật trạng thái nhiệm vụ.
 *
 * @example
 * const allowed = TASK_TRANSITIONS['SUBMITTED'] // ['APPROVED', 'REJECTED']
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],    // Trạng thái cuối – đã phê duyệt, không thể thay đổi
  REJECTED: ['IN_PROGRESS'], // Cho phép làm lại sau khi bị từ chối
  CANCELLED: [],   // Trạng thái cuối – đã huỷ, không thể khôi phục
}
