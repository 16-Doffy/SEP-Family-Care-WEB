/**
 * Layout bảo vệ cho nhóm trang ứng dụng chính (app routes).
 * Kiểm tra xác thực người dùng và chuyển hướng về /login nếu chưa đăng nhập.
 * Render Sidebar, nút SOS và banner cảnh báo SOS cho toàn bộ trang con.
 */
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { SOSButton } from '@/components/sos/SOSButton'
import { SOSAlertBanner } from '@/components/sos/SOSAlertBanner'
import { Loader2 } from 'lucide-react'

/**
 * Layout auth-guard cho tất cả trang trong nhóm `(app)`.
 * Hiển thị loading spinner khi đang kiểm tra auth state.
 * Nếu không có user sau khi load xong, tự động redirect đến /login.
 * Trả về null (không render gì) trong lúc chờ redirect để tránh flash nội dung.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  /**
   * Effect theo dõi trạng thái auth.
   * Chỉ redirect sau khi isLoading = false để tránh redirect nhầm
   * khi token đang được khôi phục từ localStorage.
   */
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  // Hiển thị spinner trong khi AuthContext đang khôi phục session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Trả về null để tránh flash giao diện trong khoảnh khắc redirect
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
      {/* Nút SOS nổi, hiển thị ở góc màn hình cho mọi trang trong app */}
      <SOSButton />
      {/* Banner cảnh báo xuất hiện khi có thành viên kích hoạt SOS */}
      <SOSAlertBanner />
    </div>
  )
}
