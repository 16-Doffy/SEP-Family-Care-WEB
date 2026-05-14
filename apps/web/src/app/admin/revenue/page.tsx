/**
 * Trang thống kê doanh thu admin — xem MRR, ARR, doanh thu 30 ngày và biểu đồ theo tháng.
 * Chỉ dành cho SUPER_ADMIN (được bảo vệ bởi AdminLayout).
 */
'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, DollarSign, CreditCard, Users, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useMemo } from 'react'

/** Dữ liệu thống kê doanh thu từ API `/admin/revenue` */
interface RevenueStats {
  totalRevenue: number
  last30dRevenue: number
  last30dCount: number
  last30dSubscriptionRevenue: number
  last30dTopupRevenue: number
  /** Monthly Recurring Revenue */
  mrr: number
  /** Annual Recurring Revenue */
  arr: number
  activeSubscriptions: number
  /** Dữ liệu doanh thu theo từng tháng (12 tháng gần nhất) */
  monthlyBreakdown: Array<{ month: string; total: number; count: number }>
}

/**
 * Trang doanh thu admin với biểu đồ cột tự vẽ bằng CSS.
 * Chiều cao mỗi cột được tính theo tỷ lệ phần trăm so với tháng có doanh thu cao nhất.
 */
export default function RevenueAdminPage() {
  const { data, isLoading } = useQuery<RevenueStats>({
    queryKey: ['admin-revenue'],
    queryFn: () => api.get('/admin/revenue').then((r) => r.data),
  })

  /**
   * Giá trị doanh thu cao nhất trong 12 tháng, dùng để tính tỷ lệ chiều cao biểu đồ.
   * Đặt giá trị mặc định là 1 để tránh chia cho 0 khi chưa có dữ liệu.
   */
  const maxMonthly = useMemo(() => {
    if (!data?.monthlyBreakdown.length) return 1
    return Math.max(...data.monthlyBreakdown.map((m) => m.total), 1)
  }, [data])

  /**
   * Xuất dữ liệu doanh thu theo tháng ra file CSV.
   * Thêm BOM (﻿) ở đầu để Excel/Google Sheets nhận diện đúng UTF-8.
   */
  const exportCsv = () => {
    if (!data) return
    const rows = [
      ['Month', 'Total Revenue (VND)', 'Payment Count'],
      ...data.monthlyBreakdown.map((m) => [m.month, m.total, m.count]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    // BOM (Byte Order Mark) để Excel nhận diện mã hóa UTF-8 đúng cách
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Topbar title="Thống kê doanh thu" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Tổng quan doanh thu, MRR, ARR và biểu đồ 12 tháng gần nhất
          </p>
          <Button variant="outline" onClick={exportCsv} disabled={!data} className="gap-2">
            <Download className="w-4 h-4" /> Xuất CSV
          </Button>
        </div>

        {isLoading || !data ? (
          <p className="text-muted-foreground">Đang tải...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<DollarSign className="w-7 h-7 text-green-600" />}
                label="MRR"
                value={formatCurrency(data.mrr)}
                hint="Monthly Recurring Revenue"
              />
              <StatCard
                icon={<TrendingUp className="w-7 h-7 text-blue-600" />}
                label="ARR"
                value={formatCurrency(data.arr)}
                hint="Annual Recurring Revenue"
              />
              <StatCard
                icon={<CreditCard className="w-7 h-7 text-purple-600" />}
                label="Doanh thu 30 ngày"
                value={formatCurrency(data.last30dRevenue)}
                hint={`${data.last30dCount} giao dịch`}
              />
              <StatCard
                icon={<Users className="w-7 h-7 text-amber-600" />}
                label="Subscription đang hoạt động"
                value={String(data.activeSubscriptions)}
                hint="Gia đình trả phí"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Doanh thu 30 ngày theo loại</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Row label="Đăng ký gói" value={data.last30dSubscriptionRevenue} total={data.last30dRevenue} color="bg-blue-500" />
                  <Row label="Nạp ví" value={data.last30dTopupRevenue} total={data.last30dRevenue} color="bg-emerald-500" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Tổng doanh thu từ subscription</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                  <p className="text-4xl font-bold text-blue-600">{formatCurrency(data.totalRevenue)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Doanh thu theo tháng (12 tháng gần nhất)</CardTitle></CardHeader>
              <CardContent>
                {data.monthlyBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Chưa có giao dịch nào</p>
                ) : (
                  <div className="flex items-end gap-2 h-48 mt-2">
                    {data.monthlyBreakdown.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                        <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 truncate w-full text-center">
                          {formatCurrency(m.total)}
                        </div>
                        <div
                          className="w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t cursor-pointer"
                          style={{ height: `${(m.total / maxMonthly) * 100}%`, minHeight: m.total > 0 ? '4px' : '0' }}
                          title={`${m.month}: ${formatCurrency(m.total)} (${m.count} giao dịch)`}
                        />
                        <div className="text-[10px] text-muted-foreground truncate w-full text-center">
                          {m.month.slice(5)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Card hiển thị một chỉ số thống kê với icon, giá trị chính và gợi ý phụ.
 * @param icon - Icon React component
 * @param label - Nhãn chỉ số
 * @param value - Giá trị hiển thị lớn
 * @param hint - Thông tin bổ sung nhỏ bên dưới (tùy chọn)
 */
function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-2xl font-bold truncate">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Thanh tiến độ hiển thị tỷ lệ phần trăm của một loại doanh thu so với tổng.
 * @param label - Nhãn loại doanh thu
 * @param value - Giá trị doanh thu
 * @param total - Tổng doanh thu để tính phần trăm
 * @param color - Class màu Tailwind cho thanh tiến độ
 */
function Row({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{formatCurrency(value)} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div className={color} style={{ width: `${pct}%`, height: '100%' }} />
      </div>
    </div>
  )
}
