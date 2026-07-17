'use client'
import { useState, useEffect } from 'react'
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
  useAdminFamilies,
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
  const { data: familiesData } = useAdminFamilies({ limit: 100 })

  const loadLogs = () => {
    const id = containerInput.trim()
    if (!id) { toast.error('Nhập container ID hoặc tên'); return }
    setSelectedContainer(id)
  }

  const apiContainers = containers && Array.isArray((containers as any).items)
    ? (containers as any).items
    : (Array.isArray(containers) ? containers : [])

  const mergedContainers: any[] = []

  if (apiContainers.length > 0) {
    apiContainers.forEach((c: any) => {
      mergedContainers.push({
        containerId: c.id ?? c.containerId ?? c.ID ?? '',
        name: c.name ?? c.Names ?? '',
        state: c.state ?? c.State ?? '',
        status: c.status ?? c.Status ?? '',
        image: c.image ?? c.Image ?? '',
        isApi: true,
      })
    })
  } else {
    const DEFAULT_CONTAINERS = [
      { id: 'familycare_db', name: 'familycare_db', state: 'running', status: 'Mặc định', image: 'postgres:16-alpine' },
      { id: 'fc_api', name: 'fc_api', state: 'running', status: 'Mặc định', image: 'development/production' },
      { id: 'fc_web', name: 'fc_web', state: 'running', status: 'Mặc định', image: 'development/production' },
      { id: 'fc_redis', name: 'fc_redis', state: 'running', status: 'Mặc định', image: 'redis:7-alpine' },
      { id: 'fc_postgres', name: 'fc_postgres', state: 'running', status: 'Mặc định', image: 'postgres:16-alpine' },
    ]

    DEFAULT_CONTAINERS.forEach((dc) => {
      mergedContainers.push({
        containerId: dc.id,
        name: dc.name,
        state: dc.state,
        status: dc.status,
        image: dc.image,
        isDefault: true,
      })
    })

    // Add dynamically generated container names for active families
    const families = familiesData?.items ?? []
    families.forEach((f) => {
      const fContainerName = `family-${f.id.slice(0, 8)}`
      const exists = mergedContainers.some((c) => {
        const cId = c.containerId ?? c.ID ?? ''
        const cName = c.name ?? c.Names ?? ''
        return cId === fContainerName || cName === fContainerName
      })
      if (!exists) {
        mergedContainers.push({
          containerId: fContainerName,
          name: `${fContainerName} (${f.name})`,
          state: 'running',
          status: 'Workspace',
          image: 'shared-runtime',
          isFamily: true,
        })
      }
    })
  }

  // Setup initial selected container
  useEffect(() => {
    if (!selectedContainer && mergedContainers.length > 0) {
      const defaultSel = mergedContainers.find(c => c.containerId === 'familycare_db' || c.name === 'familycare_db') || mergedContainers[0]
      const selId = defaultSel.containerId ?? defaultSel.ID ?? defaultSel.name ?? defaultSel.Names
      if (selId) {
        setSelectedContainer(selId)
        setContainerInput(selId)
      }
    }
  }, [mergedContainers, selectedContainer])

  const getStatVal = (obj: any, ...paths: string[][]) => {
    for (const path of paths) {
      let current = obj
      for (const key of path) {
        if (current && typeof current === 'object' && current !== null && key in current) {
          current = current[key]
        } else {
          current = undefined
          break
        }
      }
      if (current !== undefined) return current
    }
    return undefined
  }

  return (
    <div>
      <Topbar title="Hệ thống & Hạ tầng" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Health tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            // Health trả 200 nghĩa là API sống — hiện UP kể cả khi BE không có field status
            { icon: Server, label: 'API Status', value: health?.backend?.status ?? (health ? 'UP' : healthLoading ? '...' : '—'), color: 'text-indigo-600' },
            { icon: Database, label: 'Database', value: typeof health?.database === 'string' ? health.database : (health?.database as { status?: string })?.status ?? (healthLoading ? '...' : '—'), color: 'text-emerald-600' },
            { icon: Activity, label: 'Uptime', value: formatUptime(health?.backend?.uptimeSeconds ?? (health?.uptime as number | undefined) ?? runtime?.uptime), color: 'text-orange-600' },
            { icon: HardDrive, label: 'Uploads', value: `${(health?.uploads as { files?: number } | undefined)?.files ?? 0} files`, color: 'text-slate-600' },
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
            ) : (
              <div className="space-y-4">
                {/* Container Selector Tabs */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chọn Container</p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border rounded bg-slate-50/50 dark:bg-slate-900/30">
                    {mergedContainers.map((c, i) => {
                      const cName = c.name ?? c.Names ?? ''
                      const cId = c.containerId ?? c.ID ?? ''
                      const cState = c.state ?? c.State ?? c.status ?? c.Status ?? ''
                      const isRunning = /run/i.test(cState) || c.isDefault || c.isFamily
                      const selectKey = cId || cName
                      const isSelected = selectedContainer === selectKey

                      return (
                        <button
                          key={cId || i}
                          onClick={() => {
                            setSelectedContainer(selectKey)
                            setContainerInput(selectKey)
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 shadow-sm font-medium ${
                            isSelected
                              ? 'bg-violet-600 border-violet-600 text-white shadow-violet-100 dark:shadow-none'
                              : 'bg-white hover:bg-slate-50 border-gray-200 text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <span className="truncate max-w-[150px]">{cName}</span>
                          {c.isDefault && <span className="text-[9px] px-1 bg-blue-100 text-blue-700 rounded dark:bg-blue-900 dark:text-blue-200 font-mono">System</span>}
                          {c.isFamily && <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded dark:bg-amber-900 dark:text-amber-200 font-mono">WS</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Stats details dashboard */}
                {selectedContainer && (
                  <div className="border-t pt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                          Thông số hoạt động: <span className="font-mono text-violet-600 dark:text-violet-400">{selectedContainer}</span>
                        </h4>
                        <p className="text-[9px] text-muted-foreground">Tự động cập nhật mỗi 10 giây</p>
                      </div>
                      
                      <Button variant="outline" size="sm" onClick={loadLogs} disabled={statsLoading} className="h-8 text-[11px] gap-1 px-2.5">
                        {statsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Làm mới
                      </Button>
                    </div>

                    {statsLoading && !containerStats ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-600" /></div>
                    ) : containerStats ? (() => {
                      const cpuPercent = Number(getStatVal(containerStats, ['cpu', 'cpuPercent'], ['cpu', 'percent']) ?? 0)
                      const memUsage = Number(getStatVal(containerStats, ['memory', 'usageMb'], ['memory', 'usage_mb']) ?? 0)
                      const memLimit = Number(getStatVal(containerStats, ['memory', 'limitMb'], ['memory', 'limit_mb']) ?? 0)
                      const memPercent = Number(getStatVal(containerStats, ['memory', 'usagePercent'], ['memory', 'percent']) ?? 0)
                      
                      const netRx = Number(getStatVal(containerStats, ['network', 'rxMb'], ['network', 'rx_mb']) ?? 0)
                      const netTx = Number(getStatVal(containerStats, ['network', 'txMb'], ['network', 'tx_mb']) ?? 0)
                      
                      const ioRead = Number(getStatVal(containerStats, ['blockIo', 'readMb'], ['blockIo', 'read_mb']) ?? 0)
                      const ioWrite = Number(getStatVal(containerStats, ['blockIo', 'writeMb'], ['blockIo', 'write_mb']) ?? 0)

                      return (
                        <div className="space-y-4">
                          {/* Grid Metrics */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* CPU */}
                            <div className="border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/10 space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-medium">CPU Usage</span>
                                <Cpu className="w-3.5 h-3.5 text-violet-500" />
                              </div>
                              <p className="text-base font-bold">{cpuPercent.toFixed(2)}%</p>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-violet-600 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* RAM */}
                            <div className="border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/10 space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-medium">Memory Usage</span>
                                <MemoryStick className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <p className="text-base font-bold">{memPercent.toFixed(1)}%</p>
                              <p className="text-[9px] text-muted-foreground truncate">{memUsage.toFixed(1)} MB / {memLimit.toFixed(0)} MB</p>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(memPercent, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Network */}
                            <div className="border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/10 space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-medium">Network I/O</span>
                                <Network className="w-3.5 h-3.5 text-blue-500" />
                              </div>
                              <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between">
                                  <span>Nhận (Rx):</span>
                                  <span className="font-semibold text-right">{netRx.toFixed(1)} MB</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Gửi (Tx):</span>
                                  <span className="font-semibold text-right">{netTx.toFixed(1)} MB</span>
                                </div>
                              </div>
                            </div>

                            {/* Block IO */}
                            <div className="border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/10 space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-medium">Disk I/O</span>
                                <HardDrive className="w-3.5 h-3.5 text-orange-500" />
                              </div>
                              <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between">
                                  <span>Đọc:</span>
                                  <span className="font-semibold text-right">{ioRead.toFixed(1)} MB</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Ghi:</span>
                                  <span className="font-semibold text-right">{ioWrite.toFixed(1)} MB</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Full JSON display */}
                          {containerStats != null && (
                            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-100 whitespace-pre-wrap font-mono">
                              {JSON.stringify(containerStats, null, 2)}
                            </pre>
                          )}
                        </div>
                      )
                    })() : (
                      <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded">
                        Không tải được thông số hoạt động của container. Có thể container đã dừng hoặc không có stats.
                      </p>
                    )}
                  </div>
                )}

                {/* Fallback Manual Input */}
                <div className="border-t pt-2">
                  <details className="group">
                    <summary className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none font-medium flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90">▶</span> Nhập container ID / tên thủ công (Dự phòng)
                    </summary>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Input
                        value={containerInput}
                        onChange={(e) => setContainerInput(e.target.value)}
                        placeholder="Nhập Container ID hoặc tên..."
                        className="flex-1 h-8 text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={loadLogs} disabled={statsLoading} className="h-8 text-xs gap-1.5">
                        {statsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Xem stats
                      </Button>
                    </div>
                  </details>
                </div>
              </div>
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
