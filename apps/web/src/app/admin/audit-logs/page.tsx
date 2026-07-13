'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ClipboardList, Loader2 } from 'lucide-react'
import { useAdminAuditLogs, AuditLogAction, AuditLogTargetType } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'

const ACTIONS: Array<AuditLogAction | 'ALL'> = [
  'ALL',
  'ADMIN_USER_LOCK', 'ADMIN_USER_UNLOCK',
  'ADMIN_SUBSCRIPTION_MANUAL_RENEW', 'ADMIN_SUBSCRIPTION_STATUS_UPDATE', 'ADMIN_SUBSCRIPTION_STRIPE_SYNC',
  'ADMIN_PROVISIONING_RETRY',
  'ADMIN_CONTAINER_STATS_VIEW', 'ADMIN_CONTAINER_LOGS_VIEW',
  'ADMIN_BACKUP_CREATE', 'ADMIN_RESTORE_REQUEST_CREATE', 'ADMIN_RESTORE_CONFIRM',
]

const TARGET_TYPES: Array<AuditLogTargetType | 'ALL'> = [
  'ALL', 'USER', 'FAMILY', 'SUBSCRIPTION', 'PROVISIONING', 'CONTAINER', 'BACKUP', 'RESTORE', 'SYSTEM',
]

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
}

export default function AuditLogsPage() {
  const [action, setAction] = useState<AuditLogAction | 'ALL'>('ALL')
  const [targetType, setTargetType] = useState<AuditLogTargetType | 'ALL'>('ALL')
  const [result, setResult] = useState<'SUCCESS' | 'FAILED' | 'ALL'>('ALL')
  const [adminUserId, setAdminUserId] = useState('')

  const { data, isLoading } = useAdminAuditLogs({
    limit: 50,
    action: action === 'ALL' ? undefined : action,
    targetType: targetType === 'ALL' ? undefined : targetType,
    result: result === 'ALL' ? undefined : result as 'SUCCESS' | 'FAILED',
    adminUserId: adminUserId.trim() || undefined,
  })

  const logs = data?.items ?? []

  return (
    <div>
      <Topbar title="Audit Logs" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a} value={a} className="text-xs">{a === 'ALL' ? 'Tất cả action' : a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={targetType} onValueChange={(v) => setTargetType(v as typeof targetType)}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Target type" /></SelectTrigger>
            <SelectContent>
              {TARGET_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t === 'ALL' ? 'Tất cả loại' : t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={result} onValueChange={(v) => setResult(v as 'SUCCESS' | 'FAILED' | 'ALL')}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Kết quả" /></SelectTrigger>
            <SelectContent>
              {(['ALL', 'SUCCESS', 'FAILED'] as const).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r === 'ALL' ? 'Tất cả KQ' : r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="h-8 text-xs w-48"
            placeholder="Admin user ID..."
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              Nhật ký hành động ({data?.total ?? 0})
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
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{log.action}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_COLORS[log.result] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.result}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Target: <span className="font-medium text-gray-700">{log.targetType}</span>
                        {log.targetId && <span className="font-mono ml-1 text-[10px]">({log.targetId.slice(0, 8)}…)</span>}
                      </p>
                      {log.adminUser && <p className="text-xs text-muted-foreground">By: {log.adminUser.email ?? log.adminUserId}</p>}
                      {log.createdAt && <p className="text-[10px] text-muted-foreground">{formatDate(log.createdAt)}</p>}
                      {log.details && (
                        <details className="text-[10px] text-muted-foreground">
                          <summary className="cursor-pointer">Chi tiết</summary>
                          <pre className="mt-1 text-[10px] bg-muted rounded p-1 overflow-auto max-h-24">{JSON.stringify(log.details, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2.5 pl-4">Action</th>
                        <th className="text-left py-2.5">Target</th>
                        <th className="text-left py-2.5">Admin</th>
                        <th className="text-left py-2.5">Kết quả</th>
                        <th className="text-left py-2.5 pr-4">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 pl-4">
                            <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{log.action}</span>
                          </td>
                          <td className="py-2 text-xs">
                            <span className="font-medium">{log.targetType}</span>
                            {log.targetId && <span className="font-mono text-muted-foreground ml-1 text-[10px]">{log.targetId.slice(0, 8)}…</span>}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{log.adminUser?.email ?? log.adminUserId?.slice(0, 12) ?? '—'}</td>
                          <td className="py-2">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RESULT_COLORS[log.result] ?? 'bg-gray-100 text-gray-600'}`}>
                              {log.result}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">{log.createdAt ? formatDate(log.createdAt) : '—'}</td>
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
