/**
 * @module task.service
 * @description Dịch vụ quản lý nhiệm vụ (task) trong hệ thống gia đình.
 *
 * Luồng trạng thái nhiệm vụ (state machine):
 *   PENDING → IN_PROGRESS → SUBMITTED → APPROVED | REJECTED
 *   Bất kỳ trạng thái nào → CANCELLED
 *
 * Khi nhiệm vụ được APPROVED và có phần thưởng (reward), hệ thống sẽ tự động
 * chuyển tiền từ ví chung (JOINT) sang ví cá nhân của người được giao việc.
 * Nếu ví chung không đủ tiền, nhiệm vụ vẫn được duyệt nhưng không chuyển thưởng.
 *
 * Các sự kiện quan trọng (giao task, nộp bằng chứng, duyệt, từ chối) đều gửi
 * thông báo (notification) đến người liên quan.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { TASK_TRANSITIONS } from '@family-care/shared'
import type { TaskStatus } from '@family-care/shared'
import { transfer } from './wallet.service'
import { createNotification } from './notification.service'
import { assertCanCreateTask } from './plan-limits.service'

/**
 * Cấu hình include dùng chung cho các truy vấn task.
 * Bao gồm: người tạo, người được giao, và danh sách bằng chứng (proofs).
 * Được định nghĩa một lần để tránh lặp code và dễ bảo trì.
 */
const TASK_INCLUDE = {
  createdBy: {
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  },
  assignedTo: {
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  },
  proofs: {
    include: {
      // Chỉ lấy thông tin cần thiết của người nộp bằng chứng
      submitter: { select: { displayName: true, avatarUrl: true } },
    },
    // Bằng chứng mới nhất hiển thị trước
    orderBy: { createdAt: 'desc' as const },
  },
}

/**
 * Lấy danh sách nhiệm vụ của một gia đình, có thể lọc theo trạng thái hoặc người được giao.
 *
 * @param familyId - ID gia đình cần truy vấn.
 * @param filters - Bộ lọc tuỳ chọn.
 * @param filters.status - Lọc theo trạng thái nhiệm vụ (PENDING, IN_PROGRESS, v.v.).
 * @param filters.assignedToId - Lọc theo ID thành viên được giao việc.
 * @returns Danh sách nhiệm vụ sắp xếp theo ngày tạo mới nhất trước.
 */
export async function getTasks(familyId: string, filters?: { status?: string; assignedToId?: string }) {
  return prisma.task.findMany({
    where: {
      familyId,
      // Chỉ thêm điều kiện lọc nếu giá trị được cung cấp (tránh lọc sai khi undefined)
      ...(filters?.status && { status: filters.status as TaskStatus }),
      ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
    },
    include: TASK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Lấy thông tin chi tiết của một nhiệm vụ.
 *
 * @param taskId - ID của nhiệm vụ.
 * @param familyId - ID gia đình để xác thực quyền truy cập.
 * @returns Thông tin đầy đủ của nhiệm vụ kèm người tạo, người được giao và bằng chứng.
 * @throws {NotFoundError} Nếu nhiệm vụ không tồn tại hoặc không thuộc gia đình.
 */
export async function getTask(taskId: string, familyId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, familyId },
    include: TASK_INCLUDE,
  })
  if (!task) throw Errors.NotFound('Task')
  return task
}

/**
 * Tạo một nhiệm vụ mới trong gia đình.
 *
 * Trước khi tạo, hệ thống kiểm tra giới hạn số lượng task theo gói dịch vụ
 * của gia đình (plan limits). Nếu quá giới hạn, lỗi sẽ được ném ra.
 *
 * Nếu nhiệm vụ được giao ngay cho một thành viên, thành viên đó sẽ nhận
 * thông báo "Nhiệm vụ mới".
 *
 * @param familyId - ID gia đình tạo nhiệm vụ.
 * @param createdById - ID của thành viên gia đình (FamilyMember) tạo nhiệm vụ.
 * @param data - Dữ liệu nhiệm vụ.
 * @param data.title - Tiêu đề nhiệm vụ (bắt buộc).
 * @param data.description - Mô tả chi tiết (tuỳ chọn).
 * @param data.reward - Số tiền thưởng khi hoàn thành (tuỳ chọn).
 * @param data.dueDate - Hạn chót dạng ISO string (tuỳ chọn).
 * @param data.assignedToId - ID FamilyMember được giao việc (tuỳ chọn).
 * @returns Nhiệm vụ vừa được tạo với trạng thái PENDING.
 * @throws {PlanLimitError} Nếu gia đình đã đạt giới hạn số lượng task.
 */
