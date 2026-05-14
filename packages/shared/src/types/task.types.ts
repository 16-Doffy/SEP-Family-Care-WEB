/**
 * Định nghĩa các kiểu dữ liệu liên quan đến nhiệm vụ (task) trong hệ thống gia đình.
 * Bao gồm Task, TaskProof (bằng chứng hoàn thành) và các DTO tạo/cập nhật nhiệm vụ.
 */

import type { TaskStatus } from '../constants/taskStatus'

/**
 * Bằng chứng hoàn thành nhiệm vụ do người được giao nộp lên.
 * Mỗi nhiệm vụ có thể có nhiều bằng chứng (ảnh + ghi chú).
 */
export interface TaskProof {
  /** Định danh duy nhất của bằng chứng (UUID). */
  id: string
  /** ID của nhiệm vụ mà bằng chứng này thuộc về. */
  taskId: string
  /** ID của FamilyMember đã nộp bằng chứng. */
  submittedBy: string
  /** URL ảnh minh chứng được tải lên; tuỳ chọn. */
  imageUrl?: string | null
  /** Ghi chú giải thích thêm của người nộp; tuỳ chọn. */
  note?: string | null
  /** Thời điểm nộp bằng chứng (ISO 8601). */
  createdAt: string
  /** Thông tin người nộp được nhúng kèm để hiển thị trên giao diện. */
  submitter?: { displayName: string; avatarUrl?: string | null }
}

/**
 * Đại diện cho một nhiệm vụ trong gia đình.
 * Nhiệm vụ do phụ huynh tạo, giao cho thành viên thực hiện và phê duyệt khi hoàn thành.
 */
export interface Task {
  /** Định danh duy nhất của nhiệm vụ (UUID). */
  id: string
  /** ID của gia đình sở hữu nhiệm vụ này. */
  familyId: string
  /** Tiêu đề ngắn gọn mô tả nhiệm vụ. */
  title: string
  /** Mô tả chi tiết yêu cầu hoàn thành; tuỳ chọn. */
  description?: string | null
  /** Trạng thái hiện tại của nhiệm vụ (xem TASK_STATUS). */
  status: TaskStatus
  /**
   * Phần thưởng (số tiền) được cộng vào ví cá nhân khi nhiệm vụ được phê duyệt.
   * Nếu rỗng, nhiệm vụ không có phần thưởng tài chính.
   */
  reward?: number | null
  /** Hạn hoàn thành; nếu rỗng thì không giới hạn thời gian (ISO 8601). */
  dueDate?: string | null
  /** Thời điểm tạo nhiệm vụ (ISO 8601). */
  createdAt: string
  /** Thời điểm cập nhật nhiệm vụ gần nhất (ISO 8601). */
  updatedAt: string
  /** Thông tin thành viên đã tạo nhiệm vụ (thường là phụ huynh). */
  createdBy: { id: string; user: { displayName: string; avatarUrl?: string | null } }
  /**
   * Thành viên được giao nhiệm vụ; rỗng nếu nhiệm vụ chưa được giao cho ai.
   * Tham chiếu đến bản ghi FamilyMember, không phải User.
   */
  assignedTo?: { id: string; user: { displayName: string; avatarUrl?: string | null } } | null
  /** Danh sách các bằng chứng đã nộp cho nhiệm vụ này. */
  proofs: TaskProof[]
  /**
   * Bộ đếm được Prisma tổng hợp; dùng để hiển thị nhanh số lượng bằng chứng
   * mà không cần tải toàn bộ mảng `proofs`.
   */
  _count?: { proofs: number }
}

/**
 * Dữ liệu đầu vào để tạo một nhiệm vụ mới.
 * Nhiệm vụ mới luôn bắt đầu ở trạng thái PENDING.
 */
export interface CreateTaskDto {
  /** Tiêu đề nhiệm vụ (bắt buộc). */
  title: string
  /** Mô tả chi tiết; tuỳ chọn. */
  description?: string
  /** Phần thưởng khi hoàn thành (đơn vị tiền tệ của ví gia đình); tuỳ chọn. */
  reward?: number
  /** Hạn hoàn thành (ISO 8601); tuỳ chọn. */
  dueDate?: string
  /**
   * ID của FamilyMember được giao nhiệm vụ; tuỳ chọn.
   * Nếu không truyền, nhiệm vụ ở trạng thái chưa giao.
   */
  assignedToId?: string
}

/**
 * Dữ liệu đầu vào để cập nhật thông tin một nhiệm vụ đã tồn tại.
 * Tất cả các trường đều tuỳ chọn – chỉ trường được truyền mới được cập nhật.
 */
export interface UpdateTaskDto {
  /** Tiêu đề mới của nhiệm vụ. */
  title?: string
  /** Mô tả mới. */
  description?: string
  /** Phần thưởng mới. */
  reward?: number
  /** Hạn hoàn thành mới (ISO 8601). */
  dueDate?: string
}
