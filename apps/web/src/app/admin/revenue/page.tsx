'use client'
import { useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, CreditCard, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useAdminRevenueSummary, useAdminPayments, useAdminFamilies } from '@/hooks/useAdmin'
import type { AdminFamily } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']

const PAY_STATUS_CLS: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  FAILED:  'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
}

// Admin system colours: violet-600 / violet-700 / violet-800
const COL_DEFAULT = '#7C3AED'   // violet-600 — normal bar
const COL_PEAK    = '#4C1D95'   // violet-900 — highest-revenue bar (emphasis)
const COL_ZERO    = '#DDD6FE'   // violet-200 — months with no data

const CURRENT_YEAR = new Date().getFullYear()

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtVND(n?: number) {
  if (!n) return '0 ₫'
  return Number(n).toLocaleString('vi-VN') + ' ₫'
}

function fmtShort(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} Tỷ`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')} Tr`
  if (v >= 1_000)         return `${Math.round(v / 1_000)}K`
  return v > 0 ? String(Math.round(v)) : ''
}

// ── Data type ────────────────────────────────────────────────────────────────

interface ChartEntry {
  name: string
  revenue: number
  growth: number | null   // % vs previous month; null for first month
}

// ── Custom X-axis tick: month name + growth arrow below ──────────────────────

interface MonthTickProps {
  x?: number
  y?: number
  payload?: { value: string }
  chartData: ChartEntry[]
}

function MonthTick({ x = 0, y = 0, payload, chartData }: MonthTickProps) {
  if (!payload) return null
  const entry = chartData.find((d) => d.name === payload.value)
  const gr = entry?.growth ?? null

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Month label */}
      <text textAnchor="middle" fill="hsl(215.4 16.3% 46.9%)" fontSize={11} dy={13}>
        {payload.value}
      </text>
      {/* Growth arrow — only when we have a previous month */}
      {gr !== null && entry && entry.revenue > 0 && (
        <text
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={gr >= 0 ? '#059669' : '#DC2626'}
          dy={26}
        >
          {gr >= 0 ? `▲ +${gr.toFixed(1)}%` : `▼ ${gr.toFixed(1)}%`}
        </text>
      )}
    </g>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ChartEntry
  const gr = d.growth

  return (
    <div style={{
      background: '#1E1B4B',
      border: '1px solid rgba(167,139,250,.2)',
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: '0 12px 32px rgba(0,0,0,.35)',
      minWidth: 188,
      pointerEvents: 'none',
    }}>
      <p style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {d.name}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20 }}>
        <span style={{ color: 'rgba(237,233,255,.5)', fontSize: 11 }}>Doanh thu</span>
        <span style={{ color: '#EDE9FF', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {fmtVND(d.revenue)}
        </span>
      </div>

      {gr !== null && d.revenue > 0 && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid rgba(237,233,255,.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: gr >= 0 ? '#34D399' : '#F87171',
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ fontSize: 14 }}>{gr >= 0 ? '▲' : '▼'}</span>
          <span>{gr >= 0 ? '+' : ''}{gr.toFixed(1)}%</span>
          <span style={{ color: 'rgba(237,233,255,.4)', fontWeight: 400, fontSize: 11 }}>vs tháng trước</span>
        </div>
      )}

      {d.revenue === 0 && (
        <p style={{ color: 'rgba(237,233,255,.35)', fontSize: 11, marginTop: 6 }}>Chưa có doanh thu</p>
      )}
    </div>
  )
}

// ── Average line label ────────────────────────────────────────────────────────

interface AvgLabelProps {
  viewBox?: { x?: number; y?: number; width?: number }
  value?: number
}

