'use client'
/**
 * @module UpgradePlanDialog
 * @description Dialog nâng cấp gói thuê bao gia đình.
 *
 * Hiển thị tất cả các gói đang hoạt động theo dạng lưới (tối đa 3 cột).
 * Mỗi gói hiển thị tên, giá, giới hạn thành viên/nhiệm vụ và danh sách tính năng.
 *
 * Luồng thanh toán:
 * - Mock mode: xác nhận ngay lập tức, làm mới dữ liệu gia đình và lịch sử thanh toán.
 * - Stripe mode: chuyển hướng trình duyệt đến trang Stripe Checkout.
 *
 * Gói hiện tại và gói miễn phí được vô hiệu hoá nút chọn.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Crown } from 'lucide-react'
import { startCheckout } from '@/lib/payments'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

/**
 * Thông tin một gói thuê bao trả về từ API `/admin/plans`.
 * @property billingPeriod - Chu kỳ thanh toán: `'MONTHLY'`, `'YEARLY'`, `'LIFETIME'`, `'FREE'`
 * @property maxMembers - Giới hạn thành viên; `null` nghĩa là không giới hạn
 * @property maxTasksPerMonth - Giới hạn nhiệm vụ mỗi tháng; `null` nghĩa là không giới hạn
 * @property features - Danh sách tính năng hiển thị dạng bullet list
 */
interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  price: number | string
  currency: string
  billingPeriod: string
  maxMembers: number | null
  maxTasksPerMonth: number | null
  features: string[]
  isActive: boolean
}

/**
 * Định dạng giá tiền và chu kỳ thanh toán thành chuỗi hiển thị thân thiện.
 * Gói miễn phí (price = 0) trả về `'Miễn phí'`.
 *
 * @param p - Đối tượng gói thuê bao
 * @returns Chuỗi giá, ví dụ: `"99.000 VND/tháng"` hoặc `"Miễn phí"`
 */
function formatPrice(p: Plan) {
  const n = typeof p.price === 'string' ? Number(p.price) : p.price
  if (n === 0) return 'Miễn phí'
  const periodLabel: Record<string, string> = { MONTHLY: '/tháng', YEARLY: '/năm', LIFETIME: 'vĩnh viễn', FREE: '' }
  return `${n.toLocaleString('vi-VN')} ${p.currency}${periodLabel[p.billingPeriod] ?? ''}`
}

/**
 * Dialog chọn và nâng cấp gói thuê bao.
 *
 * @param open - Trạng thái mở/đóng dialog
 * @param onOpenChange - Callback khi trạng thái dialog thay đổi
 * @param currentPlanId - ID gói thuê bao hiện tại của gia đình (dùng để đánh dấu "Gói hiện tại")
 */
export function UpgradePlanDialog({
  open,
  onOpenChange,
  currentPlanId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentPlanId?: string | null
}) {
  const qc = useQueryClient()
  /** ID gói đang được xử lý thanh toán, dùng để hiển thị spinner đúng nút */
  const [pendingId, setPendingId] = useState<string | null>(null)

  /** Tải danh sách gói từ API, chỉ khi dialog đang mở */
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['public-plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data.plans).catch(() => []),
    enabled: open, // Chỉ fetch khi dialog mở để tránh request thừa
  })

  /** Mutation xử lý nâng cấp gói: khởi tạo checkout và xử lý kết quả */
  const upgradeMut = useMutation({
    mutationFn: async (planId: string) => {
      setPendingId(planId)
      return startCheckout({ type: 'SUBSCRIPTION', planId })
    },
    onSuccess: (instant) => {
      if (instant) {
        // Mock mode: thanh toán thành công ngay, làm mới cache và đóng dialog
        toast.success('🎉 Nâng cấp gói thành công!')
        qc.invalidateQueries({ queryKey: ['family'] })
        qc.invalidateQueries({ queryKey: ['payment-history'] })
        onOpenChange(false)
      }
      // Stripe mode: trình duyệt đã redirect, không cần làm gì thêm ở đây
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Thanh toán thất bại')
    },
    // Reset pendingId dù thành công hay thất bại
    onSettled: () => setPendingId(null),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Nâng cấp gói thuê bao
          </DialogTitle>
          <DialogDescription>
            Chọn gói phù hợp để mở khóa tính năng cao cấp cho cả gia đình
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chỉ hiển thị các gói đang hoạt động */}
            {plans.filter((p) => p.isActive).map((p) => {
              const isCurrent = currentPlanId === p.id
              const isFree = Number(p.price) === 0
              return (
                <div
                  key={p.id}
                  className={cn(
                    'border rounded-xl p-5 flex flex-col gap-3',
                    // Gói hiện tại được highlight bằng viền và nền xanh
                    isCurrent && 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/30',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{p.name}</h3>
                      {isCurrent && <Badge>Gói hiện tại</Badge>}
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatPrice(p)}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>

                  <div className="text-sm space-y-1.5 flex-1">
                    {/* Hiển thị giới hạn; null nghĩa là không giới hạn (∞) */}
                    <div className="text-xs text-muted-foreground">
                      {p.maxMembers == null ? '∞ thành viên' : `Tối đa ${p.maxMembers} thành viên`}
                      {' · '}
                      {p.maxTasksPerMonth == null ? '∞ task/tháng' : `${p.maxTasksPerMonth} task/tháng`}
                    </div>
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-gray-700">
                        <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => upgradeMut.mutate(p.id)}
                    // Vô hiệu hoá nếu: đang dùng gói này, đang xử lý thanh toán, hoặc là gói miễn phí
                    disabled={isCurrent || upgradeMut.isPending || isFree}
                    variant={isCurrent ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {pendingId === p.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</>
                    ) : isCurrent ? 'Đang dùng' : isFree ? 'Miễn phí' : 'Chọn gói này'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Thông báo chế độ mock cho môi trường phát triển */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          💡 Đang ở chế độ mock — thanh toán sẽ tự động xác nhận. Cấu hình <code>STRIPE_SECRET_KEY</code> để bật Stripe thật.
        </p>
      </DialogContent>
    </Dialog>
  )
}
