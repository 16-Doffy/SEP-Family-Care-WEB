'use client'
/**
 * Trang Tổng quan Admin - đã rút gọn.
 * Chỉ hiển thị KPI tổng quát + sức khỏe hệ thống tóm tắt + lối tắt sang các tab khác.
 * Các phần Gia đình / Users / Docker đã tách sang route con riêng (xem MobileAdminNav).
 */
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Home, Activity, Server, Database, Download, HardDrive, BarChart3, Server as ServerIcon } from 'lucide-react'
import toast from 'react-hot-toast'

interface SystemHealth {
  status: string
  database: string
  cpu: { cores: number }
  memory: { rss: number; heapUsed: number; heapTotal: number; systemFree: number; systemTotal: number }
  uploads: { files: number; bytes: number }
}

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

export default function AdminPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
  })

  const { data: health } = useQuery<SystemHealth>({
    queryKey: ['admin-system-health'],
    queryFn: () => api.get('/admin/system/health').then((r) => r.data),
    refetchInterval: 30000,
  })

  const exportBackup = async () => {
    try {
      const res = await api.get('/admin/backup/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `family-care-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất backup')
    } catch {
      toast.error('Không thể xuất backup')
    }
  }

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Home className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{stats?.totalFamilies ?? 0}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Tổng gia đình</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Users className="w-7 h-7 md:w-8 md:h-8 text-green-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Tổng người dùng</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Activity className="w-7 h-7 md:w-8 md:h-8 text-purple-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{stats?.activeUsers ?? 0}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Đang hoạt động</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System health tóm tắt */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Server className="w-7 h-7 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{health?.status ?? '...'}</p>
                <p className="text-xs text-muted-foreground">API status</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Database className="w-7 h-7 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{health?.database ?? '...'}</p>
                <p className="text-xs text-muted-foreground">Database</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Activity className="w-7 h-7 text-orange-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{health ? `${health.cpu.cores} cores` : '...'}</p>
                <p className="text-xs text-muted-foreground">CPU</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <HardDrive className="w-7 h-7 text-slate-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{formatBytes(health?.uploads.bytes)}</p>
                <p className="text-xs text-muted-foreground">{health?.uploads.files ?? 0} files</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Truy cập nhanh */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Truy cập nhanh</h2>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/admin/revenue">
              <Button variant="outline" className="gap-2 w-full flex-col h-auto py-3">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <span className="text-xs">Doanh thu</span>
              </Button>
            </Link>
            <Link href="/admin/system">
              <Button variant="outline" className="gap-2 w-full flex-col h-auto py-3">
                <ServerIcon className="w-5 h-5 text-indigo-600" />
                <span className="text-xs">Hệ thống</span>
              </Button>
            </Link>
            <Button variant="outline" className="gap-2 w-full flex-col h-auto py-3" onClick={exportBackup}>
              <Download className="w-5 h-5 text-blue-600" />
              <span className="text-xs">Xuất backup</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
