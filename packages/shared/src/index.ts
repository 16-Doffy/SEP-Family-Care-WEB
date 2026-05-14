/**
 * Điểm xuất trung tâm (barrel) cho package @sep/shared.
 * Tất cả hằng số và kiểu dữ liệu dùng chung giữa client và server đều được
 * re-export từ đây để các package khác chỉ cần import từ một nơi duy nhất.
 *
 * @example
 * import { ROLES, TASK_STATUS, type Task, type User } from '@sep/shared'
 */

// ─── Hằng số ────────────────────────────────────────────────────────────────
/** Vai trò người dùng: SUPER_ADMIN, PARENT, CHILD */
export * from './constants/roles'
/** Trạng thái nhiệm vụ và bảng chuyển đổi trạng thái hợp lệ */
export * from './constants/taskStatus'
/** Loại ví (JOINT / PERSONAL) và loại giao dịch tài chính */
export * from './constants/walletTypes'

// ─── Kiểu dữ liệu ───────────────────────────────────────────────────────────
/** User, FamilyMember, RegisterDto, LoginDto, AuthResponse */
export * from './types/user.types'
/** Wallet, Transaction, TransferDto */
export * from './types/wallet.types'
/** Task, TaskProof, CreateTaskDto, UpdateTaskDto */
export * from './types/task.types'
/** NOTIFICATION_TYPE, Notification, WsNotificationPayload */
export * from './types/notification.types'
