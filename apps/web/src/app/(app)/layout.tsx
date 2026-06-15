/**
 * Layout bảo vệ cho nhóm trang ứng dụng chính (app routes).
 * Kiểm tra xác thực người dùng và chuyển hướng về /login nếu chưa đăng nhập.
 * Render Sidebar cho toàn bộ trang con.
 */
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'

/**
 * Layout auth-guard cho tất cả trang trong nhóm `(app)`.
 * Hiển thị loading spinner khi đang kiểm tra auth state.
 * Nếu không có user sau khi load xong, tự động redirect đến /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
