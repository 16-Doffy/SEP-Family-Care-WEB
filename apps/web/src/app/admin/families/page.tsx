'use client'
/**
 * Trang quản lý gia đình — viết lại theo API team thật.
 * BE hiện chỉ hỗ trợ: liệt kê/tìm/lọc theo status, xem chi tiết (kèm members),
 * sửa thông tin family (`PATCH /admin/families/:id`), và sửa role/status của
 * từng member (`PATCH /admin/family-members/:id`).
 *
 * Các tính năng "đổi gói", "đổi chủ hộ", "gia hạn", "provision", "backup/restore"
 * của bản cũ KHÔNG tồn tại trong Swagger hiện tại nên đã được bỏ — gọi sẽ chỉ ra 404.
 */
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import {
  useAdminFamilies, useUpdateAdminFamily, useAdminFamily, useUpdateAdminFamilyMember,
  type AdminFamily,
} from '@/hooks/useAdmin'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED'] as const
const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default', PENDING: 'secondary', SUSPENDED: 'destructive', EXPIRED: 'destructive',
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
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={STATUS_BADGE[f.status] ?? 'secondary'}>{f.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => setEditing(f)}>Sửa</Button>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                          {expandedId === f.id ? 'Ẩn thành viên' : 'Thành viên'}
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
    </div>
  )
}

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
              { onSuccess: () => toast.success('Đã đổi vai trò'), onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')) },
            )}
          >
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select
            value={m.status}
            onValueChange={(v) => updateMember.mutate(
              { id: m.id, status: v as typeof MEMBER_STATUS_OPTIONS[number] },
              { onSuccess: () => toast.success('Đã đổi trạng thái'), onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')) },
            )}
          >
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMBER_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

function EditFamilyDialog({ family, onClose }: { family: AdminFamily | null; onClose: () => void }) {
  const updateFamily = useUpdateAdminFamily()
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' as AdminFamily['status'], activationStatus: 'ACTIVE' as NonNullable<AdminFamily['activationStatus']> })

  useEffect(() => {
    if (family) {
      setForm({
        name: family.name,
        description: family.description ?? '',
        status: family.status,
        activationStatus: family.activationStatus ?? 'ACTIVE',
      })
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
          <DialogDescription>Cập nhật thông tin và trạng thái hoạt động của gia đình.</DialogDescription>
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
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kích hoạt</Label>
              <Select value={form.activationStatus} onValueChange={(v) => setForm({ ...form, activationStatus: v as NonNullable<AdminFamily['activationStatus']> })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="FAILED">FAILED</SelectItem>
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
