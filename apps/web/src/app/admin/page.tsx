/**
 * Trang tổng quan Admin Dashboard — xem thống kê hệ thống, quản lý gia đình và người dùng.
 * Chỉ dành cho SUPER_ADMIN (đã được bảo vệ bởi AdminLayout).
 */
'use client'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Users, Home, Activity, Crown, Server, Database, Download, HardDrive } from 'lucide-react'
import toast from 'react-hot-toast'

/** Thông tin gói thuê bao rút gọn dùng trong dropdown gán gói cho gia đình */
interface AdminPlan { id: string; code: string; name: string; isActive: boolean }

/** Thông tin sức khỏe hệ thống từ API `/admin/system/health` */
interface SystemHealth {
  status: string
  database: string
  nodeEnv: string
  platform: string
  uptimeSeconds: number
  cpu: { cores: number; loadAverage: number[] }
  memory: { rss: number; heapUsed: number; heapTotal: number; systemFree: number; systemTotal: number }
  uploads: { files: number; bytes: number }
  timestamp: string
}

/**
 * Admin Dashboard — tổng quan hệ thống và công cụ quản lý.
 * Tự động refetch health check mỗi 30 giây để theo dõi trạng thái server.
 */
export default function AdminPage() {
  const qc = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
  })

  const { data: families = [] } = useQuery({
    queryKey: ['admin-families'],
    queryFn: () => api.get('/admin/families').then((r) => r.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const { data: plans = [] } = useQuery<AdminPlan[]>({
    queryKey: ['admin-plans-light'],
    queryFn: () => api.get('/admin/plans?includeInactive=true').then((r) => r.data.plans),
  })

  const { data: health } = useQuery<SystemHealth>({
    queryKey: ['admin-system-health'],
    queryFn: () => api.get('/admin/system/health').then((r) => r.data),
    refetchInterval: 30000,
  })

  const toggleUser = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Cập nhật thành công')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
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

  /**
   * Xuất backup toàn bộ dữ liệu hệ thống dạng JSON.
   * Dùng kỹ thuật tạo thẻ <a> ảo để trigger download file từ Blob response.
   */
  const exportBackup = async () => {
    try {
      const res = await api.get('/admin/backup/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `family-care-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      // Giải phóng bộ nhớ sau khi download
      URL.revokeObjectURL(url)
      toast.success('Đã xuất backup')
    } catch {
      toast.error('Không thể xuất backup')
    }
  }

  /**
   * Chuyển đổi kích thước byte sang đơn vị dễ đọc (B, KB, MB, GB).
   * @param bytes - Số byte cần chuyển đổi
   */
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit += 1
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
  }

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-6 space-y-6">
        {/* Quick links */}
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/plans">
            <Button variant="outline" className="gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Quản lý gói thuê bao
            </Button>
          </Link>
          <Link href="/admin/revenue">
            <Button variant="outline" className="gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              Thống kê doanh thu
            </Button>
          </Link>
          <Button variant="outline" className="gap-2" onClick={exportBackup}>
            <Download className="w-4 h-4 text-blue-600" />
            Xuất backup
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalFamilies ?? 0}</p>
                <p className="text-sm text-muted-foreground">Tổng gia đình</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-sm text-muted-foreground">Tổng người dùng</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeUsers ?? 0}</p>
                <p className="text-sm text-muted-foreground">Đang hoạt động</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Server className="w-8 h-8 text-indigo-600" />
              <div>
                <p className="text-2xl font-bold">{health?.status ?? '...'}</p>
                <p className="text-sm text-muted-foreground">API status</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Database className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{health?.database ?? '...'}</p>
                <p className="text-sm text-muted-foreground">Database</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Activity className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{health ? `${health.cpu.cores} cores` : '...'}</p>
                <p className="text-sm text-muted-foreground">CPU</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-2xl font-bold">{formatBytes(health?.uploads.bytes)}</p>
                <p className="text-sm text-muted-foreground">{health?.uploads.files ?? 0} upload files</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Families table */}
        <Card>
          <CardHeader><CardTitle>Danh sách gia đình</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Tên</th>
                  <th className="text-left py-2">Gói</th>
                  <th className="text-left py-2">Thành viên</th>
                  <th className="text-left py-2">Ngày tạo</th>
                </tr></thead>
                <tbody>
                  {families.map((f: { id: string; name: string; plan: string; planId: string | null; subscriptionPlan?: { id: string; name: string } | null; createdAt: string; _count: { members: number } }) => (
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

        {/* Users table */}
        <Card>
          <CardHeader><CardTitle>Người dùng</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Tên</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Vai trò</th>
                  <th className="text-left py-2">Gia đình</th>
                  <th className="text-left py-2">Trạng thái</th>
                  <th className="text-left py-2">Hành động</th>
                </tr></thead>
                <tbody>
                  {users.map((u: { id: string; displayName: string; email: string; role: string; isActive: boolean; createdAt: string; familyMember?: { family?: { name: string } } | null }) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{u.displayName}</td>
                      <td className="py-2 text-muted-foreground">{u.email}</td>
                      <td className="py-2">
                        <Badge variant={u.role === 'SUPER_ADMIN' ? 'destructive' : u.role === 'PARENT' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{u.familyMember?.family?.name ?? '–'}</td>
                      <td className="py-2">
                        <Badge variant={u.isActive ? 'default' : 'destructive'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {u.role !== 'SUPER_ADMIN' && (
                          <Button size="sm" variant="outline" onClick={() => toggleUser.mutate({ id: u.id, isActive: !u.isActive })}>
                            {u.isActive ? 'Khóa' : 'Mở khóa'}
                          </Button>
                        )}
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
