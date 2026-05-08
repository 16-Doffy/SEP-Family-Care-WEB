'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Users, Home, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

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

  const toggleUser = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Cập nhật thành công')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-6 space-y-6">
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
                  {families.map((f: { id: string; name: string; plan: string; createdAt: string; _count: { members: number } }) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{f.name}</td>
                      <td className="py-2"><Badge variant="outline">{f.plan}</Badge></td>
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
