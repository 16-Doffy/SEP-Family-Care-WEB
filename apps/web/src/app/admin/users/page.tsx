'use client'
/**
 * Trang quản lý người dùng — viết lại theo API team (`GET/PATCH /admin/users`).
 * BE phân trang server-side và lọc theo `userType` (NORMAL_USER/SYSTEM_ADMIN) +
 * `accountStatus` (ACTIVE/INACTIVE/SUSPENDED), không có field `role`/`isActive` cũ.
 */
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import { useAdminUsers, useUpdateAdminUser, type AdminUser } from '@/hooks/useAdmin'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const
const TYPE_FILTERS = ['ALL', 'NORMAL_USER', 'SYSTEM_ADMIN'] as const

const STATUS_BADGE: Record<string, 'default' | 'destructive' | 'secondary'> = {
  ACTIVE: 'default', INACTIVE: 'secondary', SUSPENDED: 'destructive',
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('ALL')

  const { data, isLoading } = useAdminUsers({
    limit: 100,
    search: search.trim() || undefined,
    accountStatus: statusFilter === 'ALL' ? undefined : statusFilter,
    userType: typeFilter === 'ALL' ? undefined : typeFilter,
  })
  const updateUser = useUpdateAdminUser()
  const users = data?.items ?? []

  const toggleStatus = (u: AdminUser) =>
    updateUser.mutate(
      { id: u.id, accountStatus: u.accountStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' },
      {
        onSuccess: () => toast.success('Đã cập nhật trạng thái'),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')),
      },
    )

  return (
    <div>
      <Topbar title="Người dùng" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Tìm theo tên, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'Tất cả trạng thái' : s}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t === 'ALL' ? 'Tất cả loại' : t}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Người dùng ({data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Đang tải...</p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Không có người dùng phù hợp</p>
                  ) : users.map((u) => (
                    <div key={`m-${u.id}`} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant={u.userType === 'SYSTEM_ADMIN' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                          {u.userType}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground truncate">{u.phone ?? '—'}</span>
                        <Badge variant={STATUS_BADGE[u.accountStatus] ?? 'secondary'} className="text-[10px] shrink-0">{u.accountStatus}</Badge>
                      </div>
                      {u.userType !== 'SYSTEM_ADMIN' && (
                        <Button size="sm" variant="outline" className="w-full" disabled={updateUser.isPending} onClick={() => toggleStatus(u)}>
                          {u.accountStatus === 'SUSPENDED' ? 'Mở khóa' : 'Khóa tài khoản'}
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
                      <th className="text-left py-2">Loại</th>
                      <th className="text-left py-2">Trạng thái</th>
                      <th className="text-left py-2">Hành động</th>
                    </tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{u.fullName}</td>
                          <td className="py-2 text-muted-foreground">{u.email}</td>
                          <td className="py-2">
                            <Badge variant={u.userType === 'SYSTEM_ADMIN' ? 'destructive' : 'secondary'}>{u.userType}</Badge>
                          </td>
                          <td className="py-2">
                            <Badge variant={STATUS_BADGE[u.accountStatus] ?? 'secondary'}>{u.accountStatus}</Badge>
                          </td>
                          <td className="py-2">
                            {u.userType !== 'SYSTEM_ADMIN' && (
                              <Button size="sm" variant="outline" disabled={updateUser.isPending} onClick={() => toggleStatus(u)}>
                                {u.accountStatus === 'SUSPENDED' ? 'Mở khóa' : 'Khóa'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
