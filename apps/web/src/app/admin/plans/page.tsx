/**
 * Trang quản lý gói thuê bao (subscription plans) trong admin.
 * Admin có thể tạo, sửa, xóa các gói và xem số gia đình đang dùng từng gói.
 * Hỗ trợ cấu hình: giá theo tháng/năm, thời hạn, giới hạn thành viên/task,
 * dung lượng album & system, quyền AI và AI tài chính, bậc gói (tier).
 */
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Users, CheckSquare, HardDrive, Sparkles, Clock, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  price: number | string
  priceMonthly: number | string | null
  priceYearly: number | string | null
  currency: string
  billingPeriod: string
  durationDays: number | null
  maxMembers: number | null
  maxTasksPerMonth: number | null
  albumStorageMb: number | null
  systemStorageMb: number | null
  aiEnabled: boolean
  aiFinanceEnabled: boolean
  advancedReports: boolean
  prioritySupport: boolean
  tier: number
  features: string[]
  isActive: boolean
  sortOrder: number
  _count?: { families: number }
}

interface PlanFormData {
  code: string
  name: string
  description: string
  price: number
  priceMonthly: string
  priceYearly: string
  currency: string
  billingPeriod: string
  durationDays: string
  maxMembers: string
  maxTasksPerMonth: string
  albumStorageMb: string
  systemStorageMb: string
  aiEnabled: boolean
  aiFinanceEnabled: boolean
  advancedReports: boolean
  prioritySupport: boolean
  tier: number
  features: string
  isActive: boolean
  sortOrder: number
}

const EMPTY: PlanFormData = {
  code: '',
  name: '',
  description: '',
  price: 0,
  priceMonthly: '',
  priceYearly: '',
  currency: 'VND',
  billingPeriod: 'MONTHLY',
  durationDays: '',
  maxMembers: '',
  maxTasksPerMonth: '',
  albumStorageMb: '',
  systemStorageMb: '',
  aiEnabled: false,
  aiFinanceEnabled: false,
  advancedReports: false,
  prioritySupport: false,
  tier: 0,
  features: '',
  isActive: true,
  sortOrder: 0,
}

function formatPrice(p: Plan) {
  const n = typeof p.price === 'string' ? Number(p.price) : p.price
  if (n === 0) return 'Miễn phí'
  return `${n.toLocaleString('vi-VN')} ${p.currency}`
}

