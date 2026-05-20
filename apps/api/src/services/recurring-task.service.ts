/**
 * @module recurring-task.service
 * @description Quản lý nhiệm vụ định kỳ (Core flow 2).
 *
 * - Template (`RecurringTaskTemplate`) định nghĩa một việc lặp lại (vd "đưa con
 *   đi học" 7:00 hằng ngày, mặc định giao cho ba).
 * - Mỗi ngày, cron job sinh ra một `Task` instance kế thừa thông tin template
 *   với `templateId` + `scheduledDate` + `originalAssigneeId`.
 * - Assignee gốc có thể "xin nghỉ" → `isOpenForClaim=true` → member khác claim
 *   để nhận giúp. PARENT có thể override khi quá hạn không ai nhận.
 *
 * RRULE chỉ hỗ trợ subset cho v1:
 *  - FREQ=DAILY                  → mỗi ngày
 *  - FREQ=WEEKLY;BYDAY=MO,TU,...  → các thứ trong tuần (MO,TU,WE,TH,FR,SA,SU)
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { createNotification } from './notification.service'
import { getIO } from '../config/socket'

type Access = { role: string; familyMemberId?: string }

/** Days-of-week mapping cho RRULE BYDAY. */
const DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/**
 * Kiểm tra một ngày `date` có khớp với RRULE đã cho hay không.
 * Hỗ trợ tối thiểu DAILY và WEEKLY;BYDAY=...
 */
