/**
 * Trang quản lý gói thuê bao (subscription plans) trong admin.
 * Admin có thể tạo, sửa, xóa các gói và xem số gia đình đang dùng từng gói.
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
import { Pencil, Trash2, Plus, Users, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'

/** Kiểu dữ liệu gói thuê bao đầy đủ từ API */
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
  maxMembers: number | null
  maxTasksPerMonth: number | null
  features: string[]
  isActive: boolean
  sortOrder: number
  /** Số gia đình đang sử dụng gói này (dùng để ngăn xóa khi còn đang dùng) */
  _count?: { families: number }
}

/**
 * Dữ liệu form tạo/sửa gói.
 * maxMembers và maxTasksPerMonth là string để hỗ trợ input trống (= không giới hạn).
 */
interface PlanFormData {
  code: string
  name: string
  description: string
  price: number
  priceMonthly: string
  priceYearly: string
  currency: string
  billingPeriod: string
  maxMembers: string
  maxTasksPerMonth: string
  features: string
  isActive: boolean
  sortOrder: number
}

/** Giá trị form rỗng dùng khi tạo gói mới */
const EMPTY: PlanFormData = {
  code: '', name: '', description: '', price: 0, priceMonthly: '', priceYearly: '', currency: 'VND', billingPeriod: 'MONTHLY',
  maxMembers: '', maxTasksPerMonth: '', features: '', isActive: true, sortOrder: 0,
}

/**
 * Định dạng giá tiền của gói để hiển thị.
 * @param p - Gói cần hiển thị giá
 */
function formatPrice(p: Plan) {
  const n = typeof p.price === 'string' ? Number(p.price) : p.price
  if (n === 0) return 'Miễn phí'
  return `${n.toLocaleString('vi-VN')} ${p.currency}`
}

/**
 * Trang quản lý gói thuê bao.
 * `editing` là null khi tạo mới, có giá trị khi đang sửa gói hiện tại.
 */
export default function PlansAdminPage() {
  const qc = useQueryClient()
  // null = đang tạo mới; có giá trị = đang sửa gói này
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
        // Chuỗi trống được chuyển thành null để biểu thị "không giới hạn" phía backend
        maxMembers: data.maxMembers === '' ? null : Number(data.maxMembers),
        maxTasksPerMonth: data.maxTasksPerMonth === '' ? null : Number(data.maxTasksPerMonth),
        // Mỗi dòng trong textarea là một tính năng riêng biệt
        features: data.features.split('\n').map((s) => s.trim()).filter(Boolean),
        isActive: data.isActive,
        sortOrder: Number(data.sortOrder) || 0,
      }
      // Nếu đang sửa gói hiện có thì dùng PUT, nếu tạo mới thì dùng POST
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
      maxMembers: p.maxMembers == null ? '' : String(p.maxMembers),
      maxTasksPerMonth: p.maxTasksPerMonth == null ? '' : String(p.maxTasksPerMonth),
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

  /**
   * Xử lý xóa gói thuê bao.
   * Ngăn xóa nếu gói đang được ít nhất một gia đình sử dụng để tránh mất dữ liệu.
   * @param p - Gói cần xóa
   */
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
      <Topbar title="Quản lý gói thuê bao" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Tạo các gói thuê bao và gán cho từng gia đình. Giới hạn (số thành viên, số task/tháng) được áp dụng tự động.
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
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        <code>{p.code}</code> · {p.billingPeriod}
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

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {p.maxMembers == null ? 'Không giới hạn' : `${p.maxMembers} thành viên`}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckSquare className="w-4 h-4" />
                      {p.maxTasksPerMonth == null ? '∞' : `${p.maxTasksPerMonth}`} task/th
                    </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Giá</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Tiền tệ</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>Chu kỳ</Label>
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

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tối đa thành viên (trống = không giới hạn)</Label>
                <Input
                  type="number"
                  value={form.maxMembers}
                  onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
                  placeholder="VD: 8"
                />
              </div>
              <div>
                <Label>Task/tháng (trống = không giới hạn)</Label>
                <Input
                  type="number"
                  value={form.maxTasksPerMonth}
                  onChange={(e) => setForm({ ...form, maxTasksPerMonth: e.target.value })}
                  placeholder="VD: 100"
                />
              </div>
            </div>

            <div>
              <Label>Tính năng (mỗi dòng 1 tính năng)</Label>
              <Textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                rows={4}
                placeholder={'Chat gia đình\nAlbum ảnh không giới hạn'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Thứ tự sắp xếp</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
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
