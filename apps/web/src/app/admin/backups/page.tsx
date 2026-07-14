'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Archive, RotateCcw, Plus, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdminBackups, useCreateAdminBackup, useAdminRestores, useCreateAdminRestore, useConfirmAdminRestore, BackupTarget } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api'

const BACKUP_TARGETS: BackupTarget[] = ['DATABASE', 'SYSTEM_CONFIG', 'FULL_SYSTEM']

const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
}

export default function BackupsPage() {
  const [backupTarget, setBackupTarget] = useState<BackupTarget>('DATABASE')
  const [backupNote, setBackupNote] = useState('')
  const [restoreBackupId, setRestoreBackupId] = useState('')
  const [restoreNote, setRestoreNote] = useState('')

  const { data: backups, isLoading: backupsLoading } = useAdminBackups()
  const { data: restores, isLoading: restoresLoading } = useAdminRestores()
  const createBackup = useCreateAdminBackup()
  const createRestore = useCreateAdminRestore()
  const confirmRestore = useConfirmAdminRestore()

  const handleCreateBackup = () => {
    createBackup.mutate(
      { target: backupTarget, note: backupNote.trim() || undefined },
      {
        onSuccess: () => { toast.success('Đã tạo backup'); setBackupNote('') },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể tạo backup')),
      },
    )
  }

  const handleCreateRestore = () => {
    if (!restoreBackupId.trim()) { toast.error('Nhập backup ID'); return }
    createRestore.mutate(
      { backupId: restoreBackupId.trim(), target: backupTarget, note: restoreNote.trim() || undefined },
      {
        onSuccess: () => { toast.success('Đã tạo yêu cầu restore'); setRestoreBackupId(''); setRestoreNote('') },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể tạo restore')),
      },
    )
  }

  const handleConfirmRestore = (id: string) => {
    if (!confirm('Xác nhận restore? Hành động này không thể hoàn tác!')) return
    confirmRestore.mutate(id, {
      onSuccess: () => toast.success('Đã xác nhận restore'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Xác nhận thất bại')),
    })
  }

  const backupList = Array.isArray(backups) ? backups : (backups as { items?: unknown[] })?.items ?? []
  const restoreList = Array.isArray(restores) ? restores : (restores as { items?: unknown[] })?.items ?? []

  return (
    <div>
      <Topbar title="Backup & Restore" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Create backup */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Tạo Backup mới
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Target</label>
                <Select value={backupTarget} onValueChange={(v) => setBackupTarget(v as BackupTarget)}>
                  <SelectTrigger className="h-9 text-sm w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BACKUP_TARGETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-48">
                <label className="text-xs text-muted-foreground">Ghi chú (tuỳ chọn)</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Ghi chú..."
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateBackup} disabled={createBackup.isPending} className="h-9 gap-2">
                {createBackup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                Tạo Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backups list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Archive className="w-4 h-4" /> Danh sách Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {backupsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (backupList as { id: string }[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa có backup nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2.5 pl-4">ID</th>
                      <th className="text-left py-2.5">Target</th>
                      <th className="text-left py-2.5">Trạng thái</th>
                      <th className="text-left py-2.5">Ghi chú</th>
                      <th className="text-left py-2.5 pr-4">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(backupList as Record<string, string>[]).map((b) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 pl-4 font-mono text-[10px] text-muted-foreground">{b.id ? `${b.id.slice(0, 12)}…` : '—'}</td>
                        <td className="py-2 text-xs font-semibold">{b.target}</td>
                        <td className="py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground max-w-[140px] truncate">{b.note ?? '—'}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{b.createdAt ? formatDate(b.createdAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create restore */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Tạo Restore
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-48">
                <label className="text-xs text-muted-foreground">Backup ID <span className="text-red-500">*</span></label>
                <Input
                  className="h-9 text-sm font-mono"
                  placeholder="Backup UUID..."
                  value={restoreBackupId}
                  onChange={(e) => setRestoreBackupId(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-1 min-w-36">
                <label className="text-xs text-muted-foreground">Ghi chú</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Lý do..."
                  value={restoreNote}
                  onChange={(e) => setRestoreNote(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleCreateRestore} disabled={createRestore.isPending} className="h-9 gap-2">
                {createRestore.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Tạo Restore
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Restores list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Lịch sử Restore
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {restoresLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (restoreList as { id: string }[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa có restore nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2.5 pl-4">ID</th>
                      <th className="text-left py-2.5">Backup ID</th>
                      <th className="text-left py-2.5">Trạng thái</th>
                      <th className="text-left py-2.5">Ghi chú</th>
                      <th className="text-left py-2.5">Ngày tạo</th>
                      <th className="text-left py-2.5 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(restoreList as Record<string, string>[]).map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 pl-4 font-mono text-[10px] text-muted-foreground">{r.id ? `${r.id.slice(0, 12)}…` : '—'}</td>
                        <td className="py-2 font-mono text-[10px] text-muted-foreground">{r.backupId ? `${r.backupId.slice(0, 12)}…` : '—'}</td>
                        <td className="py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground max-w-[120px] truncate">{r.note ?? '—'}</td>
                        <td className="py-2 text-xs text-muted-foreground">{r.createdAt ? formatDate(r.createdAt) : '—'}</td>
                        <td className="py-2 pr-4">
                          {r.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] text-green-700 border-green-300 hover:bg-green-50"
                              disabled={confirmRestore.isPending}
                              onClick={() => handleConfirmRestore(r.id)}
                            >
                              Xác nhận
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
