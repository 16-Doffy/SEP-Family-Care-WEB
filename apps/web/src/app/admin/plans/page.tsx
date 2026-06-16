'use client'
/**
 * Trang quản lý gói thuê bao — viết lại theo API team thật (`/admin/subscription-plans`).
 * DTO thật chỉ có: planCode (FREE/PLUS/PREMIUM — enum cố định, không tự đặt mã),
 * name, annualPrice, maxMembers, storageLimit (MB), featureAccess (map tự do dạng
 * JSON, ví dụ {"aiChatbot":true,"sos":true}), isActive. Các field cũ (priceMonthly,
 * billingPeriod, durationDays, maxTasksPerMonth, albumStorageMb, aiEnabled riêng lẻ...)
 * không tồn tại trong BE hiện tại nên đã bỏ.
 */
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Users, HardDrive, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import {
  useAdminSubscriptionPlans, useCreateSubscriptionPlan, useUpdateSubscriptionPlan, useDeleteSubscriptionPlan,
  type SubscriptionPlan,
} from '@/hooks/useAdmin'

const PLAN_CODES = ['FREE', 'PLUS', 'PREMIUM'] as const

interface FormState {
  planCode: typeof PLAN_CODES[number]
  name: string
  annualPrice: string
  maxMembers: string
  storageLimit: string
  featureAccessJson: string
  isActive: boolean
}

const EMPTY: FormState = {
  planCode: 'FREE', name: '', annualPrice: '0', maxMembers: '', storageLimit: '',
  featureAccessJson: '{\n  "aiChatbot": false,\n  "sos": false\n}', isActive: true,
}

function formatPrice(p: SubscriptionPlan) {
  const n = typeof p.annualPrice === 'string' ? Number(p.annualPrice) : p.annualPrice
  if (!n) return 'Miễn phí'
  return `${n.toLocaleString('vi-VN')} VND / năm`
}

export default function PlansAdminPage() {
  const { data, isLoading } = useAdminSubscriptionPlans({ limit: 100 })
  const createPlan = useCreateSubscriptionPlan()
  const updatePlan = useUpdateSubscriptionPlan()
  const deletePlan = useDeleteSubscriptionPlan()

  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const plans = data?.items ?? []

  useEffect(() => {
    if (editing) {
      setForm({
        planCode: editing.planCode,
        name: editing.name,
        annualPrice: String(editing.annualPrice),
        maxMembers: String(editing.maxMembers),
        storageLimit: String(editing.storageLimit),
        featureAccessJson: JSON.stringify(editing.featureAccess ?? {}, null, 2),
        isActive: editing.isActive,
      })
    }
  }, [editing])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (p: SubscriptionPlan) => { setEditing(p); setOpen(true) }
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(EMPTY) }

  const submit = () => {
    let featureAccess: Record<string, unknown> | undefined
    try {
      featureAccess = form.featureAccessJson.trim() ? JSON.parse(form.featureAccessJson) : undefined
    } catch {
      toast.error('Feature access phải là JSON hợp lệ')
      return
    }
    const payload = {
      planCode: form.planCode,
      name: form.name.trim(),
      annualPrice: Number(form.annualPrice) || 0,
      maxMembers: Number(form.maxMembers) || 0,
      storageLimit: Number(form.storageLimit) || 0,
      featureAccess,
      isActive: form.isActive,
    }
    const onSettled = {
      onSuccess: () => { toast.success(editing ? 'Đã cập nhật gói' : 'Đã tạo gói mới'); closeDialog() },
      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Lưu thất bại')),
    }
    if (editing) updatePlan.mutate({ id: editing.id, ...payload }, onSettled)
    else createPlan.mutate(payload, onSettled)
  }

  const handleDelete = (p: SubscriptionPlan) => {
    if (p._count && p._count.families > 0) {
      toast.error(`Gói đang được ${p._count.families} gia đình sử dụng. Hãy gán gói khác trước.`)
      return
    }
    if (!confirm(`Xoá gói "${p.name}"?`)) return
    deletePlan.mutate(p.id, {
      onSuccess: () => toast.success('Đã xoá gói'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể xoá')),
    })
  }

  return (
    <div>
      <Topbar title="Quản lý gói thuê bao" backHref="/admin" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Tạo và cấu hình các gói FREE / PLUS / PREMIUM (annual-only).</p>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Tạo gói mới</Button>
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
                        <Badge variant="outline" className="text-[10px]">{p.planCode}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold text-blue-600">{formatPrice(p)}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground"><Users className="w-3.5 h-3.5" />{p.maxMembers} thành viên</div>
                    <div className="flex items-center gap-1 text-muted-foreground"><HardDrive className="w-3.5 h-3.5" />{p.storageLimit} MB</div>
                  </div>
                  {p.featureAccess && Object.keys(p.featureAccess).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(p.featureAccess).filter(([, v]) => v).map(([k]) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <Badge variant={p.isActive ? 'default' : 'secondary'}>{p.isActive ? 'Đang hoạt động' : 'Tắt'}</Badge>
                    {p._count && <span className="text-xs text-muted-foreground">{p._count.families} gia đình</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa gói' : 'Tạo gói mới'}</DialogTitle>
            <DialogDescription>planCode chỉ nhận FREE / PLUS / PREMIUM theo enum của BE.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mã gói</Label>
                <Select value={form.planCode} onValueChange={(v) => setForm({ ...form, planCode: v as FormState['planCode'] })} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gói Plus" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Giá / năm (VND)</Label><Input type="number" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} /></div>
              <div className="space-y-2"><Label>Tối đa thành viên</Label><Input type="number" value={form.maxMembers} onChange={(e) => setForm({ ...form, maxMembers: e.target.value })} /></div>
              <div className="space-y-2"><Label>Dung lượng (MB)</Label><Input type="number" value={form.storageLimit} onChange={(e) => setForm({ ...form, storageLimit: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Feature access (JSON)</Label>
              <Textarea value={form.featureAccessJson} onChange={(e) => setForm({ ...form, featureAccessJson: e.target.value })} rows={5} className="font-mono text-xs" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="text-sm">Đang hoạt động</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Huỷ</Button>
            <Button onClick={submit} disabled={createPlan.isPending || updatePlan.isPending || !form.name}>
              {(createPlan.isPending || updatePlan.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
