'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Home, Mail, Crown, TrendingUp, UserCheck, Shield, ArrowRight,
  Activity, Server, ClipboardList, Archive, GitBranch, Zap, DollarSign,
  BarChart3, PieChart as PieIcon, Sparkles, ChevronRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts'
import {
  useAdminUsers, useAdminFamilies, useAdminJoinRequests, useAdminSubscriptionPlans,
  useAdminSystemHealth, useAdminDockerContainers, useAdminRevenueSummary,
} from '@/hooks/useAdmin'
import { useAuth } from '@/context/AuthContext'

/* ─── Color Palettes (HSL-tailored, premium) ─────────────────────────────────── */

const USER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',    // emerald-500
  INACTIVE: '#94a3b8',  // slate-400
  SUSPENDED: '#f43f5e', // rose-500
}
const FAMILY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#6366f1',    // indigo-500
  PENDING: '#f59e0b',   // amber-500
  SUSPENDED: '#ef4444', // red-500
  EXPIRED: '#6b7280',   // gray-500
}
const USER_TYPE_COLORS: Record<string, string> = {
  NORMAL_USER: '#8b5cf6', // violet-500
  SYSTEM_ADMIN: '#ec4899', // pink-500
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Không hoạt động',
  SUSPENDED: 'Bị khoá',
  PENDING: 'Chờ duyệt',
  EXPIRED: 'Hết hạn',
}

/* ─── Utility ────────────────────────────────────────────────────────────────── */

function countBy<T>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const val = String(item[key])
    acc[val] = (acc[val] || 0) + 1
    return acc
  }, {})
}

function formatCurrency(value?: number) {
  if (!value) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

/* ─── Premium Tooltip ────────────────────────────────────────────────────────── */

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl px-4 py-2.5 text-xs">
      <p className="font-semibold text-slate-800">{STATUS_LABELS[payload[0].name] ?? payload[0].name}</p>
      <p className="text-slate-500 mt-0.5">{payload[0].value} mục</p>
    </div>
  )
}

/* ─── Chart Skeleton ─────────────────────────────────────────────────────────── */

function ChartSkeleton() {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center gap-2">
      <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground">Đang tải dữ liệu...</span>
    </div>
  )
}

/* ─── Stat Tile (Premium) ────────────────────────────────────────────────────── */

