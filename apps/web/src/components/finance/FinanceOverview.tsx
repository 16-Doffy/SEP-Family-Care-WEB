/**
 * @file FinanceOverview.tsx
 * @description Tab "Tổng quan tài chính" — gồm card số liệu, biểu đồ thu-chi
 * 6 tháng, biểu đồ dự đoán quỹ 3 tháng tới, và banner cảnh báo.
 */
'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TrendingDown, TrendingUp, Wallet, Sparkles, AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Forecast, MonthlySummary, FinanceWarning } from '@/hooks/useFinance'

interface Props {
  summary?: MonthlySummary
  forecast?: Forecast
  warnings?: FinanceWarning[]
}

export function FinanceOverview({ summary, forecast, warnings }: Props) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Đang tải số liệu...</p>
  }

  const hasIncome = summary.actual.hasIncomeRecorded
  const surplusColor = summary.actual.surplus >= 0 ? 'text-green-600' : 'text-red-600'
  const plannedSurplusColor = summary.planned.surplus >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      {warnings && warnings.length > 0 && <WarningList warnings={warnings} />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Quỹ gia đình (ví chung)"
          value={formatCurrency(summary.jointWalletBalance)}
          hint={`Tháng ${summary.month}/${summary.year}`}
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Tổng thu thực tế"
          value={hasIncome ? formatCurrency(summary.actual.income) : 'Chưa ghi nhận'}
          hint={
            hasIncome
              ? `Dự kiến ${formatCurrency(summary.planned.income)}`
              : 'Hãy "Ghi thu nhập" để theo dõi'
          }
          icon={TrendingUp}
          tone="green"
          valueClassName={hasIncome ? undefined : 'text-gray-400 text-lg'}
        />
        <StatCard
          label="Tổng chi thực tế"
          value={formatCurrency(summary.actual.totalExpense)}
          hint={`Dự kiến ${formatCurrency(summary.planned.totalExpense)}`}
          icon={TrendingDown}
          tone="amber"
        />
        <StatCard
          label={hasIncome ? 'Dư / Thiếu tháng này' : 'Dư / Thiếu (dự kiến)'}
          value={hasIncome ? formatCurrency(summary.actual.surplus) : formatCurrency(summary.planned.surplus)}
          hint={
            hasIncome
              ? `Dự kiến ${formatCurrency(summary.planned.surplus)}`
              : 'Chưa có thu thực tế'
          }
          icon={Sparkles}
          tone={
            (hasIncome ? summary.actual.surplus : summary.planned.surplus) >= 0 ? 'green' : 'red'
          }
          valueClassName={hasIncome ? surplusColor : plannedSurplusColor}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thu – Chi 6 tháng gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart forecast={forecast} summary={summary} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dự đoán quỹ 3 tháng tới</CardTitle>
          </CardHeader>
          <CardContent>
            <FundForecastChart forecast={forecast} />
            {forecast && (
              <p className="text-xs text-muted-foreground mt-2">
                Trung bình dư <span className={cn('font-medium', plannedSurplusColor)}>{formatCurrency(forecast.avgMonthlySurplus)}</span>/tháng. Số liệu dựa trên {forecast.history.length} tháng đã đóng.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  valueClassName,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'green' | 'amber' | 'red'
  valueClassName?: string
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }[tone]
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', valueClassName)}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', toneClass)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function IncomeExpenseChart({ forecast, summary }: { forecast?: Forecast; summary: MonthlySummary }) {
  // Ghép lịch sử snapshot + tháng hiện tại (current = actual)
  const history = (forecast?.history ?? []).map((h) => ({
    name: `${h.month}/${h.year}`,
    'Thu': h.totalIncome,
    'Chi': h.totalExpense,
  }))
  history.push({
    name: `${summary.month}/${summary.year}`,
    Thu: summary.actual.income,
    Chi: summary.actual.totalExpense,
  })

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Chưa có dữ liệu lịch sử. Cuối tháng hệ thống sẽ chốt số liệu để hiển thị xu hướng.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={history}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
        <Tooltip formatter={(v) => formatCurrency(typeof v === 'number' ? v : Number(v ?? 0))} />
        <Legend />
        <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Chi" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function FundForecastChart({ forecast }: { forecast?: Forecast }) {
  if (!forecast) return <p className="text-sm text-muted-foreground text-center py-8">Đang tải...</p>

  const past = forecast.history.map((h) => ({
    name: `${h.month}/${h.year}`,
    'Quỹ': h.jointWalletBalance,
    'Dự đoán': null as number | null,
  }))
  const todayBalance = forecast.startBalance
  const current = { name: 'Hiện tại', 'Quỹ': todayBalance, 'Dự đoán': todayBalance }
  const future = forecast.projections.map((p) => ({
    name: `${p.month}/${p.year}`,
    'Quỹ': null as number | null,
    'Dự đoán': p.projectedBalance,
  }))
  const data = [...past, current, ...future]

  if (data.length <= 1) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Chưa đủ dữ liệu để dự đoán. Hệ thống cần ít nhất 1 tháng đã đóng.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
        <Tooltip formatter={(v) => (v === null || v === undefined ? '—' : formatCurrency(typeof v === 'number' ? v : Number(v)))} />
        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
        <Line type="monotone" dataKey="Quỹ" stroke="#3b82f6" strokeWidth={2} dot />
        <Line type="monotone" dataKey="Dự đoán" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot />
      </LineChart>
    </ResponsiveContainer>
  )
}

function WarningList({ warnings }: { warnings: FinanceWarning[] }) {
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const tone = w.severity === 'danger' ? 'red' : w.severity === 'warning' ? 'amber' : 'blue'
        const Icon = tone === 'red' ? ShieldAlert : tone === 'amber' ? AlertTriangle : Info
        const wrapper = {
          red: 'bg-red-50 border-red-200 text-red-900',
          amber: 'bg-amber-50 border-amber-200 text-amber-900',
          blue: 'bg-blue-50 border-blue-200 text-blue-900',
        }[tone]
        const iconColor = {
          red: 'text-red-500',
          amber: 'text-amber-500',
          blue: 'text-blue-500',
        }[tone]
        return (
          <div key={i} className={cn('border rounded-lg p-3 flex gap-3 items-start', wrapper)}>
            <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', iconColor)} />
            <div className="text-sm">
              <p className="font-semibold">{w.title}</p>
              <p className="text-xs opacity-90 mt-0.5">{w.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

