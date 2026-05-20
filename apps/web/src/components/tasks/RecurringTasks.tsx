/**
 * @file RecurringTasks.tsx
 * @description Tab "Định kỳ" trong trang nhiệm vụ: hiển thị template + tạo
 * template + danh sách instance hôm nay với flow xin nghỉ / nhận giúp.
 */
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getInitials, cn } from '@/lib/utils'
import { Plus, Loader2, Calendar, Repeat, HandHeart, UserPlus, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  describeRrule,
  useClaimTask,
  useCreateRecurringTemplate,
  useDeleteRecurringTemplate,
  useGenerateToday,
  useReassignByParent,
  useRecurringTemplates,
  useRequestLeave,
  type RecurringTemplate,
} from '@/hooks/useRecurringTasks'

interface Member {
  id: string
  user: { displayName: string; role: string; avatarUrl?: string | null }
}

interface RecurringTask {
  id: string
  title: string
  status: string
  dueDate?: string | null
  templateId?: string | null
  scheduledDate?: string | null
  isOpenForClaim?: boolean
  reward?: number | string | null
  assignedTo?: { id: string; user: { displayName: string } } | null
  originalAssignee?: { id: string; user: { displayName: string } } | null
}

interface Props {
  isParent: boolean
  currentMemberId?: string
  members: Member[]
}

