/**
 * @module hooks/useRecurringTasks
 * @description React Query hooks cho nhiệm vụ định kỳ (Core flow 2).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RecurringTemplate {
  id: string
  title: string
  description: string | null
  reward: number | string | null
  rrule: string
  timeOfDay: string | null
  isActive: boolean
  defaultAssigneeId: string | null
  defaultAssignee: {
    id: string
    user: { displayName: string; avatarUrl: string | null }
  } | null
  createdBy: { id: string; user: { displayName: string } }
}

export function useRecurringTemplates() {
  return useQuery<RecurringTemplate[]>({
    queryKey: ['recurring-templates'],
    queryFn: () => api.get('/recurring-tasks').then((r) => r.data),
  })
}

export function useCreateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      description?: string
      reward?: number
      rrule: string
      timeOfDay?: string
      defaultAssigneeId?: string
    }) => api.post('/recurring-tasks', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
    },
  })
}

export function useDeleteRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recurring-tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
    },
  })
}

export function useGenerateToday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/recurring-tasks/generate-today').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useRequestLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api.post(`/recurring-tasks/tasks/${taskId}/request-leave`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useClaimTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api.post(`/recurring-tasks/tasks/${taskId}/claim`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useReassignByParent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assignedToId }: { taskId: string; assignedToId: string }) =>
      api.post(`/recurring-tasks/tasks/${taskId}/reassign`, { assignedToId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/**
 * Mô tả RRULE đơn giản bằng tiếng Việt cho hiển thị.
 * Hỗ trợ FREQ=DAILY, FREQ=WEEKLY;BYDAY=...
 */
export function describeRrule(rrule: string, timeOfDay?: string | null): string {
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
  const time = timeOfDay ? ` lúc ${timeOfDay}` : ''
  if (parts.FREQ === 'DAILY') return `Hằng ngày${time}`
  if (parts.FREQ === 'WEEKLY') {
    const map: Record<string, string> = {
      MO: 'Thứ 2',
      TU: 'Thứ 3',
      WE: 'Thứ 4',
      TH: 'Thứ 5',
      FR: 'Thứ 6',
      SA: 'Thứ 7',
      SU: 'Chủ nhật',
    }
    const days = (parts.BYDAY ?? '')
      .split(',')
      .map((d) => map[d])
      .filter(Boolean)
      .join(', ')
    return days ? `${days}${time}` : `Hằng tuần${time}`
  }
  return rrule
}
