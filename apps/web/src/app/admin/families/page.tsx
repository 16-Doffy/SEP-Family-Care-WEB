'use client'
/**
 * Trang quản lý gia đình - tách từ /admin để mỗi tab có nội dung gọn.
 * Gộp 2 section: Danh sách gia đình (đổi gói) + Vận hành (status, hạn, owner, provision, backup, renew).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AdminPlan { id: string; code: string; name: string; isActive: boolean }

interface AdminFamily {
  id: string
  name: string
  plan: string
  planId: string | null
  status: string
  subscriptionStatus: string
  subscriptionExpiresAt: string | null
  subscriptionPlan?: { id: string; name: string } | null
  provision?: { status: string; containerName?: string | null } | null
  createdAt: string
  _count: { members: number }
  members: Array<{
    id: string
    isOwner: boolean
    userId: string
    user: { id: string; displayName: string; email: string; role: string; isActive: boolean }
  }>
}

export default function AdminFamiliesPage() {
  const qc = useQueryClient()

  const { data: families = [] } = useQuery<AdminFamily[]>({
    queryKey: ['admin-families'],
    queryFn: () => api.get('/admin/families').then((r) => r.data),
  })

  const { data: plans = [] } = useQuery<AdminPlan[]>({
    queryKey: ['admin-plans-light'],
    queryFn: () => api.get('/admin/plans?includeInactive=true').then((r) => r.data.plans),
  })

  const assignPlan = useMutation({
    mutationFn: ({ familyId, planId }: { familyId: string; planId: string | null }) =>
      api.put(`/admin/families/${familyId}/plan`, { planId }),
    onSuccess: () => {
      toast.success('Đã đổi gói')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
    onError: () => toast.error('Không thể đổi gói'),
  })

  const updateFamilyStatus = useMutation({
    mutationFn: ({ familyId, status }: { familyId: string; status: string }) =>
      api.patch(`/admin/families/${familyId}/status`, { status }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái gia đình')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
  })

  const updateSubscription = useMutation({
    mutationFn: ({ familyId, subscriptionExpiresAt }: { familyId: string; subscriptionExpiresAt: string | null }) =>
      api.patch(`/admin/families/${familyId}/subscription`, { subscriptionExpiresAt }),
    onSuccess: () => {
      toast.success('Đã cập nhật hạn đăng ký')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
  })

  const updateOwner = useMutation({
    mutationFn: ({ familyId, userId }: { familyId: string; userId: string }) =>
      api.put(`/admin/families/${familyId}/owner`, { userId }),
    onSuccess: () => {
      toast.success('Đã đổi chủ hộ')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
  })

  const provisionFamily = useMutation({
    mutationFn: (familyId: string) => api.post(`/admin/families/${familyId}/provision`),
    onSuccess: () => {
      toast.success('Đã provision family')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
  })

  const renewSubscription = useMutation({
    mutationFn: ({ familyId, months }: { familyId: string; months: number }) =>
      api.post(`/admin/families/${familyId}/renew`, { months }),
    onSuccess: (_, vars) => {
      toast.success(`Đã gia hạn ${vars.months / 12} năm`)
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    },
    onError: () => toast.error('Gia hạn thất bại'),
  })

  const exportFamilyBackup = async (familyId: string) => {
    try {
      const res = await api.get(`/admin/families/${familyId}/backup`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `family-${familyId}-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất backup family')
    } catch {
      toast.error('Không thể xuất backup family')
    }
  }

  const restoreFamilyBackup = async (familyId: string, file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      await api.post(`/admin/families/${familyId}/restore`, JSON.parse(text))
      toast.success('Đã khôi phục dữ liệu family')
      qc.invalidateQueries({ queryKey: ['admin-families'] })
    } catch {
      toast.error('Không thể khôi phục backup')
    }
  }

  return (
    <div>
      <Topbar title="Gia đình" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Danh sách gia đình ({families.length})</CardTitle></CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {families.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa có gia đình nào</p>
              ) : families.map((f) => (
                <div key={`m-${f.id}`} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{f.name}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(f.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{f._count.members} thành viên</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Gói thuê bao</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-white mt-0.5"
                      value={f.planId ?? ''}
                      onChange={(e) => assignPlan.mutate({ familyId: f.id, planId: e.target.value || null })}
                    >
                      <option value="">— (Legacy: {f.plan}) —</option>
                      {plans.filter((p) => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Tên</th>
                  <th className="text-left py-2">Gói</th>
                  <th className="text-left py-2">Thành viên</th>
                  <th className="text-left py-2">Ngày tạo</th>
                </tr></thead>
                <tbody>
                  {families.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{f.name}</td>
                      <td className="py-2">
                        <select
                          className="text-sm border rounded px-2 py-1 bg-white"
                          value={f.planId ?? ''}
                          onChange={(e) => assignPlan.mutate({ familyId: f.id, planId: e.target.value || null })}
                        >
                          <option value="">— (Legacy: {f.plan}) —</option>
                          {plans.filter((p) => p.isActive).map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">{f._count.members}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(f.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Vận hành gia đình</CardTitle></CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {families.map((f) => (
                <div key={`m-ops-${f.id}`} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{f.name}</p>
                    <Badge variant={f.provision?.status === 'READY' ? 'default' : 'secondary'} className="text-[10px]">
                      {f.provision?.status ?? 'PENDING'}
                    </Badge>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Family Manager</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-white mt-0.5"
                      value={f.members.find((m) => m.isOwner)?.userId ?? f.members[0]?.userId ?? ''}
                      onChange={(e) => updateOwner.mutate({ familyId: f.id, userId: e.target.value })}
                    >
                      {f.members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Trạng thái</label>
                      <select
                        className="w-full text-sm border rounded px-2 py-1.5 bg-white mt-0.5"
                        value={f.status ?? 'ACTIVE'}
                        onChange={(e) => updateFamilyStatus.mutate({ familyId: f.id, status: e.target.value })}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="LOCKED">LOCKED</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{f.subscriptionStatus}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Hết hạn</label>
                      <Input
                        type="date"
                        className="h-9 mt-0.5"
                        defaultValue={f.subscriptionExpiresAt ? f.subscriptionExpiresAt.slice(0, 10) : ''}
                        onBlur={(e) => updateSubscription.mutate({ familyId: f.id, subscriptionExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Gia hạn annual plan</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-white mt-0.5"
                      value=""
                      onChange={(e) => {
                        const months = Number(e.target.value)
                        if (months > 0) renewSubscription.mutate({ familyId: f.id, months })
                        e.target.value = ''
                      }}
                    >
                      <option value="">— Chọn số năm để gia hạn —</option>
                      <option value="12">+ 1 năm</option>
                      <option value="24">+ 2 năm</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => provisionFamily.mutate(f.id)}>Provision</Button>
                    <Button size="sm" variant="outline" onClick={() => exportFamilyBackup(f.id)}>Backup</Button>
                    <label className="h-9 rounded-md border px-2 py-2 text-xs cursor-pointer flex items-center justify-center hover:bg-gray-50">
                      Restore
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => restoreFamilyBackup(f.id, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Gia đình</th>
                  <th className="text-left py-2">Family Manager</th>
                  <th className="text-left py-2">Trạng thái</th>
                  <th className="text-left py-2">Hết hạn</th>
                  <th className="text-left py-2">Gia hạn</th>
                  <th className="text-left py-2">Provision</th>
                  <th className="text-left py-2">Backup</th>
                </tr></thead>
                <tbody>
                  {families.map((f) => (
                    <tr key={`ops-${f.id}`} className="border-b last:border-0">
                      <td className="py-2 font-medium">{f.name}</td>
                      <td className="py-2">
                        <select
                          className="text-sm border rounded px-2 py-1 bg-white max-w-44"
                          value={f.members.find((m) => m.isOwner)?.userId ?? f.members[0]?.userId ?? ''}
                          onChange={(e) => updateOwner.mutate({ familyId: f.id, userId: e.target.value })}
                        >
                          {f.members.map((m) => (
                            <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          className="text-sm border rounded px-2 py-1 bg-white"
                          value={f.status ?? 'ACTIVE'}
                          onChange={(e) => updateFamilyStatus.mutate({ familyId: f.id, status: e.target.value })}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="LOCKED">LOCKED</option>
                        </select>
                        <div className="text-xs text-muted-foreground">{f.subscriptionStatus}</div>
                      </td>
                      <td className="py-2">
                        <Input
                          type="date"
                          className="h-8 w-36"
                          defaultValue={f.subscriptionExpiresAt ? f.subscriptionExpiresAt.slice(0, 10) : ''}
                          onBlur={(e) => updateSubscription.mutate({ familyId: f.id, subscriptionExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        />
                      </td>
                      <td className="py-2">
                        <select
                          className="text-sm border rounded px-2 py-1 bg-white"
                          value=""
                          onChange={(e) => {
                            const months = Number(e.target.value)
                            if (months > 0) renewSubscription.mutate({ familyId: f.id, months })
                            e.target.value = ''
                          }}
                        >
                          <option value="">+ năm</option>
                          <option value="12">+ 1</option>
                          <option value="24">+ 2</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <Badge variant={f.provision?.status === 'READY' ? 'default' : 'secondary'}>
                          {f.provision?.status ?? 'PENDING'}
                        </Badge>
                        <Button size="sm" variant="outline" className="ml-2" onClick={() => provisionFamily.mutate(f.id)}>
                          Provision
                        </Button>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => exportFamilyBackup(f.id)}>Backup</Button>
                          <label className="h-9 rounded-md border px-3 py-2 text-xs cursor-pointer">
                            Restore
                            <input
                              type="file"
                              accept="application/json"
                              className="hidden"
                              onChange={(e) => restoreFamilyBackup(f.id, e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
