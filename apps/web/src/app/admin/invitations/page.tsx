'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Loader2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api'
import { useAdminInvitations, useUpdateAdminInvitation, useDeleteAdminInvitation } from '@/hooks/useAdmin'

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED', 'CLAIMED', 'APPROVED'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  ACCEPTED: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'destructive',
  CANCELED: 'destructive',
  CLAIMED: 'secondary',
}

const EDITABLE_STATUSES = ['PENDING', 'CLAIMED', 'APPROVED', 'REJECTED', 'ACCEPTED', 'EXPIRED', 'CANCELED'] as const

export default function AdminInvitationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const { data, isLoading } = useAdminInvitations({
    limit: 200,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  })
  const updateInvitation = useUpdateAdminInvitation()
  const deleteInvitation = useDeleteAdminInvitation()

  const invitations = data?.items ?? []

  const handleStatusChange = (id: string, status: string) => {
    updateInvitation.mutate(
      { id, status: status as typeof EDITABLE_STATUSES[number] },
      {
        onSuccess: () => toast.success('Đã cập nhật trạng thái'),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')),
      },
    )
  }

  const handleDelete = (id: string, email?: string | null) => {
    if (!confirm(`Xoá lời mời${email ? ` đến ${email}` : ''}?`)) return
    deleteInvitation.mutate(id, {
      onSuccess: () => toast.success('Đã xoá lời mời'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể xoá')),
    })
  }

  return (
    <div>
      <Topbar title="Lời mời" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'Tất cả' : s}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Mail className="w-4 h-4 inline mr-1.5 text-green-600" />
              Lời mời ({data?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có lời mời phù hợp</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden divide-y">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.email ?? '(không có email)'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">Family: {inv.familyId}</p>
                          {inv.createdAt && <p className="text-[11px] text-muted-foreground">{formatDate(inv.createdAt)}</p>}
                        </div>
                        <Badge variant={STATUS_BADGE[inv.status] ?? 'secondary'} className="text-[10px] shrink-0">
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={inv.status}
                          onValueChange={(v) => handleStatusChange(inv.id, v)}
                          disabled={updateInvitation.isPending}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EDITABLE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600"
                          disabled={deleteInvitation.isPending}
                          onClick={() => handleDelete(inv.id, inv.email)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2.5 pl-4">Email</th>
                        <th className="text-left py-2.5">Family ID</th>
                        <th className="text-left py-2.5">Ngày tạo</th>
                        <th className="text-left py-2.5">Trạng thái</th>
                        <th className="text-left py-2.5 pr-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pl-4 font-medium">{inv.email ?? <span className="text-muted-foreground italic text-xs">—</span>}</td>
                          <td className="py-2.5 text-xs text-muted-foreground font-mono max-w-[180px] truncate">{inv.familyId}</td>
                          <td className="py-2.5 text-muted-foreground text-xs">{inv.createdAt ? formatDate(inv.createdAt) : '—'}</td>
                          <td className="py-2.5">
                            <Badge variant={STATUS_BADGE[inv.status] ?? 'secondary'} className="text-[10px]">{inv.status}</Badge>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <Select
                                value={inv.status}
                                onValueChange={(v) => handleStatusChange(inv.id, v)}
                                disabled={updateInvitation.isPending}
                              >
                                <SelectTrigger className="h-7 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EDITABLE_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                disabled={deleteInvitation.isPending}
                                onClick={() => handleDelete(inv.id, inv.email)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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
