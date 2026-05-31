/**
 * Trang quản lý nhiệm vụ gia đình theo dạng bảng Kanban.
 * Phụ huynh có thể tạo, giao và duyệt nhiệm vụ; con cái có thể bắt đầu và nộp bằng chứng.
 */
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatDate, getInitials, getStatusColor, getStatusLabel, cn } from '@/lib/utils'
import { Plus, Trophy, Calendar, Loader2, CheckCircle, XCircle, Play, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { RecurringTasks } from '@/components/tasks/RecurringTasks'

/**
 * Định nghĩa các cột Kanban tương ứng với trạng thái nhiệm vụ.
 * Thứ tự phản ánh vòng đời: PENDING → IN_PROGRESS → SUBMITTED → APPROVED.
 */
const COLUMNS = [
  { status: 'PENDING', label: 'Chờ làm', color: 'bg-yellow-50 border-yellow-200' },
  { status: 'IN_PROGRESS', label: 'Đang làm', color: 'bg-blue-50 border-blue-200' },
  { status: 'SUBMITTED', label: 'Chờ duyệt', color: 'bg-purple-50 border-purple-200' },
  { status: 'APPROVED', label: 'Hoàn thành', color: 'bg-green-50 border-green-200' },
]

/** Kiểu dữ liệu nhiệm vụ trả về từ API */
interface Task {
  id: string; title: string; description?: string; status: string; reward?: number; dueDate?: string
  templateId?: string | null
  isOpenForClaim?: boolean
  createdBy: { id: string; user: { displayName: string } }
  assignedTo?: { id: string; user: { displayName: string } } | null
  proofs: { id: string; imageUrl?: string; note?: string }[]
}

/**
 * Trang nhiệm vụ với bảng Kanban 4 cột.
 * Quyền hành động phân biệt theo vai trò: PARENT/SUPER_ADMIN có quyền tạo và duyệt,
 * còn FAMILY_MEMBER chỉ có thể bắt đầu và nộp bằng chứng.
 */
export default function TasksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [proofOpen, setProofOpen] = useState(false)
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [tab, setTab] = useState<'oneoff' | 'recurring'>('oneoff')
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL')

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const [form, setForm] = useState({ title: '', description: '', reward: '', dueDate: '', assignedToId: '' })

  const createMut = useMutation({
    mutationFn: (data: typeof form) => api.post('/tasks', { ...data, reward: data.reward ? Number(data.reward) : undefined }),
    onSuccess: () => { toast.success('Tạo nhiệm vụ thành công!'); qc.invalidateQueries({ queryKey: ['tasks'] }); setCreateOpen(false); setForm({ title: '', description: '', reward: '', dueDate: '', assignedToId: '' }) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.patch(`/tasks/${id}/${action}`),
    onSuccess: () => { toast.success('Cập nhật thành công!'); qc.invalidateQueries({ queryKey: ['tasks'] }); setDetailTask(null) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const proofMut = useMutation({
    mutationFn: async ({ taskId, note, file }: { taskId: string; note: string; file: File | null }) => {
      const fd = new FormData()
      fd.append('note', note)
      if (file) fd.append('image', file)
      return api.post(`/tasks/${taskId}/proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('Nộp bằng chứng thành công!'); qc.invalidateQueries({ queryKey: ['tasks'] }); setProofOpen(false); setDetailTask(null) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  // SUPER_ADMIN được coi là phụ huynh để có đầy đủ quyền quản lý nhiệm vụ
  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const pageTitle = isParent ? 'Quản lý nhiệm vụ' : 'Nhiệm vụ của tôi'
  const members = family?.members ?? []
  // Base URL API dùng để hiển thị ảnh bằng chứng
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

  return (
    <div>
      <Topbar title={pageTitle} />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{isParent ? 'Bảng nhiệm vụ gia đình' : 'Việc được giao cho tôi'}</h2>
            <p className="text-sm text-muted-foreground">
              {isParent ? 'Tạo việc, giao cho thành viên, duyệt bằng chứng và thưởng tiền.' : 'Bắt đầu việc được giao, nộp bằng chứng và theo dõi tiền thưởng.'}
            </p>
          </div>
          {isParent && tab === 'oneoff' && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Tạo nhiệm vụ
            </Button>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setTab('oneoff')}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium', tab === 'oneoff' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            Tự phát
          </button>
          <button
            onClick={() => setTab('recurring')}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium', tab === 'recurring' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            Định kỳ
          </button>
        </div>

        {tab === 'oneoff' && isParent && members.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Lọc theo thành viên:</span>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-52 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                <SelectItem value="UNASSIGNED">Chưa giao</SelectItem>
                {members
                  .filter((m: { user: { role: string } }) => m.user.role !== 'SUPER_ADMIN')
                  .map((m: { id: string; user: { displayName: string } }) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.user.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tab === 'recurring' && (
          <RecurringTasks
            isParent={isParent}
            currentMemberId={user?.familyMember?.id}
            members={members}
          />
        )}

        {tab === 'oneoff' && (isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
            {COLUMNS.map(({ status, label, color }) => {
              const colTasks = tasks.filter((t) => {
                if (t.status !== status || t.templateId) return false
                if (!isParent || filterAssignee === 'ALL') return true
                if (filterAssignee === 'UNASSIGNED') return !t.assignedTo
                return t.assignedTo?.id === filterAssignee
              })
              return (
                <div key={status} className={`rounded-xl border-2 p-3 min-h-[200px] ${color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{isParent ? label : status === 'PENDING' ? 'Việc mới' : status === 'SUBMITTED' ? 'Đã nộp chờ duyệt' : label}</h3>
                    <span className="text-xs bg-white rounded-full px-2 py-0.5 font-medium">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <Card key={task.id} className="cursor-pointer hover:shadow-sm transition-shadow bg-white" onClick={() => setDetailTask(task)}>
                        <CardContent className="p-3">
                          <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {task.reward && (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <Trophy className="w-3 h-3" />{formatCurrency(task.reward)}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />{formatDate(task.dueDate)}
                              </span>
                            )}
                          </div>
                          {task.assignedTo && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <Avatar className="w-5 h-5">
                                <AvatarFallback className="text-[10px]">{getInitials(task.assignedTo.user.displayName)}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{task.assignedTo.user.displayName}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Create Task Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo nhiệm vụ mới</DialogTitle>
            <DialogDescription>Phụ huynh tạo việc nhà, đặt thưởng và giao cho thành viên</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên nhiệm vụ *</Label>
              <Input placeholder="Rửa bát sau bữa tối" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea placeholder="Chi tiết nhiệm vụ..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phần thưởng (VND)</Label>
                <Input type="number" placeholder="20000" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hạn chót</Label>
                <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Giao cho</Label>
              <Select value={form.assignedToId} onValueChange={(v) => setForm({ ...form, assignedToId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn thành viên" /></SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m: { user: { role: string } }) => m.user.role !== 'SUPER_ADMIN')
                    .map((m: { id: string; user: { displayName: string; role: string } }) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.user.displayName} ({m.user.role === 'PARENT' ? 'Chủ hộ' : 'Thành viên'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.title}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tạo nhiệm vụ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      <Dialog open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
        <DialogContent className="max-w-lg">
          {detailTask && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTask.title}</DialogTitle>
                <DialogDescription>
                  <Badge className={getStatusColor(detailTask.status)}>{getStatusLabel(detailTask.status)}</Badge>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {detailTask.description && <p className="text-sm text-muted-foreground">{detailTask.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailTask.reward && <div><span className="text-muted-foreground">Phần thưởng:</span> <span className="font-medium text-green-600">{formatCurrency(detailTask.reward)}</span></div>}
                  {detailTask.dueDate && <div><span className="text-muted-foreground">Hạn:</span> <span className="font-medium">{formatDate(detailTask.dueDate)}</span></div>}
                  {detailTask.assignedTo && <div><span className="text-muted-foreground">Giao cho:</span> <span className="font-medium">{detailTask.assignedTo.user.displayName}</span></div>}
                </div>

                {/* Proofs */}
                {detailTask.proofs.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Bằng chứng nộp:</p>
                    {detailTask.proofs.map((proof) => (
                      <div key={proof.id} className="border rounded-lg p-3 space-y-2">
                        {proof.note && <p className="text-sm">{proof.note}</p>}
                        {proof.imageUrl && (
                          <img src={`${API_URL}${proof.imageUrl}`} alt="proof" className="rounded-lg max-h-48 object-cover w-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {!isParent && detailTask.status === 'PENDING' && (
                    <Button onClick={() => actionMut.mutate({ id: detailTask.id, action: 'start' })} disabled={actionMut.isPending}>
                      <Play className="w-4 h-4 mr-2" />Bắt đầu làm
                    </Button>
                  )}
                  {!isParent && detailTask.status === 'IN_PROGRESS' && (
                    <Button onClick={() => { setProofOpen(true) }}>
                      <Upload className="w-4 h-4 mr-2" />Nộp bằng chứng
                    </Button>
                  )}
                  {isParent && detailTask.status === 'SUBMITTED' && (
                    <>
                      <Button onClick={() => actionMut.mutate({ id: detailTask.id, action: 'approve' })} disabled={actionMut.isPending} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-2" />Duyệt
                      </Button>
                      <Button variant="destructive" onClick={() => actionMut.mutate({ id: detailTask.id, action: 'reject' })} disabled={actionMut.isPending}>
                        <XCircle className="w-4 h-4 mr-2" />Từ chối
                      </Button>
                    </>
                  )}
                  {!isParent && !['PENDING', 'IN_PROGRESS'].includes(detailTask.status) && (
                    <p className="text-sm text-muted-foreground">Bạn chỉ cần theo dõi trạng thái nhiệm vụ này.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Proof submission Modal */}
      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nộp bằng chứng</DialogTitle>
            <DialogDescription>Chụp ảnh hoặc mô tả để chứng minh đã hoàn thành</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea placeholder="Mô tả những gì bạn đã làm..." value={proofNote} onChange={(e) => setProofNote(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ảnh bằng chứng (tùy chọn)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" onClick={() => proofMut.mutate({ taskId: detailTask!.id, note: proofNote, file: proofFile })} disabled={proofMut.isPending || (!proofNote && !proofFile)}>
              {proofMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Nộp bằng chứng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
