/**
 * Trang Onboarding Wizard cho người đại diện gia đình mới đăng ký.
 *
 * Luồng chuẩn:
 *   1. WORKSPACE_CREATED — gia đình vừa được tạo, hiển thị welcome + chọn gói.
 *   2. PLAN_SELECTED     — user đã chọn gói, đang ở bước thanh toán.
 *   3. PAYMENT_VERIFIED  — thanh toán xong, hệ thống đang kích hoạt workspace.
 *   4. ACTIVE            — workspace sẵn sàng, redirect sang /dashboard.
 *
 * Nếu gia đình đã ACTIVE thì redirect ngay sang /dashboard.
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { startCheckout } from '@/lib/payments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Check, Crown, Sparkles, Users, HardDrive,
  CheckSquare, ArrowRight, Rocket,
} from 'lucide-react'
import toast from 'react-hot-toast'

/** Schema gói trả về từ /subscription-plans (chỉ trường UI cần dùng). */
interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  price: number | string
  priceMonthly: number | string | null
  priceYearly: number | string | null
  currency: string
  billingPeriod: string
  durationDays: number | null
  maxMembers: number | null
  maxTasksPerMonth: number | null
  albumStorageMb: number | null
  systemStorageMb: number | null
  aiEnabled: boolean
  aiFinanceEnabled: boolean
  advancedReports: boolean
  prioritySupport: boolean
  tier: number
  features: string[]
  isActive: boolean
  sortOrder: number
}

interface OnboardingStatus {
  step: 'WORKSPACE_CREATED' | 'PLAN_SELECTED' | 'PAYMENT_VERIFIED' | 'ACTIVE'
  isActive: boolean
  subscriptionStatus: string
  plan: { id: string; code: string; name: string } | null
}