export async function createTask(
  familyId: string,
  createdById: string,
  data: {
    title: string
    description?: string
    reward?: number
    dueDate?: string
    assignedToId?: string
  },
) {
  // Kiểm tra giới hạn gói dịch vụ trước khi tạo task
  await assertCanCreateTask(familyId)

  const task = await prisma.task.create({
    data: {
      familyId,
      title: data.title,
      description: data.description,
      reward: data.reward,
      // Chuyển chuỗi ISO date sang đối tượng Date của JS nếu được cung cấp
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById,
      assignedToId: data.assignedToId,
      // Mọi task mới đều bắt đầu ở trạng thái PENDING (chờ được nhận)
      status: 'PENDING',
    },
    include: TASK_INCLUDE,
  })

  // Gửi thông báo cho người được giao việc (nếu có)
  if (data.assignedToId) {
    const member = await prisma.familyMember.findUnique({
      where: { id: data.assignedToId },
    })
    if (member) {
      await createNotification({
        userId: member.userId,
        type: 'TASK_ASSIGNED',
        title: 'Nhiệm vụ mới',
        body: `Bạn được giao nhiệm vụ: "${data.title}"`,
        metadata: { taskId: task.id },
      })
    }
  }

  return task
}

/**
 * Cập nhật thông tin của một nhiệm vụ (không thay đổi trạng thái).
 * Dùng để chỉnh sửa tiêu đề, mô tả, thưởng, hạn chót hoặc người được giao.
 *
 * Hàm này gọi `getTask` trước để đảm bảo task tồn tại và thuộc gia đình đúng.
 *
 * @param taskId - ID nhiệm vụ cần cập nhật.
 * @param familyId - ID gia đình để xác thực quyền truy cập.
 * @param data - Các trường cần cập nhật (chỉ truyền những trường muốn thay đổi).
 * @returns Nhiệm vụ sau khi cập nhật.
 * @throws {NotFoundError} Nếu nhiệm vụ không tồn tại hoặc không thuộc gia đình.
 */
export async function updateTask(
  taskId: string,
  familyId: string,
  data: { title?: string; description?: string; reward?: number; dueDate?: string; assignedToId?: string },
) {
  // Xác thực task tồn tại trước khi update
  await getTask(taskId, familyId)
  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      // Chuyển đổi chuỗi ngày sang Date nếu được cung cấp
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
    include: TASK_INCLUDE,
  })
}

/**
 * Chuyển trạng thái của nhiệm vụ theo state machine được định nghĩa trong TASK_TRANSITIONS.
 *
 * Đây là hàm trung tâm điều phối toàn bộ vòng đời của task. Sau khi cập nhật
 * trạng thái, hàm này xử lý các tác dụng phụ (side effects) tương ứng:
 *
 * - SUBMITTED: Thông báo cho người tạo task biết có bằng chứng chờ duyệt.
 * - APPROVED:  Chuyển tiền thưởng từ ví chung sang ví cá nhân (nếu có thưởng),
 *              sau đó thông báo cho người được giao việc.
 * - REJECTED:  Thông báo cho người được giao việc biết cần làm lại.
 *
 * @param taskId - ID nhiệm vụ cần chuyển trạng thái.
 * @param familyId - ID gia đình để xác thực quyền truy cập.
 * @param newStatus - Trạng thái mới muốn chuyển sang.
 * @param requesterId - ID người dùng (userId) thực hiện hành động này.
 * @returns Nhiệm vụ sau khi được cập nhật trạng thái.
 * @throws {NotFoundError} Nếu nhiệm vụ không tồn tại.
 * @throws {InvalidTransitionError} Nếu chuyển trạng thái không hợp lệ theo state machine.
 */
