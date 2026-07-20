'use client'
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, HardDrive, Users, Loader2, CreditCard, BadgePercent, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import {
  useAdminSubscriptionPlans, useCreateSubscriptionPlan, useUpdateSubscriptionPlan, useDeleteSubscriptionPlan,
  type SubscriptionPlan,
} from '@/hooks/useAdmin'

/**
 * Các key featureAccess được BE document trong swagger example.
 * BE nhận bất kỳ key nào (generic map), nhưng FE chỉ hiển thị các key đã biết
 * dưới dạng checkbox. Key lạ từ BE vẫn được giữ nguyên khi PATCH.
 */
const KNOWN_FEATURES: { key: string; label: string; description: string }[] = [
  { key: 'calendar.enabled', label: 'Calendar', description: 'Tạo, sửa và hủy sự kiện lịch' },
  { key: 'calendar.reminders', label: 'Calendar reminders', description: 'Bật/tắt nhắc lịch cá nhân' },
  { key: 'calendar.recurringEvents', label: 'Recurring calendar', description: 'Tạo sự kiện lịch lặp lại' },
  { key: 'aiChatbot', label: 'AI Chatbot', description: 'Trợ lý AI trong ứng dụng' },
  { key: 'sos', label: 'SOS khẩn cấp', description: 'Gửi tín hiệu SOS cho thành viên gia đình' },
  { key: 'advancedReports', label: 'Báo cáo nâng cao', description: 'Thống kê tài chính chi tiết' },
  { key: 'unlimitedStorage', label: 'Lưu trữ không giới hạn', description: 'Dung lượng album ảnh không giới hạn' },
]

function featureLabel(key: string) {
  return KNOWN_FEATURES.find((f) => f.key === key)?.label ?? key
}

interface FormState {
  planCode: string
  name: string
  annualPrice: string
  maxMembers: string   // required on CREATE per swagger
  storageLimit: string
  stripePriceId: string
  features: Record<string, boolean>
  isActive: boolean
}

const EMPTY: FormState = {
  planCode: '', name: '', annualPrice: '0', maxMembers: '', storageLimit: '0',
  stripePriceId: '',
  features: Object.fromEntries(KNOWN_FEATURES.map((f) => [f.key, false])),
  isActive: true,
}

const PLAN_CODE_RE = /^[A-Z0-9_]+$/

const toPrice = (value: number | string) => Number(value) || 0
const money = (value: number) => `${value.toLocaleString('vi-VN')} VND`
const isMonthlyPlan = (plan: SubscriptionPlan) => /MONTH|THANG/i.test(plan.planCode)
const isYearlyPlan = (plan: SubscriptionPlan) => /YEAR|NAM/i.test(plan.planCode)

function PriceSummary({ plan, plans }: { plan: SubscriptionPlan; plans: SubscriptionPlan[] }) {
  const price = toPrice(plan.annualPrice)
  const monthlyPlan = plans.find((candidate) => isMonthlyPlan(candidate))
  const monthlyPrice = monthlyPlan ? toPrice(monthlyPlan.annualPrice) : 0
  const isYearly = isYearlyPlan(plan)
  const originalYearlyPrice = isYearly && monthlyPrice ? monthlyPrice * 12 : 0
  const saving = originalYearlyPrice > price ? originalYearlyPrice - price : 0
  const savingPercent = saving ? Math.round((saving / originalYearlyPrice) * 100) : 0

  if (price === 0) return <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3"><p className="text-2xl font-bold text-emerald-700">Miễn phí</p><p className="mt-1 text-xs text-emerald-700/80">Không phát sinh chi phí</p></div>
  if (!isYearly) return <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 px-3 py-3"><p className="text-xs font-medium text-muted-foreground">Thanh toán theo tháng</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-violet-700">{money(price)} <span className="text-sm font-medium">/ tháng</span></p><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Tổng 12 tháng: <span className="font-semibold text-foreground">{money(price * 12)}</span></p></div>
  return <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-3 py-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-muted-foreground">Thanh toán theo năm</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-blue-700">{money(price)}</p></div>{saving > 0 && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><BadgePercent className="h-3 w-3" />Tiết kiệm {savingPercent}%</Badge>}</div>{originalYearlyPrice > 0 && <div className="mt-2 flex items-center gap-2 text-xs"><span className="text-muted-foreground line-through">{money(originalYearlyPrice)}</span><span className="font-semibold text-emerald-700">Giảm {money(saving)}</span></div>}<p className="mt-2 text-xs text-muted-foreground">Tương đương {money(Math.round(price / 12))} / tháng</p></div>
}