function formatMb(mb: number | null) {
  if (mb == null) return '∞'
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`
  return `${mb}MB`
}

export default function PlansAdminPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PlanFormData>(EMPTY)

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans?includeInactive=true').then((r) => r.data.plans),
  })

  const saveMut = useMutation({
    mutationFn: (data: PlanFormData) => {
      const payload = {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        description: data.description.trim() || null,
        price: Number(data.price),
        priceMonthly: data.priceMonthly === '' ? null : Number(data.priceMonthly),
        priceYearly: data.priceYearly === '' ? null : Number(data.priceYearly),
        currency: data.currency,
        billingPeriod: data.billingPeriod,
        durationDays: data.durationDays === '' ? null : Number(data.durationDays),
        maxMembers: data.maxMembers === '' ? null : Number(data.maxMembers),
        maxTasksPerMonth: data.maxTasksPerMonth === '' ? null : Number(data.maxTasksPerMonth),
        albumStorageMb: data.albumStorageMb === '' ? null : Number(data.albumStorageMb),
        systemStorageMb: data.systemStorageMb === '' ? null : Number(data.systemStorageMb),
        aiEnabled: data.aiEnabled,
        aiFinanceEnabled: data.aiFinanceEnabled,
        advancedReports: data.advancedReports,
        prioritySupport: data.prioritySupport,
        tier: Number(data.tier) || 0,
        features: data.features.split('\n').map((s) => s.trim()).filter(Boolean),
        isActive: data.isActive,
        sortOrder: Number(data.sortOrder) || 0,
      }
      return editing
        ? api.put(`/admin/plans/${editing.id}`, payload)
        : api.post('/admin/plans', payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật gói' : 'Đã tạo gói mới')
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
      qc.invalidateQueries({ queryKey: ['admin-families'] })
      closeDialog()
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Lưu thất bại')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá gói')
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Không thể xoá')
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (p: Plan) => {
    setEditing(p)
    setForm({
      code: p.code,
      name: p.name,
      description: p.description ?? '',
      price: Number(p.price),
      priceMonthly: p.priceMonthly == null ? '' : String(p.priceMonthly),
      priceYearly: p.priceYearly == null ? '' : String(p.priceYearly),
      currency: p.currency,
      billingPeriod: p.billingPeriod,
      durationDays: p.durationDays == null ? '' : String(p.durationDays),
      maxMembers: p.maxMembers == null ? '' : String(p.maxMembers),
      maxTasksPerMonth: p.maxTasksPerMonth == null ? '' : String(p.maxTasksPerMonth),
      albumStorageMb: p.albumStorageMb == null ? '' : String(p.albumStorageMb),
      systemStorageMb: p.systemStorageMb == null ? '' : String(p.systemStorageMb),
      aiEnabled: p.aiEnabled,
      aiFinanceEnabled: p.aiFinanceEnabled,
      advancedReports: p.advancedReports,
      prioritySupport: p.prioritySupport,
      tier: p.tier,
      features: (p.features ?? []).join('\n'),
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    })
    setOpen(true)
  }

  const closeDialog = () => {
    setOpen(false)
    setEditing(null)
    setForm(EMPTY)
  }

  const handleDelete = (p: Plan) => {
    if (p._count && p._count.families > 0) {
      toast.error(`Gói đang được ${p._count.families} gia đình sử dụng. Hãy gán gói khác trước.`)
      return
    }
    if (!confirm(`Xoá gói "${p.name}"?`)) return
    deleteMut.mutate(p.id)
  }

  return (
    <div>
      <Topbar title="Quản lý gói thuê bao" backHref="/admin" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Tạo và cấu hình các gói theo bậc (tier), giá tháng/năm, dung lượng album/system, quyền AI. Giới hạn được áp dụng tự động cho từng gia đình.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Tạo gói mới
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Đang tải...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.id} className={!p.isActive ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">Tier {p.tier}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <code>{p.code}</code> · {p.billingPeriod}
                        {p.durationDays != null && ` · ${p.durationDays} ngày`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold text-blue-600">{formatPrice(p)}</p>
                  <p className="text-xs text-muted-foreground">
                    Tháng: {p.priceMonthly == null ? '-' : Number(p.priceMonthly).toLocaleString('vi-VN')} ·
                    Năm: {p.priceYearly == null ? '-' : Number(p.priceYearly).toLocaleString('vi-VN')}
                  </p>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {p.maxMembers == null ? '∞' : p.maxMembers} thành viên
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {p.maxTasksPerMonth == null ? '∞' : p.maxTasksPerMonth} task/th
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <HardDrive className="w-3.5 h-3.5" />
                      Album: {formatMb(p.albumStorageMb)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <HardDrive className="w-3.5 h-3.5" />
                      System: {formatMb(p.systemStorageMb)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.aiEnabled && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Sparkles className="w-3 h-3" /> AI
                      </Badge>
                    )}
                    {p.aiFinanceEnabled && (
                      <Badge className="gap-1 text-[10px] bg-violet-100 text-violet-700 hover:bg-violet-100">
                        <Sparkles className="w-3 h-3" /> AI tài chính
                      </Badge>
                    )}
                    {p.advancedReports && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <BarChart3 className="w-3 h-3" /> Báo cáo
                      </Badge>
                    )}
                    {p.prioritySupport && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Clock className="w-3 h-3" /> Ưu tiên
                      </Badge>
                    )}
                  </div>

                  {p.features.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {p.features.map((f, i) => (
                        <li key={i} className="text-gray-700">✓ {f}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t">
                    <Badge variant={p.isActive ? 'default' : 'secondary'}>
                      {p.isActive ? 'Đang hoạt động' : 'Tắt'}
                    </Badge>
                    {p._count && (
                      <span className="text-xs text-muted-foreground">
                        {p._count.families} gia đình
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa gói' : 'Tạo gói mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mã (UPPER_SNAKE)</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="PRO_MONTHLY"
                  disabled={!!editing}
                />
              </div>
              <div>
                <Label>Tên hiển thị</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro tháng" />
              </div>
            </div>

            <div>
              <Label>Mô tả</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            {/* Giá / chu kỳ / thời hạn */}
            <fieldset className="border rounded-md p-3 space-y-3">
              <legend className="px-2 text-sm font-medium text-slate-700">Giá & thời hạn</legend>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Giá hiển thị</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Tiền tệ</Label>
                  <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>Chu kỳ thanh toán</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={form.billingPeriod}
                    onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
                  >
                    <option value="FREE">FREE</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="LIFETIME">LIFETIME</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Giá theo tháng</Label>
                  <Input
                    type="number"
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                    placeholder="VD: 49000"
                  />
                </div>
                <div>
                  <Label>Giá theo năm</Label>
                  <Input
                    type="number"
                    value={form.priceYearly}
                    onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
                    placeholder="VD: 490000"
                  />
                </div>
                <div>
                  <Label>Thời hạn (ngày)</Label>
                  <Input
                    type="number"
                    value={form.durationDays}
                    onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                    placeholder="30 / 365 / trống"
                  />
                </div>
              </div>
            </fieldset>

            {/* Giới hạn tài nguyên */}
            <fieldset className="border rounded-md p-3 space-y-3">
              <legend className="px-2 text-sm font-medium text-slate-700">Giới hạn tài nguyên (trống = không giới hạn)</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tối đa thành viên</Label>
                  <Input
                    type="number"
                    value={form.maxMembers}
                    onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
                    placeholder="VD: 8"
                  />
                </div>
                <div>
                  <Label>Task/tháng</Label>
                  <Input
                    type="number"
                    value={form.maxTasksPerMonth}
                    onChange={(e) => setForm({ ...form, maxTasksPerMonth: e.target.value })}
                    placeholder="VD: 100"
                  />
                </div>
                <div>
                  <Label>Dung lượng album (MB)</Label>
                  <Input
                    type="number"
                    value={form.albumStorageMb}
                    onChange={(e) => setForm({ ...form, albumStorageMb: e.target.value })}
                    placeholder="VD: 1024"
                  />
                </div>
                <div>
                  <Label>Dung lượng hệ thống (MB)</Label>
                  <Input
                    type="number"
                    value={form.systemStorageMb}
                    onChange={(e) => setForm({ ...form, systemStorageMb: e.target.value })}
                    placeholder="VD: 2048"
                  />
                </div>
              </div>
            </fieldset>

            {/* Tính năng nâng cao */}
            <fieldset className="border rounded-md p-3 space-y-3">
              <legend className="px-2 text-sm font-medium text-slate-700">Tính năng nâng cao</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.aiEnabled}
                    onChange={(e) => setForm({ ...form, aiEnabled: e.target.checked })}
                  />
                  AI Chatbot cơ bản
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.aiFinanceEnabled}
                    onChange={(e) => setForm({ ...form, aiFinanceEnabled: e.target.checked })}
                  />
                  AI tài chính (dự báo)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.advancedReports}
                    onChange={(e) => setForm({ ...form, advancedReports: e.target.checked })}
                  />
                  Báo cáo nâng cao
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.prioritySupport}
                    onChange={(e) => setForm({ ...form, prioritySupport: e.target.checked })}
                  />
                  Hỗ trợ ưu tiên
                </label>
              </div>
            </fieldset>

            <div>
              <Label>Tính năng hiển thị (mỗi dòng 1 tính năng)</Label>
              <Textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                rows={4}
                placeholder={'Chat gia đình\nAlbum ảnh không giới hạn'}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Tier (bậc gói)</Label>
                <Input
                  type="number"
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })}
                  placeholder="0 = FREE, 3 = PREMIUM"
                />
              </div>
              <div>
                <Label>Thứ tự hiển thị</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span className="text-sm">Đang hoạt động</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Huỷ</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.code || !form.name}>
              {saveMut.isPending ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