export async function transitionTask(
  taskId: string,
  familyId: string,
  newStatus: TaskStatus,
  requesterId: string,
) {
  const task = await getTask(taskId, familyId)
  const currentStatus = task.status as TaskStatus

  // Lấy danh sách trạng thái được phép chuyển từ trạng thái hiện tại
  const allowed = TASK_TRANSITIONS[currentStatus]

  // Ngăn chặn các chuyển trạng thái không hợp lệ (ví dụ: APPROVED → PENDING)
  if (!allowed.includes(newStatus)) {
    throw Errors.InvalidTransition(currentStatus, newStatus)
  }

  // Cập nhật trạng thái trong database
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
    include: TASK_INCLUDE,
  })

  // --- Xử lý thông báo và tác dụng phụ theo trạng thái mới ---

  // Khi người dùng nộp bằng chứng: thông báo cho người tạo task (thường là phụ huynh) để duyệt
  if (newStatus === 'SUBMITTED' && task.createdBy?.userId) {
    await createNotification({
      userId: task.createdBy.userId,
      type: 'TASK_SUBMITTED',
      title: 'Nhiệm vụ chờ duyệt',
      body: `"${task.title}" đã được nộp bằng chứng, chờ bạn xét duyệt.`,
      metadata: { taskId },
    })
  }

  // Khi task được duyệt: thanh toán thưởng và thông báo cho người được giao việc
  if (newStatus === 'APPROVED' && task.assignedTo?.userId) {
    // Chỉ thực hiện chuyển thưởng nếu task có gắn số tiền thưởng
    if (task.reward && Number(task.reward) > 0) {
      // Tìm ví chung của gia đình (nguồn tiền thưởng)
      const jointWallet = await prisma.wallet.findFirst({
        where: { familyId, type: 'JOINT' },
      })
      // Tìm ví cá nhân của người được giao việc (ví đích nhận thưởng)
      const personalWallet = await prisma.wallet.findFirst({
        where: { ownerId: task.assignedToId ?? undefined },
      })

      if (jointWallet && personalWallet) {
        try {
          // Chuyển thưởng từ ví chung sang ví cá nhân
          await transfer({
            fromWalletId: jointWallet.id,
            toWalletId: personalWallet.id,
            amount: Number(task.reward),
            description: `Thưởng task: ${task.title}`,
            familyId,
            type: 'TASK_REWARD',
            taskId,
          })
        } catch {
          // Nếu ví chung không đủ tiền (InsufficientFunds), vẫn duyệt task nhưng bỏ qua thưởng.
          // Không ném lỗi lên để tránh rollback trạng thái task đã được phê duyệt.
        }
      }
    }

    // Gửi thông báo chúc mừng cho người được giao việc, kèm số tiền thưởng nếu có
    await createNotification({
      userId: task.assignedTo.userId,
      type: 'TASK_APPROVED',
      title: 'Nhiệm vụ được duyệt! 🎉',
      body: task.reward
        ? `"${task.title}" được duyệt. Bạn nhận ${Number(task.reward).toLocaleString('vi-VN')}đ!`
        : `"${task.title}" đã được duyệt.`,
      metadata: { taskId, reward: task.reward },
    })
  }

  // Khi task bị từ chối: thông báo để người dùng biết cần làm lại và nộp lại bằng chứng
  if (newStatus === 'REJECTED' && task.assignedTo?.userId) {
    await createNotification({
      userId: task.assignedTo.userId,
      type: 'TASK_REJECTED',
      title: 'Nhiệm vụ bị từ chối',
      body: `"${task.title}" bị từ chối. Vui lòng làm lại và nộp lại bằng chứng.`,
      metadata: { taskId },
    })
  }

  return updated
}

/**
 * Nộp bằng chứng hoàn thành nhiệm vụ (ảnh và/hoặc ghi chú).
 *
 * Nhiệm vụ phải đang ở trạng thái IN_PROGRESS mới được nộp bằng chứng.
 * Sau khi lưu bằng chứng, trạng thái task tự động chuyển sang SUBMITTED
 * thông qua `transitionTask` để đảm bảo thông báo được gửi đúng.
 *
 * @param taskId - ID nhiệm vụ cần nộp bằng chứng.
 * @param familyId - ID gia đình để xác thực quyền truy cập.
 * @param userId - ID người dùng (userId) nộp bằng chứng.
 * @param proof - Dữ liệu bằng chứng.
 * @param proof.imageUrl - Đường dẫn ảnh bằng chứng (tuỳ chọn).
 * @param proof.note - Ghi chú kèm theo bằng chứng (tuỳ chọn).
 * @returns Nhiệm vụ sau khi chuyển sang trạng thái SUBMITTED.
 * @throws {BadRequestError} Nếu task không ở trạng thái IN_PROGRESS.
 * @throws {NotFoundError} Nếu task không tồn tại.
 */
export async function submitProof(
  taskId: string,
  familyId: string,
  userId: string,
  proof: { imageUrl?: string; note?: string },
) {
  const task = await getTask(taskId, familyId)

  // Chỉ cho phép nộp bằng chứng khi task đang trong tiến trình
  if (task.status !== 'IN_PROGRESS') {
    throw Errors.BadRequest('Task must be IN_PROGRESS to submit proof')
  }

  // Lưu bằng chứng vào bảng TaskProof trước
  await prisma.taskProof.create({
    data: {
      taskId,
      submittedBy: userId,
      imageUrl: proof.imageUrl,
      note: proof.note,
    },
  })

  // Sau đó chuyển trạng thái sang SUBMITTED (đồng thời gửi thông báo cho người tạo task)
  return transitionTask(taskId, familyId, 'SUBMITTED', userId)
}

/**
 * Huỷ một nhiệm vụ, chuyển trạng thái sang CANCELLED.
 * Sử dụng chuỗi rỗng làm requesterId vì hành động huỷ không cần kiểm tra người thực hiện
 * ở tầng service (quyền đã được kiểm tra ở tầng route/controller).
 *
 * @param taskId - ID nhiệm vụ cần huỷ.
 * @param familyId - ID gia đình để xác thực quyền truy cập.
 * @returns Nhiệm vụ sau khi chuyển sang trạng thái CANCELLED.
 * @throws {NotFoundError} Nếu task không tồn tại.
 * @throws {InvalidTransitionError} Nếu task đã ở trạng thái không thể huỷ.
 */
export async function cancelTask(taskId: string, familyId: string) {
  return transitionTask(taskId, familyId, 'CANCELLED', '')
}
