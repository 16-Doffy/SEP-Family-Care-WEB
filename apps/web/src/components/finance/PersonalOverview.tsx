/**
 * @file PersonalOverview.tsx
 * @description Tab "Tổng quan của tôi" cho FAMILY_MEMBER — chỉ hiển thị số
 * liệu của chính họ (thu, chi, dư, hạn mức), KHÔNG thấy của thành viên khác.
 *
 * Phụ huynh có FinanceOverview riêng (toàn gia đình).
 */
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, cn } from '@/lib/utils'
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Info,
} from 'lucide-react'
import type { FinanceWarning, MonthlySummary } from '@/hooks/useFinance'

interface Props {
  summary?: MonthlySummary
  warnings?: FinanceWarning[]
  currentMemberId?: string
  personalWalletBalance?: number
}

export function PersonalOverview({ summary, warnings, currentMemberId, personalWalletBalance }: Props) {
  if (!summary || !currentMemberId) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Đang tải...</p>
  }
  const me = summary.perMember.find((m) => m.memberId === currentMemberId)
  if (!me) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Không tìm thấy dữ liệu của bạn</p>
  }

  const surplus = me.actualIncome - me.actualPersonalExpense
  const hasIncome = me.hasIncomeRecorded
  const surplusColor = surplus >= 0 ? 'text-green-600' : 'text-red-600'

  // Cảnh báo: chỉ giữ BUDGET_WARNING liên quan đến chính mình
  const myWarnings =
    warnings?.filter(
      (w) =>
        w.code === 'BUDGET_WARNING' &&
        (w.metadata as { memberId?: string } | undefined)?.memberId === currentMemberId,
    ) ?? []

  return (
    <div className="space-y-4">
      {myWarnings.length > 0 && <WarningList warnings={myWarnings} />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ví cá nhân của tôi"
          value={formatCurrency(personalWalletBalance ?? 0)}
          hint={`Tháng ${summary.month}/${summary.year}`}
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Thu nhập thực tế"
          value={hasIncome ? formatCurrency(me.actualIncome) : 'Chưa ghi nhận'}
          hint={
            hasIncome
              ? `Dự kiến ${formatCurrency(me.plannedIncome)}`
              : 'Hãy "Ghi thu nhập" khi có lương về'
          }
          icon={TrendingUp}
          tone="green"
          valueClassName={hasIncome ? undefined : 'text-gray-400 text-lg'}
        />
        <StatCard
          label="Chi cá nhân thực tế"
          value={formatCurrency(me.actualPersonalExpense)}
          hint={
            me.personalSpendingLimit
              ? `Hạn mức ${formatCurrency(me.personalSpendingLimit)}`
              : `Dự kiến ${formatCurrency(me.plannedPersonalExpense)}`
          }
          icon={TrendingDown}
          tone={me.isOverLimit ? 'red' : 'amber'}
          valueClassName={me.isOverLimit ? 'text-red-600' : undefined}
        />
        <StatCard
          label="Dư / Thiếu của tôi"
          value={hasIncome ? formatCurrency(surplus) : '—'}
          hint={
            hasIncome
              ? surplus >= 0
                ? 'Bạn đang tiết kiệm tốt'
                : 'Bạn đang chi quá thu'
              : 'Cần ghi thu nhập để tính'
          }
          icon={Sparkles}
          tone={hasIncome ? (surplus >= 0 ? 'green' : 'red') : 'amber'}
          valueClassName={hasIncome ? surplusColor : 'text-gray-400 text-lg'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tiến độ chi tiêu tháng này</CardTitle>
        </CardHeader>
        <CardContent>
          {me.personalSpendingLimit ? (
            <ProgressBar
              actual={me.actualPersonalExpense}
              limit={Number(me.personalSpendingLimit)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Bạn chưa đặt hạn mức cảnh báo. Sang tab <strong>Ngân sách</strong> để cài đặt.
            </p>
          )}
        </CardContent>
      </Card>
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

function ProgressBar({ actual, limit }: { actual: number; limit: number }) {
  const pct = Math.min(150, (actual / limit) * 100)
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Đã chi {formatCurrency(actual)} / {formatCurrency(limit)}</span>
        <span className={cn('font-medium', pct >= 100 ? 'text-red-600' : 'text-gray-700')}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full transition-all', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {pct >= 100 && (
        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3 h-3" /> Bạn đã vượt hạn mức tháng này.
        </p>
      )}
    </div>
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
