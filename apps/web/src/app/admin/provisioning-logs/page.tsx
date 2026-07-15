'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GitBranch, Loader2 } from 'lucide-react'
import { useAdminProvisioningLogs } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'

const RESULT_CLS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
}

const ACTION_TYPES = ['ALL', 'CREATE', 'ACTIVATE', 'RETRY', 'SUSPEND']
const STATUSES = ['ALL', 'SUCCESS', 'FAILED', 'PENDING']

export default function ProvisioningLogsPage() {
  const [familyId, setFamilyId] = useState('')
  const [status, setStatus] = useState('ALL')
  const [actionType, setActionType] = useState('ALL')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminProvisioningLogs({
    page,
    limit: 30,
    familyId: familyId.trim() || undefined,
    status: status === 'ALL' ? undefined : status,
    actionType: actionType === 'ALL' ? undefined : actionType,
  })

  const logs = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div>
      <Topbar title="Provisioning Logs" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-8 text-xs w-52"
            placeholder="Family ID..."
            value={familyId}
            onChange={(e) => { setFamilyId(e.target.value); setPage(1) }}
          />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s === 'ALL' ? 'Tất cả kết quả' : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1) }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Action type" /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => <SelectItem key={a} value={a} className="text-xs">{a === 'ALL' ? 'Tất cả action' : a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <GitBranch className="w-4 h-4" />
              Provisioning Logs ({data?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có log nào</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_CLS[log.result ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.result ?? '—'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{log.createdAt ? formatDate(log.createdAt) : '—'}</span>
                      </div>
                      {log.familyId && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate">Family: {log.familyId}</p>
                      )}
                      {log.message && <p className="text-xs text-muted-foreground">{log.message}</p>}
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2.5 pl-4">Kết quả</th>
                        <th className="text-left py-2.5">Family ID</th>
                        <th className="text-left py-2.5">Message</th>
                        <th className="text-left py-2.5 pr-4">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 pl-4">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_CLS[log.result ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                              {log.result ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 font-mono text-[10px] text-muted-foreground max-w-[160px] truncate">{log.familyId ?? '—'}</td>
                          <td className="py-2 text-xs text-muted-foreground max-w-[280px] truncate">{log.message ?? '—'}</td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{log.createdAt ? formatDate(log.createdAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t">
                    <button
                      className="text-xs px-2.5 py-1 rounded border hover:bg-muted/50 disabled:opacity-40"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      ← Trước
                    </button>
                    <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                    <button
                      className="text-xs px-2.5 py-1 rounded border hover:bg-muted/50 disabled:opacity-40"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
