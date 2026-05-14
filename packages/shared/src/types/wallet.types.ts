/**
 * Định nghĩa các kiểu dữ liệu liên quan đến ví và giao dịch tài chính trong gia đình.
 * Bao gồm Wallet, Transaction và DTO thực hiện lệnh chuyển tiền.
 */

import type { WalletType, TransactionType } from '../constants/walletTypes'

/**
 * Đại diện cho một ví tiền trong hệ thống gia đình.
 * Ví có thể là ví chung (JOINT) thuộc gia đình hoặc ví cá nhân (PERSONAL) thuộc một thành viên.
 */
export interface Wallet {
  /** Định danh duy nhất của ví (UUID). */
  id: string
  /** ID của gia đình sở hữu ví này. */
  familyId: string
  /** Tên hiển thị của ví (ví dụ: "Quỹ gia đình", "Ví của An"). */
  name: string
  /** Loại ví: JOINT (chung) hoặc PERSONAL (cá nhân). */
  type: WalletType
  /** Số dư hiện tại của ví (đơn vị theo `currency`). */
  balance: number
  /** Đơn vị tiền tệ, ví dụ: "VND", "USD". */
  currency: string
  /**
   * ID của thành viên sở hữu ví cá nhân; rỗng nếu là ví chung (JOINT).
   * Tham chiếu đến bản ghi FamilyMember, không phải User.
   */
  ownerId?: string | null
  /** Thông tin chủ ví được nhúng kèm để hiển thị trên giao diện. */
  owner?: { id: string; user: { displayName: string; avatarUrl?: string | null } } | null
  /** Thời điểm cập nhật số dư gần nhất (ISO 8601). */
  updatedAt: string
}

/**
 * Đại diện cho một bản ghi giao dịch tài chính.
 * Mỗi giao dịch thuộc một loại cụ thể và liên kết với một hoặc hai ví.
 */
export interface Transaction {
  /** Định danh duy nhất của giao dịch (UUID). */
  id: string
  /** Số tiền giao dịch (luôn dương; chiều đi/đến xác định bởi `type`). */
  amount: number
  /** Loại giao dịch: DEPOSIT, WITHDRAWAL, TRANSFER hoặc TASK_REWARD. */
  type: TransactionType
  /** Ghi chú tuỳ chọn do người dùng nhập hoặc hệ thống tự tạo. */
  description?: string | null
  /** Thời điểm giao dịch được tạo (ISO 8601). */
  createdAt: string
  /** Ví nguồn (bên gửi); chỉ có ở giao dịch TRANSFER và WITHDRAWAL. */
  fromWallet?: { id: string; name: string } | null
  /** Ví đích (bên nhận); chỉ có ở giao dịch TRANSFER, DEPOSIT và TASK_REWARD. */
  toWallet?: { id: string; name: string } | null
  /** Nhiệm vụ liên quan; chỉ có ở giao dịch TASK_REWARD. */
  task?: { id: string; title: string } | null
}

/**
 * Dữ liệu đầu vào để thực hiện lệnh chuyển tiền giữa hai ví.
 * Cả hai ví phải thuộc cùng một gia đình.
 */
export interface TransferDto {
  /** ID của ví nguồn (ví gửi tiền). */
  fromWalletId: string
  /** ID của ví đích (ví nhận tiền). */
  toWalletId: string
  /** Số tiền cần chuyển; phải lớn hơn 0 và không vượt quá số dư ví nguồn. */
  amount: number
  /** Ghi chú tuỳ chọn cho giao dịch này. */
  description?: string
}
