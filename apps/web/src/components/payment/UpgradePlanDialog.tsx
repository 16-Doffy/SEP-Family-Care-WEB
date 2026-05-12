'use client'
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

function formatPrice(p: Plan) {
  const n = typeof p.price === 'string' ? Number(p.price) : p.price
  if (n === 0) return 'Miễn phí'
  const periodLabel: Record<string, string> = { MONTHLY: '/tháng', YEARLY: '/năm', LIFETIME: 'vĩnh viễn', FREE: '' }
  return `${n.toLocaleString('vi-VN')} ${p.currency}${periodLabel[p.billingPeriod] ?? ''}`
}

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
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['public-plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data.plans).catch(() => []),
    enabled: open,
  })

  const upgradeMut = useMutation({
    mutationFn: async (planId: string) => {
      setPendingId(planId)
      return startCheckout({ type: 'SUBSCRIPTION', planId })
    },
    onSuccess: (instant) => {
      if (instant) {
        toast.success('🎉 Nâng cấp gói thành công!')
        qc.invalidateQueries({ queryKey: ['family'] })
        qc.invalidateQueries({ queryKey: ['payment-history'] })
        onOpenChange(false)
      }
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Thanh toán thất bại')
    },
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
            {plans.filter((p) => p.isActive).map((p) => {
              const isCurrent = currentPlanId === p.id
              const isFree = Number(p.price) === 0
              return (
                <div
                  key={p.id}
                  className={cn(
                    'border rounded-xl p-5 flex flex-col gap-3',
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

        <p className="text-xs text-muted-foreground text-center pt-2">
          💡 Đang ở chế độ mock — thanh toán sẽ tự động xác nhận. Cấu hình <code>STRIPE_SECRET_KEY</code> để bật Stripe thật.
        </p>
      </DialogContent>
    </Dialog>
  )
}
