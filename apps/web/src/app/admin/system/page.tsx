'use client'
/**
 * Trang Hệ thống & Docker - tách từ /admin để tab Tổng quan ngắn gọn.
 * Hiển thị health chi tiết, container Docker (auto refetch 30s) và viewer log container.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Server, Database, Activity, HardDrive } from 'lucide-react'
import toast from 'react-hot-toast'

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

interface DockerStatus {
  available: boolean
  containers: Array<{ ID?: string; Names?: string; Image?: string; State?: string; Status?: string; raw?: string }>
  stats: Array<{ Name?: string; CPUPerc?: string; MemUsage?: string; MemPerc?: string; BlockIO?: string; raw?: string }>
  disk: Array<Record<string, string>>
  error?: string | null
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

export default function AdminSystemPage() {
  const [logContainer, setLogContainer] = useState('fc_api')
  const [logs, setLogs] = useState('')

  const { data: health } = useQuery<SystemHealth>({
    queryKey: ['admin-system-health'],
    queryFn: () => api.get('/admin/system/health').then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: docker } = useQuery<DockerStatus>({
    queryKey: ['admin-docker'],
    queryFn: () => api.get('/admin/system/docker').then((r) => r.data),
    refetchInterval: 30000,
  })

  const loadLogs = async () => {
    try {
      const { data } = await api.get(`/admin/system/logs/${encodeURIComponent(logContainer)}`, { params: { tail: 200 } })
      setLogs(data.logs || '')
    } catch {
      toast.error('Không thể đọc log container')
    }
  }

  return (
    <div>
      <Topbar title="Hệ thống & Docker" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Server className="w-7 h-7 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">{health?.status ?? '...'}</p>
                <p className="text-xs text-muted-foreground">API status</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Database className="w-7 h-7 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">{health?.database ?? '...'}</p>
                <p className="text-xs text-muted-foreground">Database</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Activity className="w-7 h-7 text-orange-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">{health ? `${health.cpu.cores} cores` : '...'}</p>
                <p className="text-xs text-muted-foreground">CPU</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <HardDrive className="w-7 h-7 text-slate-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">{formatBytes(health?.uploads.bytes)}</p>
                <p className="text-xs text-muted-foreground">{health?.uploads.files ?? 0} upload files</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Docker & container logs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!docker?.available && (
              <p className="text-sm text-muted-foreground">{docker?.error ?? 'Docker CLI chưa khả dụng trên API host'}</p>
            )}

            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {(docker?.containers ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có container nào</p>
              ) : (
                (docker?.containers ?? []).map((c, idx) => {
                  const name = c.Names ?? c.raw ?? ''
                  const stat = docker?.stats?.find((s) => s.Name === name)
                  const state = c.State ?? c.Status ?? '-'
                  const isRunning = /run/i.test(state)
                  return (
                    <div key={`m-${name}-${idx}`} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{name || c.ID}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {state}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.Image ?? '-'}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                        <span>CPU: <b className="text-gray-700">{stat?.CPUPerc ?? '-'}</b></span>
                        <span>RAM: <b className="text-gray-700">{stat?.MemUsage ?? stat?.MemPerc ?? '-'}</b></span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Container</th>
                  <th className="text-left py-2">Image</th>
                  <th className="text-left py-2">State</th>
                  <th className="text-left py-2">CPU</th>
                  <th className="text-left py-2">RAM</th>
                </tr></thead>
                <tbody>
                  {(docker?.containers ?? []).map((c, idx) => {
                    const name = c.Names ?? c.raw ?? ''
                    const stat = docker?.stats?.find((s) => s.Name === name)
                    return (
                      <tr key={`${name}-${idx}`} className="border-b last:border-0">
                        <td className="py-2 font-medium">{name || c.ID}</td>
                        <td className="py-2 text-muted-foreground">{c.Image ?? '-'}</td>
                        <td className="py-2">{c.State ?? c.Status ?? '-'}</td>
                        <td className="py-2">{stat?.CPUPerc ?? '-'}</td>
                        <td className="py-2">{stat?.MemUsage ?? stat?.MemPerc ?? '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={logContainer} onChange={(e) => setLogContainer(e.target.value)} placeholder="fc_api" />
              <Button variant="outline" onClick={loadLogs} className="w-full sm:w-auto">Xem log</Button>
            </div>
            {logs && (
              <pre className="max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100 whitespace-pre-wrap">
                {logs}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
