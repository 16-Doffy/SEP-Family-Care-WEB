'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Server, Database, Activity, HardDrive, Cpu, MemoryStick, Network, RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useAdminSystemHealth,
  useAdminSystemRuntime,
  useAdminInfraHost,
  useAdminDockerContainers,
  useAdminDockerContainerStats,
} from '@/hooks/useAdmin'

function formatBytes(bytes?: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

function formatUptime(seconds?: number) {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function AdminSystemPage() {
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [containerInput, setContainerInput] = useState('')

  const { data: health, isLoading: healthLoading } = useAdminSystemHealth()
  const { data: runtime } = useAdminSystemRuntime()
  const { data: host } = useAdminInfraHost()
  const { data: containers, isLoading: containersLoading } = useAdminDockerContainers()
  const { data: containerStats, isLoading: statsLoading } = useAdminDockerContainerStats(selectedContainer)

  const loadLogs = () => {
    const id = containerInput.trim()
    if (!id) { toast.error('Nhập container ID hoặc tên'); return }
    setSelectedContainer(id)
  }

  return (
    <div>
      <Topbar title="Hệ thống & Hạ tầng" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Health tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            // Health trả 200 nghĩa là API sống — hiện UP kể cả khi BE không có field status
            { icon: Server, label: 'API Status', value: health?.status ?? (health ? 'UP' : healthLoading ? '...' : '—'), color: 'text-indigo-600' },
            { icon: Database, label: 'Database', value: typeof health?.database === 'string' ? health.database : (health?.database as { status?: string })?.status ?? (healthLoading ? '...' : '—'), color: 'text-emerald-600' },
            { icon: Activity, label: 'Uptime', value: formatUptime(health?.uptimeSeconds ?? (health?.uptime as number | undefined) ?? runtime?.uptime), color: 'text-orange-600' },
            { icon: HardDrive, label: 'Uploads', value: `${health?.uploads?.files ?? 0} files`, color: 'text-slate-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Icon className={`w-7 h-7 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className="text-lg md:text-xl font-bold truncate">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Runtime + Host */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Cpu className="w-4 h-4" /> Runtime Node.js</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {runtime ? (() => {
                const rt = runtime as Record<string, unknown>
                const mem = (runtime.memoryUsage ?? rt.memory_usage ?? rt.memory) as Record<string, number> | undefined
                const ver = runtime.nodeVersion ?? rt.node_version ?? rt.version
                const pid = runtime.pid ?? rt.process_id
                const up = (runtime.uptime ?? rt.uptime_seconds ?? rt.uptimeSeconds) as number | undefined
                return (
                  <>
                    <Row label="Node version" value={ver as string | undefined} />
                    <Row label="PID" value={pid != null ? String(pid) : undefined} />
                    <Row label="Uptime" value={formatUptime(up)} />
                    <Row label="Heap used" value={formatBytes(mem?.heapUsed ?? mem?.heap_used)} />
                    <Row label="Heap total" value={formatBytes(mem?.heapTotal ?? mem?.heap_total)} />
                    <Row label="RSS" value={formatBytes(mem?.rss)} />
                  </>
                )
              })() : (
                <p className="text-muted-foreground text-xs">Đang tải...</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Network className="w-4 h-4" /> Host / Infrastructure</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {host ? (() => {
                const h = host as Record<string, unknown>
                const os = (host.os ?? h.OS ?? h) as Record<string, unknown>
                const cpu = (host.cpu ?? h.CPU ?? h) as Record<string, unknown>
                const mem = (host.memory ?? h.ram ?? h.RAM ?? h) as Record<string, number>
                const disk = (host.disk ?? h.storage ?? h) as Record<string, number>
                const platform = os.platform ?? h.platform
                const hostname = os.hostname ?? h.hostname
                const cores = cpu.cores ?? cpu.count ?? h.cpuCores ?? h.cpu_cores
                const model = cpu.model ?? h.cpuModel ?? h.cpu_model
                const memTotal = mem.total ?? (h.memTotal as number)
                const memFree = mem.free ?? (h.memFree as number)
                const diskFree = disk.free ?? (h.diskFree as number)
                return (
                  <>
                    <Row label="Platform" value={platform as string | undefined} />
                    <Row label="Hostname" value={hostname as string | undefined} />
                    <Row label="CPU cores" value={cores != null ? String(cores) : undefined} />
                    <Row label="CPU model" value={model as string | undefined} />
                    <Row label="RAM total" value={formatBytes(memTotal)} />
                    <Row label="RAM free" value={formatBytes(memFree)} />
                    <Row label="Disk free" value={formatBytes(diskFree)} />
                  </>
                )
              })() : (
                <p className="text-muted-foreground text-xs">Đang tải...</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Memory detail */}
        {health?.memory && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><MemoryStick className="w-4 h-4" /> Bộ nhớ hệ thống</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Row label="RSS" value={formatBytes(health.memory.rss)} />
                <Row label="Heap used" value={formatBytes(health.memory.heapUsed)} />
                <Row label="Heap total" value={formatBytes(health.memory.heapTotal)} />
                <Row label="System free" value={formatBytes(health.memory.systemFree)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Docker containers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Docker Containers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {containersLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : !Array.isArray(containers) || containers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Docker không khả dụng hoặc không có container nào</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden space-y-2">
                  {containers.map((c, i) => {
                    const cName = c.name ?? c.Names ?? ''
                    const cId = c.containerId ?? c.ID ?? ''
                    const cState = c.state ?? c.State ?? c.status ?? c.Status ?? ''
                    const cImage = c.image ?? c.Image ?? '—'
                    const isRunning = /run/i.test(cState)
                    return (
                      <div key={cId || i} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{cName || cId}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {cState || '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{cImage}</p>
                        <button
                          className="text-xs text-violet-600 hover:underline"
                          onClick={() => { const id = cId || cName; setContainerInput(id); setSelectedContainer(id || null) }}
                        >
                          Xem log
                        </button>
                      </div>
                    )
                  })}
                </div>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2">Container</th>
                      <th className="text-left py-2">Image</th>
                      <th className="text-left py-2">State</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2"></th>
                    </tr></thead>
                    <tbody>
                      {containers.map((c, i) => {
                        const cName = c.name ?? c.Names ?? ''
                        const cId = c.containerId ?? c.ID ?? ''
                        const cState = c.state ?? c.State ?? ''
                        const cStatus = c.status ?? c.Status ?? ''
                        const cImage = c.image ?? c.Image ?? '—'
                        const isRunning = /run/i.test(cState || cStatus)
                        return (
                          <tr key={cId || i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 font-medium font-mono text-xs">{cName || cId}</td>
                            <td className="py-2 text-muted-foreground text-xs">{cImage}</td>
                            <td className="py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {cState || '—'}
                              </span>
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">{cStatus || '—'}</td>
                            <td className="py-2">
                              <button
                                className="text-xs text-violet-600 hover:underline"
                                onClick={() => { const id = cId || cName; setContainerInput(id); setSelectedContainer(id || null) }}
                              >
                                Log
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Stats viewer */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Input
                value={containerInput}
                onChange={(e) => setContainerInput(e.target.value)}
                placeholder="Container ID hoặc tên"
                className="flex-1"
              />
              <Button variant="outline" onClick={loadLogs} disabled={statsLoading} className="w-full sm:w-auto gap-2">
                {statsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Xem stats
              </Button>
            </div>
            {containerStats != null && (
              <pre className="max-h-80 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100 whitespace-pre-wrap">
                {JSON.stringify(containerStats, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2 text-xs border-b last:border-0 py-1">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{value ?? '—'}</span>
    </div>
  )
}