function formatMb(mb: number | null): string {
  if (mb == null) return 'Không giới hạn'
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`
  return `${mb} MB`
}

function formatPrice(p: Plan): string {
  const n = typeof p.price === 'string' ? Number(p.price) : p.price
  if (n === 0) return 'Miễn phí'
  return `${n.toLocaleString('vi-VN')} ${p.currency}`
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const qc = useQueryClient()
  const [paying, setPaying] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  // Yêu cầu đăng nhập + chỉ chủ hộ (PARENT) được hoàn tất onboarding.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role === 'FAMILY_MEMBER') {
      // Thành viên thường không cần onboarding — vào thẳng dashboard.
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const { data: status, isLoading: statusLoading } = useQuery<OnboardingStatus>({
    queryKey: ['onboarding-status'],
    queryFn: () => api.get('/family/onboarding').then((r) => r.data),
    enabled: !!user?.familyMember,
    refetchInterval: (q) => (q.state.data?.isActive ? false : 4000),
  })

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans-public'],
    queryFn: () => api.get('/subscription-plans').then((r) => r.data.plans),
  })

  // Khi family đã ACTIVE thì điều hướng sang dashboard.
  useEffect(() => {
    if (status?.isActive) {
      qc.invalidateQueries({ queryKey: ['family'] })
      router.replace('/dashboard')
    }
  }, [status?.isActive, router, qc])

  const handleSelectAndPay = async (planId: string) => {
    setPaying(true)
    setSelectedPlanId(planId)
    try {
      // Đánh dấu PLAN_SELECTED để UI / phân tích biết user đã chọn gói nhưng chưa thanh toán.
      await api.patch('/family/onboarding', { step: 'PLAN_SELECTED' }).catch(() => {})

      // Khởi tạo checkout — finalize sẽ tự đặt family.activatedAt + onboardingStep = ACTIVE.
      const finished = await startCheckout({ type: 'SUBSCRIPTION', planId })

      if (finished) {
        toast.success('Đã kích hoạt workspace 🎉')
        await qc.invalidateQueries({ queryKey: ['onboarding-status'] })
        await qc.invalidateQueries({ queryKey: ['family'] })
        router.replace('/dashboard')
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thanh toán thất bại'
      toast.error(msg)
    } finally {
      setPaying(false)
    }
  }

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
            <Rocket className="w-3.5 h-3.5" /> Bước cuối: chọn gói cho gia đình
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Chào mừng đến Family Care 👋
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Family workspace của bạn đã được tạo. Chọn một gói sử dụng để kích hoạt
            các tính năng quản lý tài chính và công việc nhà cho cả gia đình.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-2xl mx-auto mb-10 grid grid-cols-4 gap-2 text-xs">
          {[
            { label: 'Tạo workspace', step: 'WORKSPACE_CREATED' },
            { label: 'Chọn gói', step: 'PLAN_SELECTED' },
            { label: 'Thanh toán', step: 'PAYMENT_VERIFIED' },
            { label: 'Kích hoạt', step: 'ACTIVE' },
          ].map((s, idx) => {
            const order = ['WORKSPACE_CREATED', 'PLAN_SELECTED', 'PAYMENT_VERIFIED', 'ACTIVE']
            const currentIdx = order.indexOf(status?.step ?? 'WORKSPACE_CREATED')
            const done = idx <= currentIdx
            return (
              <div
                key={s.step}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 ${
                  done ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 border'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-slate-200 text-[10px]">{idx + 1}</span>}
                <span className="truncate">{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans
            .filter((p) => p.isActive)
            .sort((a, b) => a.tier - b.tier)
            .map((p) => {
              const isPremium = p.tier >= 3
              const loading = paying && selectedPlanId === p.id
              return (
                <Card
                  key={p.id}
                  className={`relative ${isPremium ? 'border-amber-300 shadow-md shadow-amber-100/50' : ''}`}
                >
                  {isPremium && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 hover:bg-amber-500 gap-1">
                        <Crown className="w-3 h-3" /> Đề xuất
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{formatPrice(p)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.billingPeriod === 'FREE'
                          ? `Dùng thử ${p.durationDays ?? 14} ngày`
                          : p.billingPeriod === 'YEARLY'
                            ? 'Thanh toán theo năm'
                            : `Thanh toán mỗi ${p.durationDays ?? 30} ngày`}
                      </p>
                    </div>

                    <div className="text-sm space-y-1.5 text-slate-700">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.maxMembers == null ? 'Thành viên không giới hạn' : `Tối đa ${p.maxMembers} thành viên`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.maxTasksPerMonth == null ? 'Task không giới hạn' : `${p.maxTasksPerMonth} task/tháng`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        <span>Album: {formatMb(p.albumStorageMb)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className={`w-3.5 h-3.5 ${p.aiEnabled ? 'text-violet-500' : 'text-slate-300'}`} />
                        <span className={p.aiEnabled ? '' : 'text-slate-400 line-through'}>
                          AI Chatbot
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className={`w-3.5 h-3.5 ${p.aiFinanceEnabled ? 'text-violet-500' : 'text-slate-300'}`} />
                        <span className={p.aiFinanceEnabled ? '' : 'text-slate-400 line-through'}>
                          AI tài chính
                        </span>
                      </div>
                    </div>

                    {p.features.length > 0 && (
                      <ul className="text-xs space-y-1 pt-2 border-t">
                        {p.features.slice(0, 4).map((f, i) => (
                          <li key={i} className="text-slate-600">✓ {f}</li>
                        ))}
                      </ul>
                    )}

                    <Button
                      className="w-full gap-1.5"
                      variant={isPremium ? 'default' : 'outline'}
                      disabled={paying}
                      onClick={() => handleSelectAndPay(p.id)}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {p.code === 'FREE' ? 'Dùng thử miễn phí' : 'Chọn gói này'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          Bạn có thể thay đổi gói bất kỳ lúc nào từ trang Quản lý gia đình.
        </p>
      </div>
    </div>
  )
}
