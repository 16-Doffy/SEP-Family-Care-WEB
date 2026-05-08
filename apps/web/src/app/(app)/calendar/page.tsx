'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FamilyEvent {
  id: string
  title: string
  description?: string | null
  startDate: string
  endDate?: string | null
  allDay: boolean
  color: string
  createdBy: { user: { id: string; displayName: string } }
}

const EVENT_COLORS = [
  { label: 'Xanh dương', value: '#3b82f6' },
  { label: 'Xanh lá', value: '#22c55e' },
  { label: 'Đỏ', value: '#ef4444' },
  { label: 'Cam', value: '#f97316' },
  { label: 'Tím', value: '#a855f7' },
  { label: 'Hồng', value: '#ec4899' },
]

function formatMonth(date: Date) {
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', allDay: true, color: '#3b82f6' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const { data: events = [], isLoading } = useQuery<FamilyEvent[]>({
    queryKey: ['calendar', year, month],
    queryFn: () => api.get('/calendar', { params: { month: `${year}-${String(month + 1).padStart(2, '0')}-01` } }).then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const createMut = useMutation({
    mutationFn: (data: typeof form) => api.post('/calendar', data),
    onSuccess: () => {
      toast.success('Đã tạo sự kiện')
      qc.invalidateQueries({ queryKey: ['calendar'] })
      setShowCreate(false)
      setForm({ title: '', description: '', startDate: '', endDate: '', allDay: true, color: '#3b82f6' })
    },
    onError: () => toast.error('Tạo thất bại'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa sự kiện')
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: () => toast.error('Xóa thất bại'),
  })

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const getEventsForDay = (day: number) => {
    const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.startDate.slice(0, 10) === ymd)
  }

  const selectedDayEvents = selectedDate
    ? events.filter((e) => e.startDate.slice(0, 10) === selectedDate)
    : []

  const openCreate = (date?: string) => {
    const d = date ?? toYMD(new Date())
    setForm((f) => ({ ...f, startDate: d, endDate: d }))
    setShowCreate(true)
  }

  if (!user?.familyMember) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar title="Lịch gia đình" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Bạn cần tham gia gia đình để xem lịch</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Lịch gia đình" />
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 flex flex-col p-6 overflow-auto">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <h2 className="text-xl font-semibold min-w-48 text-center">{formatMonth(currentDate)}</h2>
              <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="text-blue-600">Hôm nay</Button>
            </div>
            <Button onClick={() => openCreate()} className="gap-2">
              <Plus className="w-4 h-4" />
              Thêm sự kiện
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="min-h-24 border-b border-r last:border-r-0 bg-gray-50" />
                  const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = ymd === toYMD(new Date())
                  const isSelected = ymd === selectedDate
                  const dayEvents = getEventsForDay(day)
                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDate(isSelected ? null : ymd)}
                      className={cn(
                        'min-h-24 border-b border-r last:border-r-0 p-1 cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
                        (i + 1) % 7 === 0 && 'border-r-0',
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1',
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700',
                      )}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="text-[11px] px-1 py-0.5 rounded truncate text-white font-medium leading-tight"
                            style={{ backgroundColor: e.color }}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} khác</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: selected day events */}
        <aside className="w-72 border-l bg-white flex flex-col shrink-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CalendarDays className="w-4 h-4" />
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Chọn ngày để xem sự kiện'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedDate ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Sắp tới</p>
                {events.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg border">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.startDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Không có sự kiện</p>}
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <CalendarDays className="w-8 h-8 opacity-30" />
                <p className="text-sm">Không có sự kiện</p>
                <Button size="sm" variant="outline" onClick={() => openCreate(selectedDate)} className="gap-1 mt-1">
                  <Plus className="w-3 h-3" />Thêm
                </Button>
              </div>
            ) : (
              <>
                {selectedDayEvents.map((e) => (
                  <div key={e.id} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: e.color }} />
                        <p className="text-sm font-medium truncate">{e.title}</p>
                      </div>
                      <button
                        onClick={() => { if (confirm('Xóa sự kiện này?')) deleteMut.mutate(e.id) }}
                        className="text-muted-foreground hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground pl-4">{e.description}</p>}
                    <p className="text-xs text-muted-foreground pl-4">
                      {e.allDay ? 'Cả ngày' : new Date(e.startDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-muted-foreground pl-4">Bởi {e.createdBy.user.displayName}</p>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => openCreate(selectedDate)}>
                  <Plus className="w-3 h-3" />Thêm sự kiện
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Create event dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm sự kiện</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tên sự kiện *</label>
              <Input
                placeholder="Sinh nhật, họp mặt gia đình..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mô tả</label>
              <Input
                placeholder="Chi tiết sự kiện..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Ngày bắt đầu *</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ngày kết thúc</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Màu sắc</label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={cn('w-7 h-7 rounded-full transition-all', form.color === c.value && 'ring-2 ring-offset-2 ring-gray-400')}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Cả ngày</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Hủy</Button>
            <Button
              onClick={() => { if (!form.title.trim() || !form.startDate) { toast.error('Vui lòng điền tên và ngày'); return } createMut.mutate(form) }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tạo sự kiện
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
