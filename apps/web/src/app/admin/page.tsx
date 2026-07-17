'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import {
  Users, Home, Crown, TrendingUp, Activity, Server, DollarSign,
  ChevronRight, RefreshCw, Bell, Search, UserPlus,
  CheckCircle2, XCircle, Box, BarChart3, PieChart as PieIcon,
  UserCheck,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, LabelList,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  useAdminDashboardSummary,
  useAdminRevenueSummary,
  useAdminRevenueMonthly,
  useAdminSystemHealth,
  useAdminDockerContainers,
  useAdminAuditLogs,
  useAdminJoinRequests,
  useAdminPayments,
  type AdminAuditLog,
  type AdminDockerContainer,
} from '@/hooks/useAdmin'
import { useAuth } from '@/context/AuthContext'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatVND(value?: number | null) {
  if (!value) return '0 ₫'
  if (value >= 1_000_000_000) return `₫${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `₫${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `₫${(value / 1_000).toFixed(0)}K`
  return `₫${value}`
}

function makeTickFormatter(maxVal: number) {
  if (maxVal >= 1_000_000_000) return (v: number) => `₫${(v / 1_000_000_000).toFixed(1)}B`
  if (maxVal >= 1_000_000) return (v: number) => `₫${(v / 1_000_000).toFixed(0)}M`
  if (maxVal >= 1_000) return (v: number) => `₫${(v / 1_000).toFixed(0)}K`
  if (maxVal > 0) return (v: number) => `₫${v}`
  return (v: number) => String(v)
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

/** Normalize container: API trả về array trực tiếp với field viết hoa hoặc viết thường */
function getContainerName(c: AdminDockerContainer) {
  const raw = (c.name ?? c.Names ?? '') as string
  return raw.replace(/^\//, '').split(',')[0].trim()
}
function getContainerState(c: AdminDockerContainer) {
  return ((c.state ?? c.State ?? '') as string).toLowerCase()
}
function getContainerStatus(c: AdminDockerContainer) {
  return (c.status ?? c.Status ?? '') as string
}
function getContainerImage(c: AdminDockerContainer) {
  return (c.image ?? c.Image ?? '') as string
}

/* ─── TopBar ─────────────────────────────────────────────────────────────────── */
function TopBar() {
  const { user } = useAuth()
  const now = new Date()
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const initials = (user?.displayName ?? 'SA').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-slate-900 leading-tight">Dashboard</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Tổng quan SEPFamilyCare — cập nhật lúc {timeStr}, {dateStr}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-400">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[13px]">Tìm kiếm...</span>
        </div>
        <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-600 font-bold text-[10px]">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-slate-700 hidden sm:block">{user?.displayName ?? 'Super Admin'}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── KPI Card ────────────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, accentColor, warning, loading,
}: {
  label: string
  value?: string | number | null
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
  warning?: boolean
  loading?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow ${warning ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${warning ? 'text-amber-600' : 'text-slate-400'}`}>{label}</p>
        <Icon className={`w-4 h-4 ${warning ? 'text-amber-400' : accentColor}`} />
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-slate-100 rounded-md animate-pulse mb-1" />
      ) : (
        <p className="text-[28px] font-bold text-slate-900 leading-none tracking-tight">
          {value != null ? value : <span className="text-slate-300 text-xl">—</span>}
        </p>
      )}
      {sub && <p className="text-[11px] text-slate-400 mt-2 leading-snug">{sub}</p>}
    </div>
  )
}

/* ─── Container badge ────────────────────────────────────────────────────────── */
function ContainerDot({ state }: { state: string }) {
  if (state === 'running') return <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
  if (state === 'restarting') return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
}

function ContainerStateBadge({ state }: { state: string }) {
  if (state === 'running') return <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Running</span>
  if (state === 'restarting') return <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">Restarting</span>
  return <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full capitalize">{state || 'Stopped'}</span>
}

/* ─── Audit icon ────────────────────────────────────────────────────────────── */
function AuditIcon({ log }: { log: AdminAuditLog }) {
  const t = log.targetType?.toUpperCase()
  if (t === 'USER') return <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-blue-500" /></div>
  if (t === 'FAMILY') return <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0"><Home className="w-3.5 h-3.5 text-violet-500" /></div>
  if (t === 'SUBSCRIPTION') return <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0"><Crown className="w-3.5 h-3.5 text-amber-500" /></div>
  if (t === 'CONTAINER') return <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Server className="w-3.5 h-3.5 text-slate-500" /></div>
  return <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Activity className="w-3.5 h-3.5 text-slate-400" /></div>
}

function AuditTag({ log }: { log: AdminAuditLog }) {
  const t = log.targetType?.toUpperCase()
  if (t === 'USER') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">User</span>
  if (t === 'FAMILY') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">Family</span>
  if (t === 'SUBSCRIPTION') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">Sub</span>
  if (t === 'CONTAINER') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Container</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{log.targetType ?? 'System'}</span>
}

/* ─── Colors ────────────────────────────────────────────────────────────────── */
const STATUS_COLORS = ['#10b981', '#94a3b8', '#f43f5e']

/* ─── Main Dashboard ─────────────────────────────────────────────────────────── */
export default function AdminPage() {
  const { data: summary, isLoading: summaryLoading } = useAdminDashboardSummary()
  const { data: revenue } = useAdminRevenueSummary()
  const { data: revenueMonthly } = useAdminRevenueMonthly()
  const { data: health } = useAdminSystemHealth()
  const { data: containersData } = useAdminDockerContainers()
  const { data: auditLogs } = useAdminAuditLogs({ limit: 6 })
  const { data: joinRequests } = useAdminJoinRequests({ status: 'PENDING', limit: 1 })
  const { data: paymentsData } = useAdminPayments({ limit: 100, status: 'PAID' })

  /* Docker — Handle case where API returns paginated or direct array */
  const containers: AdminDockerContainer[] = containersData && Array.isArray((containersData as any).items)
    ? (containersData as any).items
    : (Array.isArray(containersData) ? containersData : [])
  const runningCount = containers.filter(c => getContainerState(c) === 'running').length
  const totalContainers = containers.length
  const apiUp = health?.backend?.status === 'UP' || health?.backend?.status === 'ok' || health?.backend?.status === 'OK'

  /* Area chart - Daily revenue for target month (auto-detect based on latest payment) */
  const areaData = useMemo(() => {
    const today = new Date()
    let targetMonth = today.getMonth()
    let targetYear = today.getFullYear()

    const items = Array.isArray(paymentsData) ? paymentsData : (paymentsData as any)?.items || []
    if (items.length > 0 && items[0]?.createdAt) {
      const latest = new Date(items[0].createdAt)
      targetMonth = latest.getMonth()
      targetYear = latest.getFullYear()
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    const dataMap: Record<number, { revenue: number, payments: number }> = {}
    
    // Initialize all days of target month to 0
    for (let i = 1; i <= daysInMonth; i++) {
      dataMap[i] = { revenue: 0, payments: 0 }
    }

    items.forEach((p: any) => {
      if (p.createdAt) {
        const d = new Date(p.createdAt)
        // Only include target month and year
        if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
          const day = d.getDate()
          if (dataMap[day]) {
            dataMap[day].revenue += Number(p.amount || 0)
            dataMap[day].payments += 1
          }
        }
      }
    })

    return Object.entries(dataMap).map(([day, val]) => ({
      label: `${day}/${targetMonth + 1}`,
      revenue: val.revenue,
      payments: val.payments,
    }))
  }, [paymentsData])

  const maxRevenue = useMemo(() => Math.max(...areaData.map(d => d.revenue), 0), [areaData])
  const yTickFmt = useMemo(() => makeTickFormatter(maxRevenue), [maxRevenue])

  /* Donut — user status breakdown từ dashboard summary */
  const donutData = useMemo(() => [
    { name: 'Hoạt động', value: summary?.users?.active ?? 0 },
    { name: 'Khóa/Vô hiệu', value: (summary?.users?.locked ?? 0) + (summary?.users?.disabled ?? 0) },
    { name: 'Chờ xác thực', value: summary?.users?.pending ?? 0 },
  ].filter(d => d.value > 0), [summary])

  const totalUsersDonut = summary?.users?.total ?? 0

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <TopBar />
      <div className="flex-1 p-5 space-y-5">

        {/* ═══ KPI Cards — từ useAdminDashboardSummary + useAdminRevenueSummary ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="Tổng người dùng"
            value={summary?.users?.total?.toLocaleString('vi-VN')}
            sub={summary?.users?.active != null ? `${summary.users.active.toLocaleString('vi-VN')} đang hoạt động` : undefined}
            icon={Users}
            accentColor="text-blue-400"
            loading={summaryLoading}
          />
          <KpiCard
            label="Gia đình hoạt động"
            value={summary?.families?.active?.toLocaleString('vi-VN')}
            sub={summary?.families?.total != null ? `Tổng: ${summary.families.total.toLocaleString('vi-VN')} gia đình` : undefined}
            icon={Home}
            accentColor="text-teal-400"
            loading={summaryLoading}
          />
          <KpiCard
            label="Tổng doanh thu"
            value={revenue?.totalRevenue != null ? formatVND(revenue.totalRevenue) : null}
            sub={revenue?.paidPayments != null ? `${revenue.paidPayments.toLocaleString('vi-VN')} giao dịch thành công` : undefined}
            icon={DollarSign}
            accentColor="text-emerald-400"
          />
          <KpiCard
            label="Người dùng chờ xác thực"
            value={summary?.users?.pending?.toLocaleString('vi-VN')}
            sub={summary?.users?.locked ? `${summary.users.locked} tài khoản bị khóa` : 'Không có tài khoản bị khóa'}
            icon={UserCheck}
            accentColor="text-indigo-400"
            loading={summaryLoading}
          />
          <KpiCard
            label="Giao dịch thành công"
            value={revenue?.paidPayments?.toLocaleString('vi-VN')}
            sub={revenue?.failedPayments ? `${revenue.failedPayments} thất bại` : revenue?.pendingPayments ? `${revenue.pendingPayments} đang xử lý` : undefined}
            icon={TrendingUp}
            accentColor="text-violet-400"
          />
          <KpiCard
            label="Containers đang chạy"
            value={totalContainers > 0 ? `${runningCount}/${totalContainers}` : null}
            sub={`API: ${apiUp ? '✓ Hoạt động' : '✗ Sự cố'}`}
            icon={Activity}
            accentColor="text-cyan-400"
            warning={!apiUp}
          />
        </div>

        {/* ═══ Charts ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

          {/* Area Chart — useAdminRevenueMonthly */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Doanh thu theo ngày (tháng này)</p>
                <p className="text-xs text-slate-400 mt-0.5">Nguồn: /admin/payments</p>
              </div>
              {areaData.length > 0 && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Doanh thu</span>
                </div>
              )}
            </div>
            {areaData.length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-slate-300">
                <BarChart3 className="w-8 h-8" />
                <p className="text-sm text-slate-400">Chưa có dữ liệu doanh thu theo tháng</p>
              </div>
            ) : (
              <div className="h-[220px] -ml-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={areaData} margin={{ top: 20, right: 0, left: 10, bottom: 0 }} barCategoryGap="5%" barGap={2}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="rev"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={yTickFmt}
                    width={60}
                  />
                  <YAxis
                    yAxisId="pay"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    formatter={(v: unknown, name: unknown) => {
                      const num = Number(v)
                      return name === 'revenue'
                        ? [formatVND(num), 'Doanh thu']
                        : [num.toLocaleString('vi-VN'), 'Giao dịch']
                    }}
                  />
                  <Bar yAxisId="rev" dataKey="revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="revenue" position="top" formatter={(v: any) => yTickFmt(Number(v))} style={{ fontSize: 10, fill: '#4f46e5', fontWeight: 600 }} />
                  </Bar>
                  <Bar yAxisId="pay" dataKey="payments" fill="url(#payGrad)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Donut — user status từ useAdminDashboardSummary */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Phân bổ người dùng</p>
            <p className="text-xs text-slate-400 mb-3">Theo trạng thái tài khoản</p>

            {summaryLoading ? (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : donutData.length === 0 ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-slate-300">
                <PieIcon className="w-8 h-8" />
                <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={68}
                      paddingAngle={3} dataKey="value" strokeWidth={0}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v: unknown) => [Number(v).toLocaleString('vi-VN'), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-2xl font-bold text-slate-800 -mt-1">
                  {totalUsersDonut.toLocaleString('vi-VN')}
                </p>
                <p className="text-center text-[11px] text-slate-400 mb-3">Tổng người dùng</p>
                <div className="space-y-1.5">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                        {d.name}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {d.value.toLocaleString('vi-VN')}
                        {totalUsersDonut > 0 && (
                          <span className="font-normal text-slate-400 ml-1.5">
                            {((d.value / totalUsersDonut) * 100).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ Bottom ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">

            {/* Docker Containers — useAdminDockerContainers trả về array trực tiếp */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-800">Docker Containers</p>
                </div>
                {totalContainers > 0 && (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    ● {runningCount}/{totalContainers} running
                  </span>
                )}
              </div>

              {containers.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  Không lấy được thông tin container
                </div>
              ) : (
                <div>
                  {containers.map((c, idx) => {
                    const state = getContainerState(c)
                    const name = getContainerName(c)
                    const image = getContainerImage(c)
                    const status = getContainerStatus(c)
                    return (
                      <div
                        key={c.ID ?? c.containerId ?? idx}
                        className={`flex items-center gap-3 py-3 ${idx < containers.length - 1 ? 'border-b border-slate-50' : ''}`}
                      >
                        <ContainerDot state={state} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800">{name}</p>
                          {image && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{image}</p>}
                        </div>
                        <ContainerStateBadge state={state} />
                        {status && (
                          <span className="text-[11px] text-slate-400 hidden sm:block truncate max-w-[120px]">{status}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <Link href="/admin/system" className="flex items-center justify-center gap-1 mt-4 text-[11px] text-teal-600 hover:text-teal-700 font-medium">
                Xem chi tiết hệ thống <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Audit Logs — useAdminAuditLogs */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-800">Hoạt động gần đây</p>
                <Link href="/admin/audit-logs" className="text-[11px] text-teal-600 hover:text-teal-700 font-medium">
                  Xem tất cả
                </Link>
              </div>
              {(auditLogs?.items?.length ?? 0) === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Chưa có hoạt động</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs!.items.map(log => (
                    <div key={log.id} className="flex items-start gap-3">
                      <AuditIcon log={log} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-slate-700 leading-snug">
                          <span className="font-semibold">{log.adminUser?.fullName ?? 'System'}</span>
                          {' '}
                          <span className="text-slate-500">{log.action?.replace(/_/g, ' ').toLowerCase()}</span>
                          {log.targetId && (
                            <span className="font-mono text-[10px] text-slate-400 ml-1">#{log.targetId.slice(0, 8)}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <AuditTag log={log} />
                          <span className={`text-[10px] font-medium ${log.result === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {log.result}
                          </span>
                          <span className="text-[10px] text-slate-400">{timeAgo(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-sm font-semibold text-slate-800 mb-3">Thao tác nhanh</p>
              <div className="space-y-1.5">
                {[
                  { href: '/admin/users', icon: UserPlus, label: 'Người dùng', sub: 'Quản lý tài khoản', color: 'text-blue-500 bg-blue-50' },
                  { href: '/admin/families', icon: Home, label: 'Quản lý gia đình', sub: 'Xem và chỉnh sửa', color: 'text-teal-500 bg-teal-50' },
                  { href: '/admin/plans', icon: Crown, label: 'Gói dịch vụ', sub: 'Cấu hình gói', color: 'text-amber-500 bg-amber-50' },
                  { href: '/admin/revenue', icon: DollarSign, label: 'Doanh thu', sub: 'Xem chi tiết', color: 'text-emerald-500 bg-emerald-50' },
                ].map(({ href, icon: Icon, label, sub, color }) => (
                  <Link key={href} href={href}>
                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-400">{sub}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Stats từ API thật */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Thống kê nhanh</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Người dùng', value: summary?.users?.total },
                  { label: 'Gia đình', value: summary?.families?.total },
                  { label: 'Yêu cầu ht', value: joinRequests?.total ?? 0 },
                  { label: 'Doanh thu', value: null, formatted: formatVND(revenue?.totalRevenue) },
                ].map(({ label, value, formatted }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-slate-800 leading-tight">
                      {formatted ?? (value != null ? value.toLocaleString('vi-VN') : '—')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System health */}
            <div className={`rounded-xl border p-4 ${apiUp ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex items-center gap-2">
                {apiUp
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                }
                <p className="text-[12px] font-semibold text-slate-700">
                  API {apiUp ? 'hoạt động bình thường' : 'gặp sự cố'}
                </p>
              </div>
              {health?.database && (
                <p className="text-[11px] text-slate-500 mt-1 ml-6">
                  DB: {health.database.status ?? '—'}
                </p>
              )}
              {health?.backend?.uptimeSeconds != null && (
                <p className="text-[11px] text-slate-500 mt-0.5 ml-6">
                  Uptime: {Math.floor(health.backend.uptimeSeconds / 3600)}h {Math.floor((health.backend.uptimeSeconds % 3600) / 60)}m
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