export function RecurringTasks({ isParent, currentMemberId, members }: Props) {
  const [createOpen, setCreateOpen] = useState(false)

  const { data: templates = [] } = useRecurringTemplates()
  const { data: tasks = [] } = useQuery<RecurringTask[]>({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
  })
  const generate = useGenerateToday()
  const requestLeave = useRequestLeave()
  const claim = useClaimTask()
  const reassign = useReassignByParent()
  const del = useDeleteRecurringTemplate()

  // Lọc các task được sinh từ template + có scheduledDate trong ±2 ngày
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)
  const twoDaysAhead = new Date(today)
  twoDaysAhead.setDate(today.getDate() + 2)
  const recurringInstances = tasks
    .filter((t) => !!t.templateId)
    .filter((t) => {
      if (!t.scheduledDate) return true
      const d = new Date(t.scheduledDate)
      return d >= twoDaysAgo && d <= twoDaysAhead
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Nhiệm vụ định kỳ</h3>
          <p className="text-xs text-muted-foreground">
            Việc lặp lại hằng ngày/tuần. Người được giao gốc có thể xin nghỉ, thành viên khác có thể nhận giúp.
          </p>
        </div>
        <div className="flex gap-2">
          {isParent && (
            <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending} className="gap-1">
              {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Sinh hôm nay
            </Button>
          )}
          {isParent && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" />Tạo nhiệm vụ định kỳ
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mẫu định kỳ ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Chưa có nhiệm vụ định kỳ nào.{' '}
              {isParent && 'Bấm "Tạo nhiệm vụ định kỳ" để bắt đầu.'}
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  isParent={isParent}
                  onDelete={async () => {
                    await del.mutateAsync(t.id)
                    toast.success('Đã vô hiệu hoá mẫu')
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Việc cần làm (vài ngày gần đây)</CardTitle>
        </CardHeader>
        <CardContent>
          {recurringInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Hôm nay không có việc định kỳ nào.</p>
          ) : (
            <div className="space-y-2">
              {recurringInstances.map((t) => (
                <RecurringInstanceRow
                  key={t.id}
                  task={t}
                  isParent={isParent}
                  currentMemberId={currentMemberId}
                  members={members}
                  onRequestLeave={async () => {
                    await requestLeave.mutateAsync(t.id)
                    toast.success('Đã xin nghỉ — chờ thành viên khác nhận giúp')
                  }}
                  onClaim={async () => {
                    await claim.mutateAsync(t.id)
                    toast.success('Bạn đã nhận giúp việc này')
                  }}
                  onReassign={async (assignedToId) => {
                    await reassign.mutateAsync({ taskId: t.id, assignedToId })
                    toast.success('Đã chỉ định lại')
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} members={members} />
    </div>
  )
}

function TemplateRow({
  template,
  isParent,
  onDelete,
}: {
  template: RecurringTemplate
  isParent: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between border rounded-lg p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <Repeat className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{template.title}</p>
          <p className="text-xs text-muted-foreground">
            {describeRrule(template.rrule, template.timeOfDay)}
            {template.defaultAssignee && (
              <>
                {' · Mặc định: '}
                <span className="font-medium text-gray-700">{template.defaultAssignee.user.displayName}</span>
              </>
            )}
            {template.reward && (
              <>
                {' · '}
                <span className="text-green-600 font-medium">{formatCurrency(Number(template.reward))}</span>
              </>
            )}
          </p>
        </div>
      </div>
      {isParent && (
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      )}
    </div>
  )
}

function RecurringInstanceRow({
  task,
  isParent,
  currentMemberId,
  members,
  onRequestLeave,
  onClaim,
  onReassign,
}: {
  task: RecurringTask
  isParent: boolean
  currentMemberId?: string
  members: Member[]
  onRequestLeave: () => void
  onClaim: () => void
  onReassign: (memberId: string) => void
}) {
  const [reassignOpen, setReassignOpen] = useState(false)
  const [pick, setPick] = useState('')

  const isOriginal = task.originalAssignee?.id === currentMemberId
  const isCurrent = task.assignedTo?.id === currentMemberId
  const open = task.isOpenForClaim === true

  return (
    <div
      className={cn(
        'border rounded-lg p-3 flex flex-col gap-2',
        open && 'bg-amber-50 border-amber-200',
        task.status === 'APPROVED' && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{task.title}</span>
          <Badge className="bg-emerald-100 text-emerald-700">Định kỳ</Badge>
          {open && <Badge className="bg-amber-100 text-amber-700">Đang chờ nhận</Badge>}
        </div>
        {task.dueDate && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {task.originalAssignee && (
          <span className="flex items-center gap-1">
            <Avatar className="w-4 h-4">
              <AvatarFallback className="text-[8px]">
                {getInitials(task.originalAssignee.user.displayName)}
              </AvatarFallback>
            </Avatar>
            Gốc: {task.originalAssignee.user.displayName}
          </span>
        )}
        {task.assignedTo && task.assignedTo.id !== task.originalAssignee?.id && (
          <span className="flex items-center gap-1">
            <Avatar className="w-4 h-4">
              <AvatarFallback className="text-[8px]">
                {getInitials(task.assignedTo.user.displayName)}
              </AvatarFallback>
            </Avatar>
            Hôm nay: {task.assignedTo.user.displayName}
          </span>
        )}
        {!task.assignedTo && open && <span className="text-amber-700">Chưa có người nhận</span>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {!open && isOriginal && task.status !== 'APPROVED' && task.status !== 'CANCELLED' && (
          <Button size="sm" variant="outline" onClick={onRequestLeave} className="gap-1">
            <HandHeart className="w-3.5 h-3.5" />Xin nghỉ hôm nay
          </Button>
        )}
        {open && !isCurrent && !isOriginal && (
          <Button size="sm" onClick={onClaim} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <HandHeart className="w-3.5 h-3.5" />Nhận giúp
          </Button>
        )}
        {isParent && (
          <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)} className="gap-1">
            <UserPlus className="w-3.5 h-3.5" />Chỉ định lại
          </Button>
        )}
      </div>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Chỉ định lại "{task.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Giao cho</Label>
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thành viên" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={!pick}
              onClick={() => {
                onReassign(pick)
                setReassignOpen(false)
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  members,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  members: Member[]
}) {
  const create = useCreateRecurringTemplate()
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward: '',
    freq: 'DAILY' as 'DAILY' | 'WEEKLY',
    byday: [] as string[],
    timeOfDay: '07:00',
    defaultAssigneeId: '',
  })

  const weekdays: { code: string; label: string }[] = [
    { code: 'MO', label: 'T2' },
    { code: 'TU', label: 'T3' },
    { code: 'WE', label: 'T4' },
    { code: 'TH', label: 'T5' },
    { code: 'FR', label: 'T6' },
    { code: 'SA', label: 'T7' },
    { code: 'SU', label: 'CN' },
  ]

  const buildRrule = () => {
    if (form.freq === 'DAILY') return 'FREQ=DAILY'
    return `FREQ=WEEKLY${form.byday.length > 0 ? `;BYDAY=${form.byday.join(',')}` : ''}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo nhiệm vụ định kỳ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tên *</Label>
            <Input
              placeholder="Đưa con đi học"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Mô tả</Label>
            <Textarea
              placeholder="Đưa con tới trường lúc 7h sáng..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Tần suất</Label>
              <Select value={form.freq} onValueChange={(v) => setForm({ ...form, freq: v as 'DAILY' | 'WEEKLY' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Hằng ngày</SelectItem>
                  <SelectItem value="WEEKLY">Một số ngày trong tuần</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Giờ thực hiện</Label>
              <Input
                type="time"
                value={form.timeOfDay}
                onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
              />
            </div>
          </div>
          {form.freq === 'WEEKLY' && (
            <div className="space-y-1">
              <Label>Chọn ngày trong tuần</Label>
              <div className="flex gap-1 flex-wrap">
                {weekdays.map((d) => {
                  const active = form.byday.includes(d.code)
                  return (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          byday: active ? form.byday.filter((x) => x !== d.code) : [...form.byday, d.code],
                        })
                      }
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium border',
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600',
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Phần thưởng (VND)</Label>
              <Input
                type="number"
                min={0}
                value={form.reward}
                onChange={(e) => setForm({ ...form, reward: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Người mặc định</Label>
              <Select
                value={form.defaultAssigneeId}
                onValueChange={(v) => setForm({ ...form, defaultAssigneeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn thành viên" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.user.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={!form.title || create.isPending}
            onClick={async () => {
              await create.mutateAsync({
                title: form.title,
                description: form.description || undefined,
                reward: form.reward ? Number(form.reward) : undefined,
                rrule: buildRrule(),
                timeOfDay: form.timeOfDay,
                defaultAssigneeId: form.defaultAssigneeId || undefined,
              })
              toast.success('Đã tạo mẫu định kỳ')
              onOpenChange(false)
              setForm({
                title: '',
                description: '',
                reward: '',
                freq: 'DAILY',
                byday: [],
                timeOfDay: '07:00',
                defaultAssigneeId: '',
              })
            }}
          >
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
