'use client'
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Users, Crown, RefreshCw, RotateCcw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import {
  useAdminFamilies, useUpdateAdminFamily, useAdminFamily, useUpdateAdminFamilyMember,
  useAdminFamilySubscription, useAdminFamilyActivationStatus, useAdminFamilyProvisioningLogs,
  useManualRenewFamilySubscription, useUpdateFamilySubscriptionStatus,
  useSyncStripeFamilySubscription, useRetryFamilyProvisioning,
  type AdminFamily,
} from '@/hooks/useAdmin'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED'] as const
const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default', PENDING: 'secondary', SUSPENDED: 'destructive', EXPIRED: 'destructive',
}
const PROVISION_RESULT_CLS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
}

export default function AdminFamiliesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
  const { data, isLoading } = useAdminFamilies({
    limit: 100,
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  })
  const families = data?.items ?? []

  const [editing, setEditing] = useState<AdminFamily | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subscriptionFamilyId, setSubscriptionFamilyId] = useState<string | null>(null)
  const subscriptionFamily = families.find((f) => f.id === subscriptionFamilyId) ?? null

  return (
    <div>
      <Topbar title="Gia đình" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Tìm theo tên gia đình..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'Tất cả' : s}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Danh sách gia đình ({data?.total ?? 0})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Đang tải...</p>
            ) : families.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Không có gia đình phù hợp</p>
            ) : (
              <div className="space-y-2">
                {families.map((f) => (
                  <div key={f.id} className="border rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />{f._count?.members ?? 0} thành viên
                          {f.createdAt && ` · ${formatDate(f.createdAt)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Badge variant={STATUS_BADGE[f.status] ?? 'secondary'} className="text-[10px]">{f.status}</Badge>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(f)}>Sửa</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSubscriptionFamilyId(f.id)}>
                          <Crown className="w-3 h-3" />Gói
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                          {expandedId === f.id ? 'Ẩn TV' : 'Thành viên'}
                        </Button>
                      </div>
                    </div>
                    {expandedId === f.id && <FamilyMembersPanel familyId={f.id} />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditFamilyDialog family={editing} onClose={() => setEditing(null)} />
      <FamilySubscriptionDialog
        familyId={subscriptionFamilyId}
        familyName={subscriptionFamily?.name}
        onClose={() => setSubscriptionFamilyId(null)}
      />
    </div>
  )
}

// ─── Members Panel ────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['FAMILY_MANAGER', 'DEPUTY_MEMBER', 'FAMILY_MEMBER'] as const
const MEMBER_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'REMOVED'] as const

function FamilyMembersPanel({ familyId }: { familyId: string }) {
  const { data: family, isLoading } = useAdminFamily(familyId)
  const updateMember = useUpdateAdminFamilyMember()
  const members = family?.members ?? []

  if (isLoading) return <div className="p-4 border-t text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
  if (members.length === 0) return <p className="p-4 border-t text-sm text-muted-foreground">Chưa có thành viên nào.</p>

  return (
    <div className="border-t p-3 space-y-2 bg-gray-50">
      {members.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-2 bg-white rounded-md border px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.displayName || m.user?.fullName || 'Thành viên'}</p>
            <p className="text-xs text-muted-foreground truncate">{m.user?.email}</p>
          </div>
          <Select
            value={m.familyRole}
            onValueChange={(v) => updateMember.mutate(
              { id: m.id, familyRole: v as typeof ROLE_OPTIONS[number] },
              { onSuccess: () => toast.success('Đã đổi vai trò'), onError: (e) => toast.error(getApiErrorMessage(e, 'Lỗi')) },
            )}
          >
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select
            value={m.status}
            onValueChange={(v) => updateMember.mutate(
              { id: m.id, status: v as typeof MEMBER_STATUS_OPTIONS[number] },
              { onSuccess: () => toast.success('Đã đổi trạng thái'), onError: (e) => toast.error(getApiErrorMessage(e, 'Lỗi')) },
            )}
          >
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMBER_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

// ─── Subscription Dialog ──────────────────────────────────────────────────────

function FamilySubscriptionDialog({
  familyId, familyName, onClose,
}: { familyId: string | null; familyName?: string; onClose: () => void }) {
  const [tab, setTab] = useState<'subscription' | 'activation' | 'provisioning'>('subscription')

  const { data: sub, isLoading: subLoading, isError: subError } = useAdminFamilySubscription(familyId)
  const { data: activation, isLoading: actLoading, isError: actError } = useAdminFamilyActivationStatus(familyId)
  const { data: provLogs, isLoading: provLoading, isError: provError } = useAdminFamilyProvisioningLogs(familyId)

  const manualRenew = useManualRenewFamilySubscription()
  const updateStatus = useUpdateFamilySubscriptionStatus()
  const syncStripe = useSyncStripeFamilySubscription()
  const retryProvision = useRetryFamilyProvisioning()

  const [renewForm, setRenewForm] = useState({ planCode: '', monthsToAdd: '1', reason: '' })
  const [newSubStatus, setNewSubStatus] = useState<'ACTIVE' | 'PAST_DUE' | 'CANCELED'>('ACTIVE')
  const [statusReason, setStatusReason] = useState('')

  useEffect(() => {
    if (sub?.planCode) setRenewForm((f) => ({ ...f, planCode: sub.planCode ?? '' }))
  }, [sub])

  if (!familyId) return null

  const handleRenew = () => {
    if (!renewForm.planCode || !renewForm.monthsToAdd) { toast.error('Nhập đầy đủ planCode và số tháng'); return }
    manualRenew.mutate(
      { familyId, planCode: renewForm.planCode, monthsToAdd: Number(renewForm.monthsToAdd), reason: renewForm.reason || undefined },
      { onSuccess: () => toast.success('Đã gia hạn'), onError: (e) => toast.error(getApiErrorMessage(e, 'Gia hạn thất bại')) },
    )
  }

  const handleUpdateStatus = () => {
    updateStatus.mutate(
      { familyId, status: newSubStatus, reason: statusReason || undefined },
      { onSuccess: () => { toast.success('Đã cập nhật trạng thái'); setStatusReason('') }, onError: (e) => toast.error(getApiErrorMessage(e, 'Thất bại')) },
    )
  }

  const handleSyncStripe = () => {
    syncStripe.mutate(familyId, {
      onSuccess: () => toast.success('Đã sync Stripe'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Sync thất bại')),
    })
  }

  const handleRetry = () => {
    retryProvision.mutate(
      { familyId },
      { onSuccess: () => toast.success('Đã retry provisioning'), onError: (e) => toast.error(getApiErrorMessage(e, 'Retry thất bại')) },
    )
  }

  return (
    <Dialog open={!!familyId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            Quản lý gói — {familyName}
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px]">{familyId}</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b pb-0 -mb-1">
          {(['subscription', 'activation', 'provisioning'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
                tab === t ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'subscription' ? 'Gói thuê bao' : t === 'activation' ? 'Kích hoạt' : 'Provisioning Logs'}
            </button>
          ))}
        </div>

        {/* Tab: Subscription */}
        {tab === 'subscription' && (
          <div className="space-y-4 pt-2">
            {subLoading ? <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div> : subError ? (
              <AdminApiError label="Không tải được subscription. Kiểm tra quyền SYSTEM_ADMIN hoặc API family subscription." />
            ) : (
              <>
                {/* Current info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="Plan Code" value={sub?.planCode} />
                  <InfoRow label="Trạng thái" value={sub?.status} />
                  <InfoRow label="Bắt đầu kỳ" value={sub?.currentPeriodStart ? formatDate(sub.currentPeriodStart) : undefined} />
                  <InfoRow label="Kết thúc kỳ" value={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : undefined} />
                </div>

                <div className="border-t pt-3 space-y-3">
                  {/* Update status */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Đổi trạng thái subscription</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <Select value={newSubStatus} onValueChange={(v) => setNewSubStatus(v as typeof newSubStatus)}>
                        <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['ACTIVE', 'PAST_DUE', 'CANCELED'] as const).map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs flex-1 min-w-32"
                        placeholder="Lý do (tuỳ chọn)"
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={handleUpdateStatus} disabled={updateStatus.isPending}>
                        {updateStatus.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Cập nhật
                      </Button>
                    </div>
                  </div>

                  {/* Manual renew */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Gia hạn thủ công</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <Input
                        className="h-8 text-xs w-28"
                        placeholder="Plan Code *"
                        value={renewForm.planCode}
                        onChange={(e) => setRenewForm({ ...renewForm, planCode: e.target.value.toUpperCase() })}
                      />
                      <Input
                        type="number" min="1" max="24"
                        className="h-8 text-xs w-20"
                        placeholder="Tháng *"
                        value={renewForm.monthsToAdd}
                        onChange={(e) => setRenewForm({ ...renewForm, monthsToAdd: e.target.value })}
                      />
                      <Input
                        className="h-8 text-xs flex-1 min-w-28"
                        placeholder="Lý do (tuỳ chọn)"
                        value={renewForm.reason}
                        onChange={(e) => setRenewForm({ ...renewForm, reason: e.target.value })}
                      />
                      <Button size="sm" className="h-8 text-xs gap-1" variant="outline" onClick={handleRenew} disabled={manualRenew.isPending}>
                        {manualRenew.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Gia hạn
                      </Button>
                    </div>
                  </div>

                  {/* Sync stripe */}
                  <div className="flex items-center justify-between border-t pt-3">
                    <div>
                      <p className="text-xs font-semibold">Sync Stripe</p>
                      <p className="text-[10px] text-muted-foreground">Đồng bộ lại trạng thái subscription từ Stripe</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleSyncStripe} disabled={syncStripe.isPending}>
                      {syncStripe.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Sync
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Activation */}
        {tab === 'activation' && (
          <div className="space-y-4 pt-2">
            {actLoading ? <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div> : actError ? (
              <AdminApiError label="Workspace chưa được kích hoạt hoặc API activation-status không trả dữ liệu." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="Trạng thái kích hoạt" value={activation?.status} />
                  <InfoRow label="Provisioned lúc" value={activation?.provisionedAt ? formatDate(activation.provisionedAt) : undefined} />
                  {activation?.workspaceUrl && <InfoRow label="Workspace URL" value={activation.workspaceUrl} />}
                </div>

                {activation?.lastProvisioningLog && (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Log provisioning gần nhất</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PROVISION_RESULT_CLS[activation.lastProvisioningLog.result ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {activation.lastProvisioningLog.result}
                      </span>
                      <span className="text-xs text-muted-foreground">{activation.lastProvisioningLog.createdAt ? formatDate(activation.lastProvisioningLog.createdAt) : ''}</span>
                    </div>
                    {activation.lastProvisioningLog.message && (
                      <p className="text-xs text-muted-foreground">{activation.lastProvisioningLog.message}</p>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">Retry Provisioning</p>
                    <p className="text-[10px] text-muted-foreground">Chạy lại quá trình kích hoạt workspace</p>
                  </div>
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs gap-1"
                    onClick={handleRetry}
                    disabled={retryProvision.isPending}
                  >
                    {retryProvision.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Retry
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Provisioning Logs */}
        {tab === 'provisioning' && (
          <div className="pt-2">
            {provLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : provError ? (
              <AdminApiError label="Không tải được Provisioning Logs." />
            ) : (provLogs?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có log nào</p>
            ) : (
              <div className="space-y-2">
                {(provLogs?.items ?? []).map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PROVISION_RESULT_CLS[log.result ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.result ?? '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{log.createdAt ? formatDate(log.createdAt) : '—'}</span>
                    </div>
                    {log.message && <p className="text-xs text-muted-foreground">{log.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdminApiError({ label }: { label: string }) {
  return <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{label}</div>
}

// ─── Edit Family Dialog ───────────────────────────────────────────────────────

function EditFamilyDialog({ family, onClose }: { family: AdminFamily | null; onClose: () => void }) {
  const updateFamily = useUpdateAdminFamily()
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' as AdminFamily['status'], activationStatus: 'ACTIVE' as NonNullable<AdminFamily['activationStatus']> })

  useEffect(() => {
    if (family) {
      setForm({ name: family.name, description: family.description ?? '', status: family.status, activationStatus: family.activationStatus ?? 'ACTIVE' })
    }
  }, [family])

  const submit = () => {
    if (!family) return
    updateFamily.mutate(
      { id: family.id, name: form.name, description: form.description || undefined, status: form.status, activationStatus: form.activationStatus },
      {
        onSuccess: () => { toast.success('Đã cập nhật gia đình'); handleClose() },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')),
      },
    )
  }

  const handleClose = () => {
    setForm({ name: '', description: '', status: 'ACTIVE', activationStatus: 'ACTIVE' })
    onClose()
  }

  return (
    <Dialog open={!!family} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa gia đình</DialogTitle>
          <DialogDescription>Cập nhật thông tin và trạng thái gia đình.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Tên gia đình</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AdminFamily['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ACTIVE','PENDING','SUSPENDED','EXPIRED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kích hoạt</Label>
              <Select value={form.activationStatus} onValueChange={(v) => setForm({ ...form, activationStatus: v as NonNullable<AdminFamily['activationStatus']> })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ACTIVE','PENDING','FAILED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={submit} disabled={updateFamily.isPending || !form.name}>
            {updateFamily.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium">{value ?? <span className="text-muted-foreground font-normal">—</span>}</p>
    </div>
  )
}
