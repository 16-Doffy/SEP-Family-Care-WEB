import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { TASK_TRANSITIONS } from '@family-care/shared'
import type { TaskStatus } from '@family-care/shared'
import { transfer } from './wallet.service'
import { createNotification } from './notification.service'

const TASK_INCLUDE = {
  createdBy: {
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  },
  assignedTo: {
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  },
  proofs: {
    include: {
      submitter: { select: { displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
}

export async function getTasks(familyId: string, filters?: { status?: string; assignedToId?: string }) {
  return prisma.task.findMany({
    where: {
      familyId,
      ...(filters?.status && { status: filters.status as TaskStatus }),
      ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
    },
    include: TASK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTask(taskId: string, familyId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, familyId },
    include: TASK_INCLUDE,
  })
  if (!task) throw Errors.NotFound('Task')
  return task
}

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
  const task = await prisma.task.create({
    data: {
      familyId,
      title: data.title,
      description: data.description,
      reward: data.reward,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById,
      assignedToId: data.assignedToId,
      status: 'PENDING',
    },
    include: TASK_INCLUDE,
  })

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

export async function updateTask(
  taskId: string,
  familyId: string,
  data: { title?: string; description?: string; reward?: number; dueDate?: string; assignedToId?: string },
) {
  await getTask(taskId, familyId)
  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
    include: TASK_INCLUDE,
  })
}

export async function transitionTask(
  taskId: string,
  familyId: string,
  newStatus: TaskStatus,
  requesterId: string,
) {
  const task = await getTask(taskId, familyId)
  const currentStatus = task.status as TaskStatus
  const allowed = TASK_TRANSITIONS[currentStatus]

  if (!allowed.includes(newStatus)) {
    throw Errors.InvalidTransition(currentStatus, newStatus)
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
    include: TASK_INCLUDE,
  })

  // Handle notifications based on transition
  if (newStatus === 'SUBMITTED' && task.createdBy?.userId) {
    await createNotification({
      userId: task.createdBy.userId,
      type: 'TASK_SUBMITTED',
      title: 'Nhiệm vụ chờ duyệt',
      body: `"${task.title}" đã được nộp bằng chứng, chờ bạn xét duyệt.`,
      metadata: { taskId },
    })
  }

  if (newStatus === 'APPROVED' && task.assignedTo?.userId) {
    // Pay reward if set
    if (task.reward && Number(task.reward) > 0) {
      const jointWallet = await prisma.wallet.findFirst({
        where: { familyId, type: 'JOINT' },
      })
      const personalWallet = await prisma.wallet.findFirst({
        where: { ownerId: task.assignedToId ?? undefined },
      })

      if (jointWallet && personalWallet) {
        try {
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
          // Reward payment failed (insufficient funds), still complete task
        }
      }
    }

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

export async function submitProof(
  taskId: string,
  familyId: string,
  userId: string,
  proof: { imageUrl?: string; note?: string },
) {
  const task = await getTask(taskId, familyId)

  if (task.status !== 'IN_PROGRESS') {
    throw Errors.BadRequest('Task must be IN_PROGRESS to submit proof')
  }

  await prisma.taskProof.create({
    data: {
      taskId,
      submittedBy: userId,
      imageUrl: proof.imageUrl,
      note: proof.note,
    },
  })

  return transitionTask(taskId, familyId, 'SUBMITTED', userId)
}

export async function cancelTask(taskId: string, familyId: string) {
  return transitionTask(taskId, familyId, 'CANCELLED', '')
}