export default function PlansAdminPage() {
  const { data, isLoading } = useAdminSubscriptionPlans({ limit: 100 })
  const createPlan = useCreateSubscriptionPlan()
  const updatePlan = useUpdateSubscriptionPlan()
  const deletePlan = useDeleteSubscriptionPlan()

  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [codeError, setCodeError] = useState('')

  const plans = data?.items ?? []

  useEffect(() => {
    if (!open) return
    if (editing) {
      // Giữ lại các key lạ từ BE (ngoài KNOWN_FEATURES) để không mất data khi PATCH
      const fa = (editing.featureAccess ?? {}) as Record<string, boolean>
      const features: Record<string, boolean> = {}
      KNOWN_FEATURES.forEach((f) => { features[f.key] = !!fa[f.key] })
      Object.entries(fa).forEach(([k, v]) => { if (!(k in features)) features[k] = !!v })
      setForm({
        planCode: editing.planCode,
        name: editing.name,
        annualPrice: String(editing.annualPrice ?? 0),
        maxMembers: editing.maxMembers != null ? String(editing.maxMembers) : '',
        storageLimit: String(editing.storageLimit ?? 0),
        stripePriceId: editing.stripePriceId ?? '',
        features,
        isActive: editing.isActive,
      })
    } else {
      setForm(EMPTY)
    }
    setCodeError('')
  }, [editing, open])

  const openCreate = () => { setEditing(null); setOpen(true) }
  const openEdit = (p: SubscriptionPlan) => { setEditing(p); setOpen(true) }
  const closeDialog = () => { setOpen(false); setEditing(null) }

  const setCode = (v: string) => {
    const upper = v.toUpperCase().replace(/[^A-Z0-9_]/g, '')
    setForm((prev) => ({ ...prev, planCode: upper }))
    setCodeError(upper && !PLAN_CODE_RE.test(upper) ? 'Chỉ dùng chữ HOA, số, dấu gạch dưới' : '')
  }

  const toggleFeature = (key: string) =>
    setForm((prev) => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }))

  const validate = (): boolean => {
    if (!form.planCode.trim()) { toast.error('Mã gói không được để trống'); return false }
    if (!PLAN_CODE_RE.test(form.planCode)) { toast.error('Mã gói chỉ dùng chữ HOA, số, dấu _'); return false }
    if (!form.name.trim()) { toast.error('Tên hiển thị không được để trống'); return false }
    if (!editing && !form.maxMembers) { toast.error('Số thành viên tối đa là bắt buộc'); return false }
    return true
  }

  const submit = () => {
    if (!validate()) return
    const payload = {
      planCode: form.planCode,
      name: form.name.trim(),
      annualPrice: Number(form.annualPrice) || 0,
      maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
      storageLimit: Number(form.storageLimit) || 0,
      stripePriceId: form.stripePriceId.trim() || undefined,
      featureAccess: form.features,
      isActive: form.isActive,
    }
    const callbacks = {
      onSuccess: () => { toast.success(editing ? 'Đã cập nhật gói' : 'Đã tạo gói mới'); closeDialog() },
      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Lưu thất bại')),
    }
    if (editing) {
      const { planCode: _pc, ...updatePayload } = payload
      updatePlan.mutate({ id: editing.id, ...updatePayload }, callbacks)
    } else {
      createPlan.mutate(payload as Parameters<typeof createPlan.mutate>[0], callbacks)
    }
  }

  const handleDelete = (p: SubscriptionPlan) => {
    if (p._count && p._count.families > 0) {
      toast.error(`Gói đang được ${p._count.families} gia đình sử dụng`)
      return
    }
    if (!confirm(`Xoá gói "${p.name}" (${p.planCode})?`)) return
    deletePlan.mutate(p.id, {
      onSuccess: () => toast.success('Đã xoá gói'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể xoá')),
    })
  }

  const isPending = createPlan.isPending || updatePlan.isPending

  return (
    <div>
      <Topbar title="Quản lý gói thuê bao" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-end items-center">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />Tạo gói mới
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Chưa có gói thuê bao nào</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.id} className={!p.isActive ? 'opacity-55' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CardTitle className="text-base truncate">{p.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">{p.planCode}</Badge>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <PriceSummary plan={p} plans={plans} />

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />{p.storageLimit} MB
                    </span>
                    {p.maxMembers != null && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />tối đa {p.maxMembers} thành viên
                      </span>
                    )}
                    {p.stripePriceId && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        <span className="font-mono truncate max-w-[120px]">{p.stripePriceId}</span>
                      </span>
                    )}
                  </div>

                  {p.featureAccess && Object.entries(p.featureAccess).some(([, v]) => v) && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(p.featureAccess).filter(([, v]) => v).map(([k]) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{featureLabel(k)}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t">
                    <Badge variant={p.isActive ? 'default' : 'secondary'} className="text-xs">
                      {p.isActive ? 'Đang hoạt động' : 'Tắt'}
                    </Badge>
                    {p._count != null && (
                      <span className="text-xs text-muted-foreground">{p._count.families} gia đình</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Sửa gói: ${editing.planCode}` : 'Tạo gói mới'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'planCode không thể thay đổi sau khi tạo.'
                : 'planCode là định danh duy nhất — chỉ CHỮ HOA, số và dấu _ (VD: FREE, MONTHLY, YEARLY).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Row 1: planCode + name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Mã gói <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.planCode}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VD: MONTHLY"
                  disabled={!!editing}
                  className={`font-mono ${codeError ? 'border-red-400' : ''}`}
                />
                {codeError && <p className="text-xs text-red-500">{codeError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Tên hiển thị <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Gói tháng"
                />
              </div>
            </div>

            {/* Row 2: price + maxMembers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Giá / năm (VND)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.annualPrice}
                  onChange={(e) => setForm({ ...form, annualPrice: e.target.value })}
                  placeholder="0 = miễn phí"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Số thành viên tối đa
                  {!editing && <span className="text-red-500"> *</span>}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxMembers}
                  onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
                  placeholder={editing ? 'Không đổi' : 'Bắt buộc'}
                  className={!editing && !form.maxMembers ? 'border-amber-400' : ''}
                />
              </div>
            </div>

            {/* Row 3: storageLimit + stripePriceId */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dung lượng (MB)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.storageLimit}
                  onChange={(e) => setForm({ ...form, storageLimit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stripe Price ID</Label>
                <Input
                  value={form.stripePriceId}
                  onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
                  placeholder="price_xxx (gói trả phí)"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* featureAccess checkboxes */}
            <div className="space-y-1.5">
              <Label>Tính năng bật/tắt</Label>
              <p className="text-[11px] text-muted-foreground">
                Key gửi lên BE: <code className="bg-muted px-1 rounded">featureAccess</code> — map key→boolean.
              </p>
              <div className="border rounded-md divide-y">
                {KNOWN_FEATURES.map((f) => (
                  <label key={f.key} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-violet-600 shrink-0"
                      checked={!!form.features[f.key]}
                      onChange={() => toggleFeature(f.key)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">{f.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    </div>
                    <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded shrink-0">{f.key}</code>
                  </label>
                ))}
              </div>
            </div>

            {/* isActive */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-violet-600"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span className="text-sm font-medium">Đang hoạt động</span>
              <span className="text-xs text-muted-foreground">(tắt để ẩn khỏi danh sách gói công khai)</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Huỷ</Button>
            <Button onClick={submit} disabled={isPending || !!codeError}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Cập nhật' : 'Tạo gói'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
