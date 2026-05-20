'use client'
/**
 * Trang quản lý người dùng - tách từ /admin để có tab riêng.
 * Hiển thị danh sách user kèm role, gia đình, trạng thái; cho phép khóa/mở user.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdminUser {
  id: string
  displayName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  familyMember?: { family?: { name: string } } | null
}

const ROLES = ['ALL', 'SUPER_ADMIN', 'PARENT', 'FAMILY_MEMBER'] as const

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<(typeof ROLES)[number]>('ALL')

  const { data: users = [] } = useQuery<AdminUser[]>({
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (!q) return true
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.familyMember?.family?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter])

  return (
    <div>
      <Topbar title="Người dùng" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, email, gia đình..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                roleFilter === r
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r === 'ALL' ? 'Tất cả' : r}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Người dùng ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Không có người dùng phù hợp</p>
              ) : filtered.map((u) => (
                <div key={`m-${u.id}`} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge
                      variant={u.role === 'SUPER_ADMIN' ? 'destructive' : u.role === 'PARENT' ? 'default' : 'secondary'}
                      className="text-[10px] shrink-0"
                    >
                      {u.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate">
                      Gia đình: {u.familyMember?.family?.name ?? '–'}
                    </span>
                    <Badge variant={u.isActive ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {u.role !== 'SUPER_ADMIN' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => toggleUser.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
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
                  {filtered.map((u) => (
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
