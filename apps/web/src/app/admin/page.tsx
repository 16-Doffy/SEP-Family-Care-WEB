'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Home, Mail, Crown, TrendingUp, UserCheck, Shield, ArrowRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  useAdminUsers, useAdminFamilies, useAdminJoinRequests, useAdminSubscriptionPlans,
} from '@/hooks/useAdmin'

const USER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a',
  INACTIVE: '#94a3b8',
  SUSPENDED: '#dc2626',
}
const FAMILY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#2563eb',
  PENDING: '#d97706',
  SUSPENDED: '#dc2626',
  EXPIRED: '#6b7280',
}
const USER_TYPE_COLORS: Record<string, string> = {
  NORMAL_USER: '#7c3aed',
  SYSTEM_ADMIN: '#e11d48',
}

function countBy<T>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const val = String(item[key])
    acc[val] = (acc[val] || 0) + 1
    return acc
  }, {})
}

function ChartSkeleton() {
  return <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Đang tải...</div>
}

function StatTile({
  icon: Icon, label, value, sub, color,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number | string; sub?: string; color: 'blue' | 'green' | 'violet' | 'amber' | 'rose' }) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    violet: 'text-violet-600 bg-violet-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
  }
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none">{value ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLink({
  href, icon: Icon, label, sub, color,
}: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; sub: string; color: string }) {
  return (
    <Link href={href}>
      <div className="border rounded-lg p-3 hover:bg-muted/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-2">
          <Icon className={`w-4 h-4 mt-0.5 ${color}`} />
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm font-medium mt-2">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </Link>
  )
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} mục</p>
    </div>
  )
}

export default function AdminPage() {
  const { data: usersData, isLoading: usersLoading } = useAdminUsers({ limit: 100 })
  const { data: familiesData, isLoading: familiesLoading } = useAdminFamilies({ limit: 100 })
  const { data: joinRequestsData } = useAdminJoinRequests({ limit: 1 })
  const { data: plansData } = useAdminSubscriptionPlans({ limit: 20 })

  const users = usersData?.items ?? []
  const families = familiesData?.items ?? []
  const plans = plansData?.items ?? []

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

  const activeUsers = users.filter((u) => u.accountStatus === 'ACTIVE').length
  const suspendedUsers = users.filter((u) => u.accountStatus === 'SUSPENDED').length
  const activePlans = plans.filter((p) => p.isActive).length

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={Users} label="Tổng người dùng" value={usersData?.total} color="blue" />
          <StatTile icon={UserCheck} label="Đang hoạt động" value={users.length ? activeUsers : undefined} sub={suspendedUsers ? `${suspendedUsers} bị khoá` : undefined} color="green" />
          <StatTile icon={Home} label="Tổng gia đình" value={familiesData?.total} color="violet" />
          <StatTile icon={Mail} label="Yêu cầu gia nhập" value={joinRequestsData?.total} color="amber" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-sm font-semibold">Người dùng theo trạng thái</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {usersLoading ? <ChartSkeleton /> : userStatusChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={userStatusChartData}
                      cx="50%" cy="50%"
                      innerRadius={58} outerRadius={88}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {userStatusChartData.map((entry) => (
                        <Cell key={entry.name} fill={USER_STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-sm font-semibold">Loại tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {usersLoading ? <ChartSkeleton /> : userTypeChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={userTypeChartData}
                      cx="50%" cy="50%"
                      innerRadius={58} outerRadius={88}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {userTypeChartData.map((entry) => (
                        <Cell key={entry.name} fill={USER_TYPE_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name === 'SYSTEM_ADMIN' ? 'Admin hệ thống' : 'User thường']}
                    />
                    <Legend
                      iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(v) => v === 'SYSTEM_ADMIN' ? 'Admin hệ thống' : 'User thường'}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Family status bar chart */}
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-sm font-semibold">Gia đình theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {familiesLoading ? <ChartSkeleton /> : familyStatusChartData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">Không có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={familyStatusChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="value" name="Gia đình" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {familyStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={FAMILY_STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plans summary */}
        {plans.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                <Crown className="w-4 h-4 inline mr-1.5 text-amber-500" />
                Gói thuê bao ({activePlans} đang hoạt động)
              </CardTitle>
              <Link href="/admin/plans" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                Quản lý <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((p) => (
                  <div key={p.id} className={`border rounded-lg p-3 ${!p.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-muted-foreground tracking-wide">{p.planCode}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Number(p.annualPrice) ? `${Number(p.annualPrice).toLocaleString('vi-VN')} VND / ${p.planCode.toUpperCase().includes('MONTH') ? 'tháng' : 'năm'}` : 'Miễn phí'}
                    </p>
                    {p._count != null && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">{p._count.families} gia đình đang dùng</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick nav */}
        <div>
          <h2 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider px-0.5">Quản lý hệ thống</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <QuickLink href="/admin/users" icon={Users} label="Người dùng" sub={`${usersData?.total ?? '—'} tài khoản`} color="text-blue-600" />
            <QuickLink href="/admin/families" icon={Home} label="Gia đình" sub={`${familiesData?.total ?? '—'} gia đình`} color="text-violet-600" />
            <QuickLink href="/admin/plans" icon={Crown} label="Gói thuê bao" sub={`${activePlans} đang hoạt động`} color="text-amber-600" />
            <QuickLink href="/admin/invitations" icon={Mail} label="Yêu cầu gia nhập" sub={`${joinRequestsData?.total ?? '—'} tổng cộng`} color="text-green-600" />
          </div>
        </div>

        {/* Admin badge */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Shield className="w-3.5 h-3.5" />
          <span>SYSTEM_ADMIN — Family Care Admin Panel</span>
        </div>
      </div>
    </div>
  )
}
