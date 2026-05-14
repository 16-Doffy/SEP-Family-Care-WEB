/**
 * Định nghĩa các loại ví và loại giao dịch trong hệ thống tài chính gia đình.
 * Module này xuất hằng số WALLET_TYPE, TRANSACTION_TYPE và các kiểu tương ứng.
 */

/**
 * Phân loại ví tiền trong gia đình.
 *
 * - `JOINT`:    Ví chung của cả gia đình – phụ huynh quản lý, mọi thành viên
 *               có thể xem số dư.
 * - `PERSONAL`: Ví cá nhân của từng thành viên (thường là con cái) – chỉ chủ sở hữu
 *               và phụ huynh mới có thể xem chi tiết.
 */
export const WALLET_TYPE = {
  JOINT: 'JOINT',
  PERSONAL: 'PERSONAL',
} as const

/**
 * Kiểu union đại diện cho một loại ví hợp lệ.
 * Được suy ra từ các khóa của `WALLET_TYPE`.
 *
 * @example
 * const type: WalletType = 'PERSONAL'
 */
export type WalletType = keyof typeof WALLET_TYPE

/**
 * Phân loại giao dịch tài chính trong hệ thống.
 *
 * - `DEPOSIT`:     Nạp tiền vào ví (tăng số dư).
 * - `WITHDRAWAL`:  Rút tiền khỏi ví (giảm số dư).
 * - `TRANSFER`:    Chuyển tiền giữa các ví trong cùng gia đình.
 * - `TASK_REWARD`: Phần thưởng tự động được cộng vào ví khi nhiệm vụ được phê duyệt.
 */
export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
  TASK_REWARD: 'TASK_REWARD',
} as const

/**
 * Kiểu union đại diện cho một loại giao dịch hợp lệ.
 * Được suy ra từ các khóa của `TRANSACTION_TYPE`.
 *
 * @example
 * const txType: TransactionType = 'TASK_REWARD'
 */
export type TransactionType = keyof typeof TRANSACTION_TYPE
