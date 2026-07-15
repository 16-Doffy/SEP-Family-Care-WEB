'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Loader2, Mail, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api'
import { useAdminJoinRequests, useDeleteAdminJoinRequest } from '@/hooks/useAdmin'

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELED'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELED: 'destructive',
}

export default function AdminInvitationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const { data, isLoading } = useAdminJoinRequests({
    limit: 100,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  })
  const deleteJoinRequest = useDeleteAdminJoinRequest()

  const requests = data?.items ?? []

  const handleDelete = (id: string, name?: string | null) => {
    if (!confirm(`Xoá yêu cầu gia nhập${name ? ` của ${name}` : ''}?`)) return
    deleteJoinRequest.mutate(id, {
      onSuccess: () => toast.success('Đã xoá yêu cầu gia nhập'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể xoá')),
    })
  }

  return (
    <div>
      <Topbar title="Yêu cầu gia nhập" backHref="/admin" />
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
              Yêu cầu gia nhập ({data?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có yêu cầu phù hợp</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden divide-y">
                  {requests.map((req) => (
                    <div key={req.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{req.user?.fullName ?? 'Ẩn danh'}</p>
                          <p className="text-xs text-muted-foreground truncate">{req.user?.email ?? '(Không có email)'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">Gia đình ID: {req.familyId}</p>
                          {req.message && (
                            <p className="text-xs text-muted-foreground bg-gray-50 p-1.5 rounded border flex items-start gap-1 mt-1">
                              <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{req.message}</span>
                            </p>
                          )}
                          {req.createdAt && <p className="text-[11px] text-muted-foreground mt-1">{formatDate(req.createdAt)}</p>}
                        </div>
                        <Badge variant={STATUS_BADGE[req.status] ?? 'secondary'} className="text-[10px] shrink-0">
                          {req.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-500 hover:text-red-600 gap-1"
                          disabled={deleteJoinRequest.isPending}
                          onClick={() => handleDelete(req.id, req.user?.fullName)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xoá yêu cầu</span>
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
                        <th className="text-left py-2.5 pl-4">Người gửi</th>
                        <th className="text-left py-2.5">Gia đình ID</th>
                        <th className="text-left py-2.5">Lời nhắn</th>
                        <th className="text-left py-2.5">Ngày tạo</th>
                        <th className="text-left py-2.5">Trạng thái</th>
                        <th className="text-left py-2.5 pr-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((req) => (
                        <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pl-4 font-medium">
                            <div>
                              <p>{req.user?.fullName ?? 'Ẩn danh'}</p>
                              <p className="text-xs text-muted-foreground font-normal">{req.user?.email ?? ''}</p>
                            </div>
                          </td>
                          <td className="py-2.5 text-xs text-muted-foreground font-mono max-w-[180px] truncate">{req.familyId}</td>
                          <td className="py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                            {req.message ? (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{req.message}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Không có</span>
                            )}
                          </td>
                          <td className="py-2.5 text-muted-foreground text-xs">{req.createdAt ? formatDate(req.createdAt) : '—'}</td>
                          <td className="py-2.5">
                            <Badge variant={STATUS_BADGE[req.status] ?? 'secondary'} className="text-[10px]">{req.status}</Badge>
                          </td>
                          <td className="py-2.5 pr-4">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              disabled={deleteJoinRequest.isPending}
                              onClick={() => handleDelete(req.id, req.user?.fullName)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
