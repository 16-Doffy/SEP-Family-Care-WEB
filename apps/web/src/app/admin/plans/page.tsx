'use client'
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, HardDrive, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import {
  useAdminSubscriptionPlans, useCreateSubscriptionPlan, useUpdateSubscriptionPlan, useDeleteSubscriptionPlan,
  type SubscriptionPlan,
} from '@/hooks/useAdmin'

const PLAN_CODES = ['FREE', 'PLUS', 'PREMIUM'] as const

/** Các tính năng được BE hỗ trợ trong featureAccess */
const FEATURES: { key: string; label: string; description: string }[] = [
  { key: 'aiChatbot', label: 'AI Chatbot', description: 'Trợ lý AI trong ứng dụng' },
  { key: 'sos', label: 'SOS khẩn cấp', description: 'Gửi tín hiệu SOS cho thành viên gia đình' },
  { key: 'advancedReports', label: 'Báo cáo nâng cao', description: 'Thống kê tài chính chi tiết' },
  { key: 'unlimitedStorage', label: 'Lưu trữ không giới hạn', description: 'Dung lượng album ảnh không giới hạn' },
]

interface FormState {
  planCode: typeof PLAN_CODES[number]
  name: string
  annualPrice: string
  storageLimit: string
  features: Record<string, boolean>
  isActive: boolean
}

const EMPTY: FormState = {
  planCode: 'FREE', name: '', annualPrice: '0', storageLimit: '',
  features: Object.fromEntries(FEATURES.map((f) => [f.key, false])),
  isActive: true,
}

function formatPrice(p: SubscriptionPlan) {
  const n = typeof p.annualPrice === 'string' ? Number(p.annualPrice) : p.annualPrice
  if (!n) return 'Miễn phí'
  return `${n.toLocaleString('vi-VN')} VND / năm`
}

function featureLabel(key: string) {
  return FEATURES.find((f) => f.key === key)?.label ?? key
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
  const usedCodes = plans.map((p) => p.planCode)
  const availableCodes = PLAN_CODES.filter((c) => !usedCodes.includes(c))
  const canCreate = availableCodes.length > 0

  useEffect(() => {
    if (editing) {
      const fa = (editing.featureAccess ?? {}) as Record<string, boolean>
      const features = Object.fromEntries(FEATURES.map((f) => [f.key, !!fa[f.key]]))
      // giữ lại bất kỳ key lạ nào mà BE trả về nhưng không trong danh sách
      Object.entries(fa).forEach(([k, v]) => { if (!(k in features)) features[k] = !!v })
      setForm({
        planCode: editing.planCode,
        name: editing.name,
        annualPrice: String(editing.annualPrice),
        storageLimit: String(editing.storageLimit),
        features,
        isActive: editing.isActive,
      })
    }
  }, [editing])

  const openCreate = () => {
    if (!canCreate) return
    const firstAvailable = availableCodes[0]
    setEditing(null)
    setForm({ ...EMPTY, planCode: firstAvailable })
    setOpen(true)
  }
  const openEdit = (p: SubscriptionPlan) => { setEditing(p); setOpen(true) }
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(EMPTY) }

  const toggleFeature = (key: string) =>
    setForm((prev) => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }))

  const submit = () => {
    const payload = {
      planCode: form.planCode,
      name: form.name.trim(),
      annualPrice: Number(form.annualPrice) || 0,
      maxMembers: 9999,
      storageLimit: Number(form.storageLimit) || 0,
      featureAccess: form.features,
      isActive: form.isActive,
    }
    const onSettled = {
      onSuccess: () => { toast.success(editing ? 'Đã cập nhật gói' : 'Đã tạo gói mới'); closeDialog() },
      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Lưu thất bại')),
    }
    if (editing) updatePlan.mutate({ id: editing.id, ...payload }, onSettled)
    else createPlan.mutate(payload as Parameters<typeof createPlan.mutate>[0], onSettled)
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
          <p className="text-sm text-muted-foreground">Tạo và cấu hình các gói FREE / PLUS / PREMIUM.</p>
          <Button onClick={openCreate} disabled={!canCreate} className="gap-2" title={!canCreate ? 'Đã có đủ 3 gói FREE / PLUS / PREMIUM' : undefined}>
            <Plus className="w-4 h-4" />Tạo gói mới
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{p.planCode}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold text-blue-600">{formatPrice(p)}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <HardDrive className="w-3.5 h-3.5" />{p.storageLimit} MB
                  </div>
                  {p.featureAccess && Object.keys(p.featureAccess).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(p.featureAccess).filter(([, v]) => v).map(([k]) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{featureLabel(k)}</Badge>
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
                  <SelectContent>{(editing ? PLAN_CODES : availableCodes).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tên hiển thị</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gói Plus" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Giá / năm (VND)</Label>
                <Input type="number" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dung lượng (MB)</Label>
                <Input type="number" value={form.storageLimit} onChange={(e) => setForm({ ...form, storageLimit: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tính năng</Label>
              <div className="border rounded-md divide-y">
                {FEATURES.map((f) => (
                  <label key={f.key} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-violet-600"
                      checked={!!form.features[f.key]}
                      onChange={() => toggleFeature(f.key)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 accent-violet-600" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="text-sm font-medium">Đang hoạt động</span>
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