function StatTile({
  icon: Icon, label, value, sub, badge, color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number | string
  sub?: string
  badge?: string
  color: 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'indigo' | 'emerald'
}) {
  const themes = {
    blue:    { icon: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'ring-blue-100',    badge: 'bg-blue-50 text-blue-600' },
    green:   { icon: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100', badge: 'bg-emerald-50 text-emerald-600' },
    violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50',  ring: 'ring-violet-100',  badge: 'bg-violet-50 text-violet-600' },
    amber:   { icon: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'ring-amber-100',   badge: 'bg-amber-50 text-amber-600' },
    rose:    { icon: 'text-rose-600',    bg: 'bg-rose-50',    ring: 'ring-rose-100',    badge: 'bg-rose-50 text-rose-600' },
    indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-50',  ring: 'ring-indigo-100',  badge: 'bg-indigo-50 text-indigo-600' },
    emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100', badge: 'bg-emerald-50 text-emerald-600' },
  }
  const t = themes[color]
  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg border-slate-100 bg-white/80 backdrop-blur-sm">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ring-1 ${t.ring}`}>
            <Icon className={`w-5 h-5 ${t.icon}`} />
          </div>
          {badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold mt-3 leading-none tracking-tight">{value ?? '—'}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
}

/* ─── Quick Action Link (Premium) ────────────────────────────────────────────── */

function QuickAction({
  href, icon: Icon, label, description, color, count,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  color: string
  count?: number | string
}) {
  return (
    <Link href={href}>
      <div className="border border-slate-100 rounded-xl p-4 hover:bg-gradient-to-br hover:from-white hover:to-slate-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group bg-white h-full">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{description}</p>
        {count != null && (
          <p className="text-xs font-bold text-slate-600 mt-2">{count}</p>
        )}
      </div>
    </Link>
  )
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const { user } = useAuth()
  const { data: usersData, isLoading: usersLoading } = useAdminUsers({ limit: 100 })
  const { data: familiesData, isLoading: familiesLoading } = useAdminFamilies({ limit: 100 })
  const { data: joinRequestsData } = useAdminJoinRequests({ limit: 1 })
  const { data: plansData } = useAdminSubscriptionPlans({ limit: 20 })
  const { data: healthData } = useAdminSystemHealth()
  const { data: containersData } = useAdminDockerContainers()
  const { data: revenueSummary } = useAdminRevenueSummary()

  const users = usersData?.items ?? []
  const families = familiesData?.items ?? []
  const plans = plansData?.items ?? []

  // Docker containers — extract from nested data.items if present
  const dockerContainers = containersData && Array.isArray((containersData as any).items)
    ? (containersData as any).items
    : (Array.isArray(containersData) ? containersData : [])
  const runningContainers = dockerContainers.filter((c: any) => /run/i.test(c.state ?? c.State ?? ''))

  // Chart data
  const userStatusChartData = useMemo(() => {
    const c = countBy(users, 'accountStatus')
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [users])

  const userTypeChartData = useMemo(() => {
    const c = countBy(users, 'userType')
    return Object.entries(c).map(([name, value]) => ({
      name,
      value,
      label: name === 'SYSTEM_ADMIN' ? 'Admin' : 'User thường',
    }))
  }, [users])

  const familyStatusChartData = useMemo(() => {
    const c = countBy(families, 'status')
    return ['ACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED']
      .map((name) => ({ name, value: c[name] || 0 }))
      .filter((d) => d.value > 0)
  }, [families])

  // Computed stats
  const activeUsers = users.filter((u) => u.accountStatus === 'ACTIVE').length
  const suspendedUsers = users.filter((u) => u.accountStatus === 'SUSPENDED').length
  const activeFamilies = families.filter((f) => f.status === 'ACTIVE').length
  const activePlans = plans.filter((p) => p.isActive).length

  // MRR estimation
  const mrrEstimate = useMemo(() => {
    return plans.reduce((sum, p) => {
      if (!p.isActive || !p._count?.families) return sum
      const price = Number(p.annualPrice) || 0
      const isMonthly = p.planCode?.toUpperCase().includes('MONTH')
      const monthlyPrice = isMonthly ? price : price / 12
      return sum + monthlyPrice * (p._count.families ?? 0)
    }, 0)
  }, [plans])

  // System health status
  const apiStatus = healthData?.status ?? 'unknown'
  const isApiUp = apiStatus === 'ok' || apiStatus === 'UP'

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-4 md:p-6 space-y-6">

        {/* ═══ Welcome Banner ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-6 md:p-8 text-white">
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-xl" />
          <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full blur-lg" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Admin Dashboard</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold">
              {greeting}, {user?.displayName ?? 'Admin'} 👋
            </h1>
            <p className="text-sm text-white/70 mt-1 max-w-xl">
              Hệ thống Family Care đang vận hành{isApiUp ? ' ổn định' : ''}.{' '}
              {runningContainers.length > 0 && `${runningContainers.length} Docker container đang chạy. `}
              {(usersData?.total ?? 0) > 0 && `${usersData?.total} người dùng đã đăng ký. `}
              {activeFamilies > 0 && `${activeFamilies} gia đình đang hoạt động.`}
            </p>

            {/* Mini status indicators */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${isApiUp ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isApiUp ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                API {isApiUp ? 'Online' : 'Offline'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/80">
                <Server className="w-3 h-3" />
                {runningContainers.length}/{dockerContainers.length} Containers
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/80">
                <Crown className="w-3 h-3" />
                {activePlans} gói đang bán
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Stats Grid ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatTile
            icon={Users} label="Tổng người dùng" value={usersData?.total}
            badge={activeUsers > 0 ? `${Math.round((activeUsers / (usersData?.total || 1)) * 100)}% active` : undefined}
            color="blue"
          />
          <StatTile
            icon={UserCheck} label="Đang hoạt động" value={users.length ? activeUsers : undefined}
            sub={suspendedUsers ? `${suspendedUsers} tài khoản bị khoá` : 'Tất cả đang hoạt động'}
            color="emerald"
          />
          <StatTile
            icon={Home} label="Tổng gia đình" value={familiesData?.total}
            badge={activeFamilies > 0 ? `${activeFamilies} active` : undefined}
            color="violet"
          />
          <StatTile
            icon={DollarSign} label="Doanh thu ước tính (MRR)"
            value={mrrEstimate > 0 ? formatCurrency(mrrEstimate) : (revenueSummary?.totalRevenue ? formatCurrency(revenueSummary.totalRevenue) : '0 ₫')}
            sub={revenueSummary?.totalPayments ? `${revenueSummary.totalPayments} giao dịch` : undefined}
            color="amber"
          />
        </div>

        {/* ═══ Analytics Charts ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* User Status Donut */}
          <Card className="border-slate-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-0 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <PieIcon className="w-4 h-4 text-blue-500" />
                    Phân bố Người dùng
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Theo trạng thái tài khoản</p>
                </div>
                <span className="text-lg font-bold text-slate-800">{usersData?.total ?? '—'}</span>
              </div>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              {usersLoading ? <ChartSkeleton /> : userStatusChartData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={userStatusChartData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {userStatusChartData.map((entry) => (
                        <Cell key={entry.name} fill={USER_STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      formatter={(v) => STATUS_LABELS[v] ?? v}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* User Type Donut */}
          <Card className="border-slate-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-0 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-violet-500" />
                    Phân quyền Tài khoản
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Admin hệ thống vs Người dùng thường</p>
                </div>
                <span className="text-lg font-bold text-slate-800">{usersData?.total ?? '—'}</span>
              </div>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              {usersLoading ? <ChartSkeleton /> : userTypeChartData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={userTypeChartData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {userTypeChartData.map((entry) => (
                        <Cell key={entry.name} fill={USER_TYPE_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name === 'SYSTEM_ADMIN' ? 'Admin hệ thống' : 'Người dùng thường']}
                    />
                    <Legend
                      iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      formatter={(v) => v === 'SYSTEM_ADMIN' ? 'Admin hệ thống' : 'Người dùng thường'}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══ Family Status Bar Chart ═══ */}
        <Card className="border-slate-100 hover:shadow-md transition-shadow">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Gia đình theo Trạng thái
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Phân bố trạng thái hoạt động của tất cả gia đình</p>
              </div>
              <Link href="/admin/families" className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-0.5">
                Chi tiết <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-5">
            {familiesLoading ? <ChartSkeleton /> : familyStatusChartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={familyStatusChartData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => STATUS_LABELS[v] ?? v}
                  />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 } as any} />
                  <Bar dataKey="value" name="Gia đình" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {familyStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={FAMILY_STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ═══ Subscription Analytics & Plans ═══ */}
        {plans.length > 0 && (
          <Card className="border-slate-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    Phân tích Gói Thuê bao
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activePlans} gói đang hoạt động · MRR ước tính: {formatCurrency(mrrEstimate)}
                  </p>
                </div>
                <Link href="/admin/plans" className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-0.5">
                  Quản lý <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plans.map((p) => {
                  const price = Number(p.annualPrice) || 0
                  const isMonthly = p.planCode?.toUpperCase().includes('MONTH')
                  const familyCount = p._count?.families ?? 0
                  const totalFamilies = plans.reduce((s, pl) => s + (pl._count?.families ?? 0), 0)
                  const sharePercent = totalFamilies > 0 ? Math.round((familyCount / totalFamilies) * 100) : 0

                  return (
                    <div
                      key={p.id}
                      className={`relative border rounded-xl p-4 transition-all hover:shadow-md ${
                        !p.isActive ? 'opacity-50 bg-slate-50' : 'bg-white hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.planCode}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          p.isActive ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {p.isActive ? '● Active' : 'Off'}
                        </span>
                      </div>
                      <p className="font-bold text-base text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {price > 0 ? `${price.toLocaleString('vi-VN')} ₫ / ${isMonthly ? 'tháng' : 'năm'}` : 'Miễn phí'}
                      </p>

                      {/* Usage bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Gia đình đăng ký</span>
                          <span className="font-bold text-slate-600">{familyCount}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(sharePercent, 2)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400">{sharePercent}% thị phần</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ Quick Actions Grid ═══ */}
        <div>
          <h2 className="text-[11px] font-bold text-slate-400 mb-3 uppercase tracking-widest px-0.5 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Quản lý hệ thống
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <QuickAction href="/admin/users" icon={Users} label="Người dùng" description="Quản lý tài khoản, phân quyền" color="text-blue-500" count={`${usersData?.total ?? '—'} tài khoản`} />
            <QuickAction href="/admin/families" icon={Home} label="Gia đình" description="Quản lý hộ gia đình, thành viên" color="text-violet-500" count={`${familiesData?.total ?? '—'} gia đình`} />
            <QuickAction href="/admin/plans" icon={Crown} label="Gói thuê bao" description="Cấu hình gói dịch vụ, giá cả" color="text-amber-500" count={`${activePlans} đang bán`} />
            <QuickAction href="/admin/invitations" icon={Mail} label="Yêu cầu gia nhập" description="Duyệt lời mời tham gia gia đình" color="text-emerald-500" count={`${joinRequestsData?.total ?? '—'} yêu cầu`} />
            <QuickAction href="/admin/revenue" icon={TrendingUp} label="Doanh thu" description="Thống kê doanh thu, thanh toán" color="text-pink-500" />
            <QuickAction href="/admin/provisioning-logs" icon={GitBranch} label="Provisioning" description="Nhật ký khởi tạo workspace" color="text-cyan-500" />
            <QuickAction href="/admin/audit-logs" icon={ClipboardList} label="Audit Logs" description="Lịch sử thao tác hệ thống" color="text-orange-500" />
            <QuickAction href="/admin/system" icon={Server} label="Hệ thống" description="Docker, hạ tầng server, health" color="text-indigo-500" count={`${runningContainers.length} container`} />
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="flex items-center justify-between pt-2 pb-1 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            <span>SYSTEM_ADMIN — Family Care Admin Panel v1.0</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <Activity className="w-3 h-3" />
            <span>{new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
