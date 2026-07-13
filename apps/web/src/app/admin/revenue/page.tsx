'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, CreditCard, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { useAdminRevenueSummary, useAdminRevenueMonthly, useAdminPayments } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'

const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
const PAY_STATUS_CLS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
}

function fmtVND(n?: number) {
  if (!n) return '0 ₫'
  return Number(n).toLocaleString('vi-VN') + ' ₫'
}

const CURRENT_YEAR = new Date().getFullYear()

export default function RevenueAdminPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [payStatus, setPayStatus] = useState('ALL')

  const { data: summary, isLoading: sumLoading } = useAdminRevenueSummary()
  const { data: monthly, isLoading: monthlyLoading } = useAdminRevenueMonthly({ year })
  const { data: payments, isLoading: payLoading } = useAdminPayments({
    limit: 50,
    status: payStatus === 'ALL' ? undefined : payStatus,
  })

  const chartData = Array.isArray(monthly)
    ? monthly.map((m) => ({
        name: MONTH_NAMES[(m.month ?? 1) - 1],
        revenue: Number(m.revenue ?? 0),
      }))
    : []
  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1)

  return (
    <div>
      <Topbar title="Doanh thu" backHref="/admin" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Summary */}
        {sumLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: TrendingUp, label: 'Tổng doanh thu', value: fmtVND(summary?.totalRevenue), color: 'text-green-600 bg-green-50' },
              { icon: CreditCard, label: 'Tổng thanh toán', value: summary?.totalPayments ?? '—', color: 'text-blue-600 bg-blue-50' },
              { icon: CheckCircle, label: 'Thành công', value: summary?.paidPayments ?? '—', color: 'text-emerald-600 bg-emerald-50' },
              { icon: XCircle, label: 'Thất bại', value: summary?.failedPayments ?? '—', color: 'text-red-500 bg-red-50' },
            ].map(({ icon: Icon, label, value, color }) => (
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

        {/* Monthly bar chart */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Doanh thu theo tháng</CardTitle>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="pb-4">
            {monthlyLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Không có dữ liệu doanh thu năm {year}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip formatter={(v) => [fmtVND(Number(v)), 'Doanh thu']} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="revenue" radius={[4,4,0,0]} maxBarSize={48}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.revenue === maxRev ? '#7c3aed' : '#c4b5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payments list */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              Lịch sử thanh toán ({payments?.total ?? 0})
            </CardTitle>
            <Select value={payStatus} onValueChange={setPayStatus}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['ALL','PAID','FAILED','PENDING'].map((s) => (
                  <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {payLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (payments?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có thanh toán nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2.5 pl-4">Family ID</th>
                      <th className="text-left py-2.5">Gói</th>
                      <th className="text-left py-2.5">Số tiền</th>
                      <th className="text-left py-2.5">Trạng thái</th>
                      <th className="text-left py-2.5 pr-4">Ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments?.items ?? []).map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 pl-4 font-mono text-[11px] text-muted-foreground max-w-[120px] truncate">{p.familyId ?? '—'}</td>
                        <td className="py-2"><span className="text-xs font-semibold">{p.planCode ?? '—'}</span></td>
                        <td className="py-2 font-medium text-green-700 text-xs">{fmtVND(p.amount)}</td>
                        <td className="py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PAY_STATUS_CLS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                      </tr>
                    ))}
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