function AvgLabel({ viewBox, value }: AvgLabelProps) {
  if (!viewBox || value === undefined) return null
  const { x = 0, y = 0, width = 0 } = viewBox
  return (
    <g>
      <rect
        x={x + width + 4}
        y={y - 9}
        width={52}
        height={16}
        rx={3}
        fill="rgba(124,58,237,.12)"
      />
      <text
        x={x + width + 30}
        y={y + 3}
        fill="rgba(124,58,237,.75)"
        fontSize={9}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        TB {fmtShort(value)}
      </text>
    </g>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RevenueAdminPage() {
  const [year, setYear]           = useState(CURRENT_YEAR)
  const [payStatus, setPayStatus] = useState('ALL')

  const { data: summary,  isLoading: sumLoading } = useAdminRevenueSummary()
  // Fetch paid payments for chart — limit 50 matches BE max for this endpoint
  const { data: allPaid } = useAdminPayments({ limit: 50, status: 'PAID' })
  // Fetch filtered payments for the table
  const { data: payments, isLoading: payLoading } = useAdminPayments({
    limit: 50,
    status: payStatus === 'ALL' ? undefined : payStatus,
  })
  const { data: familiesRaw, isLoading: familiesLoading } = useAdminFamilies({ limit: 100 })

  // Normalise families — BE may return Paginated<AdminFamily> or raw AdminFamily[]
  const familiesList = useMemo<AdminFamily[]>(() => {
    if (!familiesRaw) return []
    if (Array.isArray(familiesRaw)) return familiesRaw as AdminFamily[]
    return (familiesRaw as { items?: AdminFamily[] }).items ?? []
  }, [familiesRaw])

  // familyId → { name, manager } — manager sourced from embedded members if present
  const familyMap = useMemo(() => {
    const map = new Map<string, { name: string; manager: string }>()
    for (const f of familiesList) {
      const mgr = f.members?.find((m) => m.familyRole === 'FAMILY_MANAGER')
      map.set(f.id, {
        name:    f.name,
        manager: mgr?.user?.fullName ?? mgr?.displayName ?? '',
      })
    }
    return map
  }, [familiesList])

  // Build chart: group PAID payments by month of selected year
  const chartData: ChartEntry[] = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      name: MONTH_NAMES[i],
      revenue: 0,
      growth: null as number | null,
    }))
    const items = Array.isArray(allPaid)
      ? (allPaid as unknown as { createdAt?: string; amount?: number }[])
      : (allPaid as unknown as { items?: { createdAt?: string; amount?: number }[] })?.items ?? []
    items.forEach((p) => {
      if (!p.createdAt || !p.amount) return
      const d = new Date(p.createdAt)
      if (d.getFullYear() !== year) return
      byMonth[d.getMonth()].revenue += Number(p.amount)
    })
    return byMonth.map((d, i) => ({
      ...d,
      growth:
        i === 0 || byMonth[i - 1].revenue === 0
          ? null
          : parseFloat(
              (((d.revenue - byMonth[i - 1].revenue) / byMonth[i - 1].revenue) * 100).toFixed(1),
            ),
    }))
  }, [allPaid, year])

  const nonZero    = chartData.filter((d) => d.revenue > 0)
  const avgRevenue = nonZero.length ? nonZero.reduce((s, d) => s + d.revenue, 0) / nonZero.length : 0
  const maxRev     = nonZero.length ? Math.max(...nonZero.map((d) => d.revenue)) : 0
  const totalRev   = nonZero.reduce((s, d) => s + d.revenue, 0)
  const chartLoading = !allPaid

  return (
    <div>
      <Topbar title="Doanh thu" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-5">

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        {sumLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { icon: TrendingUp,  label: 'Tổng doanh thu',  value: fmtVND(summary?.totalRevenue),  color: 'text-violet-600 bg-violet-50' },
              { icon: CreditCard,  label: 'Tổng thanh toán', value: summary?.totalPayments ?? '—',  color: 'text-blue-600 bg-blue-50' },
              { icon: CheckCircle, label: 'Thành công',      value: summary?.paidPayments ?? '—',   color: 'text-emerald-600 bg-emerald-50' },
              { icon: XCircle,     label: 'Thất bại',        value: summary?.failedPayments ?? '—', color: 'text-red-500 bg-red-50' },
            ] as const).map(({ icon: Icon, label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-none truncate">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Monthly column chart ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              {/* Title + sub-stats */}
              <div>
                <CardTitle className="text-sm font-semibold">Doanh thu theo tháng</CardTitle>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Tổng năm {year}:&nbsp;
                    <span className="font-semibold text-violet-700">{fmtVND(totalRev || summary?.totalRevenue)}</span>
                  </span>
                  {avgRevenue > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Trung bình/tháng:&nbsp;
                      <span className="font-semibold text-foreground">{fmtShort(avgRevenue)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Legend */}
                <div className="hidden sm:flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-violet-600" />
                    Doanh thu
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className="inline-block w-5 h-0 border-t-2 border-dashed shrink-0"
                      style={{ borderColor: 'rgba(124,58,237,.4)' }}
                    />
                    Trung bình
                  </span>
                </div>

                {/* Year selector */}
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-5 pt-2">
            {chartLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 64, left: -10, bottom: 4 }}
                  barCategoryGap="34%"
                >
                  {/* Horizontal grid lines only */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(214.3 31.8% 91.4%)"
                    vertical={false}
                  />

                  {/* X axis: month + growth % tick */}
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    height={38}
                    tick={<MonthTick chartData={chartData} />}
                  />

                  {/* Y axis */}
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(215.4 16.3% 46.9%)' }}
                    tickFormatter={(v: number) => fmtShort(v)}
                    width={48}
                  />

                  {/* Tooltip */}
                  <Tooltip
                    content={<RevenueTooltip />}
                    cursor={{ fill: 'rgba(124,58,237,.05)', radius: 4 }}
                  />

                  {/* Average dashed reference line */}
                  {avgRevenue > 0 && (
                    <ReferenceLine
                      y={avgRevenue}
                      stroke="rgba(124,58,237,.35)"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      label={<AvgLabel value={avgRevenue} />}
                    />
                  )}

                  {/* Columns */}
                  <Bar
                    dataKey="revenue"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={46}
                    isAnimationActive
                    animationDuration={560}
                    animationEasing="ease-out"
                  >
                    {/* Color: peak bar darker, zero months muted */}
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.revenue === 0   ? COL_ZERO    :
                          entry.revenue === maxRev ? COL_PEAK :
                          COL_DEFAULT
                        }
                        opacity={entry.revenue === 0 ? 0.5 : 1}
                      />
                    ))}

                    {/* Value label above each bar */}
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      formatter={(v: number) => fmtShort(v)}
                      style={{ fontSize: 10, fill: '#5B21B6', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Payments table ────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              Lịch sử thanh toán ({payments?.total ?? 0})
            </CardTitle>
            <Select value={payStatus} onValueChange={setPayStatus}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['ALL', 'PAID', 'FAILED', 'PENDING'].map((s) => (
                  <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {payLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (payments?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có thanh toán nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2.5 pl-4">Gia đình</th>
                      <th className="text-left py-2.5">Gói</th>
                      <th className="text-left py-2.5">Số tiền</th>
                      <th className="text-left py-2.5">Trạng thái</th>
                      <th className="text-left py-2.5 pr-4">Ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments?.items ?? []).map((p) => {
                      // Try embedded family data first, then lookup map, then truncated id
                      const embedded = (p as Record<string, unknown>).family as
                        | { name?: string; members?: { familyRole?: string; user?: { fullName?: string }; displayName?: string }[] }
                        | undefined
                      const mapEntry  = familyMap.get(p.familyId ?? '')
                      const famName   = embedded?.name ?? mapEntry?.name
                      const famMgr    = embedded?.members?.find(m => m.familyRole === 'FAMILY_MANAGER')
                      const mgrName   = famMgr?.user?.fullName ?? famMgr?.displayName ?? mapEntry?.manager ?? ''
                      return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 pl-4 max-w-[180px]">
                          {famName ? (
                            <div>
                              <p className="text-xs font-semibold truncate">{famName}</p>
                              {mgrName && (
                                <p className="text-[11px] text-muted-foreground truncate">{mgrName}</p>
                              )}
                            </div>
                          ) : familiesLoading ? (
                            <span className="text-[11px] text-muted-foreground">Đang tải...</span>
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">{(p.familyId ?? '—').slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="py-2"><span className="text-xs font-semibold">{p.planCode ?? '—'}</span></td>
                        <td className="py-2 font-medium text-green-700 text-xs">{fmtVND(p.amount)}</td>
                        <td className="py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PAY_STATUS_CLS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                      </tr>
                      )
                    })}
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
