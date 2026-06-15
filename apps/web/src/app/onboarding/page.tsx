/**
 * Trang chào mừng sau khi tạo gia đình.
 *
 * Theo API team, gia đình được kích hoạt (ACTIVE) ngay khi tạo và chưa có
 * luồng thanh toán/đăng ký gói ở phía backend. Trang này chỉ hiển thị lời chào,
 * danh sách gói (nếu có, chỉ để tham khảo) và nút vào ứng dụng.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Users, ArrowRight, Rocket } from 'lucide-react'

/** Gói đăng ký theo contract team (chỉ trường dùng để hiển thị). */
interface Plan {
  id: string
  planCode: string
  name: string
  annualPrice: number | string
  maxMembers: number | null
  storageLimit: number | null
  isActive: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscription-plans').then((r) => r.data),
  })

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
            <Rocket className="w-3.5 h-3.5" /> Gia đình của bạn đã sẵn sàng
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Chào mừng đến Family Care 👋</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Gia đình của bạn đã được tạo và kích hoạt. Bắt đầu bằng việc thiết lập sổ tài chính chung,
            mô hình phân bổ (5 chiếc lọ / 80-20) và mời các thành viên khác.
          </p>
        </div>

        {plans.filter((p) => p.isActive).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {plans.filter((p) => p.isActive).map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2"><CardTitle className="text-lg">{p.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-2xl font-bold text-blue-600">
                    {Number(p.annualPrice) === 0 ? 'Miễn phí' : `${Number(p.annualPrice).toLocaleString('vi-VN')} đ/năm`}
                  </p>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.maxMembers == null ? 'Không giới hạn thành viên' : `Tối đa ${p.maxMembers} thành viên`}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <Button size="lg" className="gap-2" onClick={() => router.replace('/dashboard')}>
            Vào ứng dụng <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