export function rruleMatches(rrule: string, date: Date): boolean {
  const parts = Object.fromEntries(
    rrule
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [k, v] = p.split('=')
        return [k.toUpperCase(), v]
      }),
  )

  const freq = parts.FREQ
  if (freq === 'DAILY') return true
  if (freq === 'WEEKLY') {
    const byday = (parts.BYDAY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (byday.length === 0) return true
    const dow = date.getDay()
    return byday.some((d) => DOW[d] === dow)
  }
  return false
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

const TEMPLATE_INCLUDE = {
  defaultAssignee: {
    include: { user: { select: { displayName: true, avatarUrl: true } } },
  },
  createdBy: {
    include: { user: { select: { displayName: true, avatarUrl: true } } },
  },
}

export async function listTemplates(familyId: string) {
  return prisma.recurringTaskTemplate.findMany({
    where: { familyId, isActive: true },
    include: TEMPLATE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createTemplate(
  familyId: string,
  createdById: string,
  data: {
    title: string
    description?: string
    reward?: number
    rrule: string
    timeOfDay?: string
    defaultAssigneeId?: string
  },
) {
  if (data.defaultAssigneeId) {
    const m = await prisma.familyMember.findFirst({
      where: { id: data.defaultAssigneeId, familyId },
    })
    if (!m) throw Errors.NotFound('Default assignee')
  }
  if (!rruleMatches(data.rrule, new Date()) && !rruleMatches(data.rrule, new Date(Date.now() + 86_400_000))) {
    // Kiểm tra rrule có hợp lệ với phạm vi hỗ trợ
    const okFreq = /FREQ=(DAILY|WEEKLY)/i.test(data.rrule)
    if (!okFreq) throw Errors.BadRequest('Chỉ hỗ trợ FREQ=DAILY hoặc FREQ=WEEKLY')
  }
  return prisma.recurringTaskTemplate.create({
    data: {
      familyId,
      createdById,
      title: data.title,
      description: data.description,
      reward: data.reward,
      rrule: data.rrule,
      timeOfDay: data.timeOfDay,
      defaultAssigneeId: data.defaultAssigneeId,
    },
    include: TEMPLATE_INCLUDE,
  })
}

export async function updateTemplate(
  id: string,
  familyId: string,
  data: {
    title?: string
    description?: string
    reward?: number
    rrule?: string
    timeOfDay?: string
    defaultAssigneeId?: string | null
    isActive?: boolean
  },
) {
  const t = await prisma.recurringTaskTemplate.findFirst({ where: { id, familyId } })
  if (!t) throw Errors.NotFound('Template')
  if (data.defaultAssigneeId) {
    const m = await prisma.familyMember.findFirst({
      where: { id: data.defaultAssigneeId, familyId },
    })
    if (!m) throw Errors.NotFound('Default assignee')
  }
  return prisma.recurringTaskTemplate.update({
    where: { id },
    data,
    include: TEMPLATE_INCLUDE,
  })
}

export async function deactivateTemplate(id: string, familyId: string) {
  const t = await prisma.recurringTaskTemplate.findFirst({ where: { id, familyId } })
  if (!t) throw Errors.NotFound('Template')
  return prisma.recurringTaskTemplate.update({
    where: { id },
    data: { isActive: false },
  })
}

// ─── Instance generation ──────────────────────────────────────────────────────

/**
 * Trả về `Date` ở 00:00 (local) của ngày `d`. Dùng làm scheduledDate canonical.
 */
function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Áp dụng `timeOfDay` (HH:mm) vào một ngày để có dueDate cụ thể.
 */
function applyTimeOfDay(day: Date, timeOfDay?: string | null) {
  if (!timeOfDay) return day
  const [h, m] = timeOfDay.split(':').map((n) => parseInt(n, 10))
  const x = new Date(day)
  x.setHours(h || 0, m || 0, 0, 0)
  return x
}

/**
 * Sinh các Task instance cho ngày `targetDate` cho 1 family.
 * Idempotent: nếu instance đã tồn tại cho (templateId, scheduledDate) thì bỏ qua.
 */
export async function generateInstancesForFamily(familyId: string, targetDate: Date = new Date()) {
  const scheduled = startOfDay(targetDate)
  const templates = await prisma.recurringTaskTemplate.findMany({
    where: { familyId, isActive: true },
  })

  const created = []
  for (const t of templates) {
    if (!rruleMatches(t.rrule, scheduled)) continue
    const existing = await prisma.task.findFirst({
      where: { templateId: t.id, scheduledDate: scheduled },
    })
    if (existing) continue

    const task = await prisma.task.create({
      data: {
        familyId,
        title: t.title,
        description: t.description,
        reward: t.reward,
        dueDate: applyTimeOfDay(scheduled, t.timeOfDay),
        createdById: t.createdById,
        assignedToId: t.defaultAssigneeId,
        originalAssigneeId: t.defaultAssigneeId,
        templateId: t.id,
        scheduledDate: scheduled,
        status: 'PENDING',
      },
    })

    // Bắn notification cho assignee mặc định
    if (t.defaultAssigneeId) {
      const member = await prisma.familyMember.findUnique({ where: { id: t.defaultAssigneeId } })
      if (member) {
        await createNotification({
          userId: member.userId,
          type: 'TASK_ASSIGNED',
          title: 'Nhiệm vụ định kỳ hôm nay',
          body: `"${t.title}" — bạn được giao như thường lệ.`,
          metadata: { taskId: task.id, templateId: t.id },
        })
      }
    }
    created.push(task)
  }
  return created
}

/**
 * Sinh instance hôm nay cho TOÀN BỘ family. Gọi từ cron lúc 00:05 hằng ngày.
 */
export async function generateTodayInstances() {
  const families = await prisma.family.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })
  let total = 0
  for (const f of families) {
    const list = await generateInstancesForFamily(f.id, new Date())
    total += list.length
  }
  return total
}

// ─── Leave / claim flow ───────────────────────────────────────────────────────

/**
 * Assignee xin nghỉ task định kỳ hôm nay → mở claim cho member khác.
 */
export async function requestLeave(taskId: string, familyId: string, access: Access) {
  const task = await prisma.task.findFirst({ where: { id: taskId, familyId } })
  if (!task) throw Errors.NotFound('Task')
  if (!task.templateId) throw Errors.BadRequest('Chỉ task định kỳ mới có thể xin nghỉ')
  if (task.assignedToId !== access.familyMemberId && access.role !== 'PARENT' && access.role !== 'SUPER_ADMIN') {
    throw Errors.Forbidden()
  }
  if (task.status === 'APPROVED' || task.status === 'CANCELLED') {
    throw Errors.BadRequest('Task đã kết thúc, không thể xin nghỉ')
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { isOpenForClaim: true, assignedToId: null, status: 'PENDING' },
    include: { originalAssignee: { include: { user: { select: { displayName: true } } } } },
  })

  // Thông báo realtime + push cho mọi member trừ assignee gốc
  const members = await prisma.familyMember.findMany({
    where: { familyId },
    select: { userId: true, id: true },
  })
  for (const m of members) {
    if (m.id === task.originalAssigneeId) continue
    await createNotification({
      userId: m.userId,
      type: 'RECURRING_TASK_OPEN_CLAIM',
      title: 'Nhiệm vụ cần người nhận giúp',
      body: `${updated.originalAssignee?.user.displayName ?? 'Một thành viên'} xin nghỉ "${task.title}" — bạn có thể nhận giúp.`,
      metadata: { taskId },
    })
  }

  try {
    getIO().to(`family:${familyId}`).emit('recurring-task:open-claim', { taskId, task: updated })
  } catch {}

  return updated
}

/**
 * Một member khác nhận giúp task đang open-for-claim.
 */
export async function claimTask(taskId: string, familyId: string, access: Access) {
  if (!access.familyMemberId) throw Errors.Forbidden()
  const task = await prisma.task.findFirst({ where: { id: taskId, familyId } })
  if (!task) throw Errors.NotFound('Task')
  if (!task.isOpenForClaim) throw Errors.BadRequest('Task không đang mở để nhận giúp')
  if (task.originalAssigneeId === access.familyMemberId) {
    throw Errors.BadRequest('Bạn là người được giao gốc — hãy huỷ xin nghỉ thay vì nhận giúp')
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { isOpenForClaim: false, assignedToId: access.familyMemberId },
    include: {
      assignedTo: { include: { user: { select: { displayName: true } } } },
      originalAssignee: { include: { user: { select: { displayName: true } } } },
    },
  })

  // Thông báo cho assignee gốc + parent
  const targets = await prisma.familyMember.findMany({
    where: { familyId, OR: [{ id: task.originalAssigneeId ?? undefined }, { user: { role: 'PARENT' } }] },
    select: { userId: true },
  })
  for (const t of targets) {
    await createNotification({
      userId: t.userId,
      type: 'RECURRING_TASK_CLAIMED',
      title: 'Đã có người nhận giúp',
      body: `${updated.assignedTo?.user.displayName} sẽ làm thay "${task.title}" hôm nay.`,
      metadata: { taskId },
    })
  }

  try {
    getIO().to(`family:${familyId}`).emit('recurring-task:claimed', { taskId, task: updated })
  } catch {}

  return updated
}

/**
 * PARENT chỉ định trực tiếp một thành viên thay thế. Khác `assignTask` thường
 * ở chỗ giữ `originalAssigneeId` để hiển thị lịch sử.
 */
export async function reassignByParent(
  taskId: string,
  familyId: string,
  newAssigneeId: string,
) {
  const task = await prisma.task.findFirst({ where: { id: taskId, familyId } })
  if (!task) throw Errors.NotFound('Task')
  const m = await prisma.familyMember.findFirst({ where: { id: newAssigneeId, familyId } })
  if (!m) throw Errors.NotFound('Assignee')

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      assignedToId: newAssigneeId,
      isOpenForClaim: false,
      originalAssigneeId: task.originalAssigneeId ?? task.assignedToId,
    },
    include: {
      assignedTo: { include: { user: { select: { displayName: true } } } },
    },
  })

  await createNotification({
    userId: m.userId,
    type: 'TASK_ASSIGNED',
    title: 'Bạn được chỉ định nhiệm vụ',
    body: `Phụ huynh giao bạn làm thay "${task.title}".`,
    metadata: { taskId },
  })

  try {
    getIO().to(`family:${familyId}`).emit('recurring-task:claimed', { taskId, task: updated })
  } catch {}

  return updated
}

/**
 * Cron tick: tìm các task open-for-claim đã quá `dueDate` mà chưa ai nhận →
 * gửi RECURRING_TASK_OVERDUE_UNCLAIMED cho mọi PARENT để override.
 *
 * Idempotent: chỉ bắn 1 lần / task (đánh dấu qua metadata).
 */
export async function notifyOverdueUnclaimed() {
  const now = new Date()
  const tasks = await prisma.task.findMany({
    where: {
      isOpenForClaim: true,
      dueDate: { lt: now },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: { family: true },
  })

  let notified = 0
  for (const t of tasks) {
    // Tránh notify nhiều lần — check notification cũ
    const already = await prisma.notification.findFirst({
      where: {
        type: 'RECURRING_TASK_OVERDUE_UNCLAIMED',
        metadata: { path: ['taskId'], equals: t.id },
      },
    })
    if (already) continue

    const parents = await prisma.familyMember.findMany({
      where: { familyId: t.familyId, user: { role: 'PARENT' } },
      select: { userId: true },
    })
    for (const p of parents) {
      await createNotification({
        userId: p.userId,
        type: 'RECURRING_TASK_OVERDUE_UNCLAIMED',
        title: 'Nhiệm vụ định kỳ chưa có người nhận',
        body: `"${t.title}" đã quá giờ và chưa có ai nhận. Vui lòng chỉ định người thực hiện.`,
        metadata: { taskId: t.id },
      })
      notified++
    }
  }
  return notified
}
