/**
 * Layout bảo vệ khu vực admin — chỉ cho phép người dùng có role SYSTEM_ADMIN truy cập.
 * Tất cả người dùng khác sẽ bị chuyển hướng về /dashboard.
 */
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileAdminNav } from '@/components/layout/MobileAdminNav'
import { Loader2 } from 'lucide-react'

/**
 * Layout admin với kiểm tra quyền SYSTEM_ADMIN nghiêm ngặt.
 * Redirect ngay lập tức về /dashboard nếu user không phải SYSTEM_ADMIN,
 * kể cả khi user đã đăng nhập nhưng không đủ quyền.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  /**
   * Kiểm tra quyền sau khi auth state tải xong.
   * Điều kiện kép: phải có user VÀ role phải là SYSTEM_ADMIN.
   */
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'SYSTEM_ADMIN')) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  // Hiển thị spinner khi đang kiểm tra auth
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
  // Trả về null để tránh flash nội dung admin trước khi redirect
  if (!user || user.role !== 'SYSTEM_ADMIN') return null

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden">{children}</main>
      <MobileAdminNav />
    </div>
  )

}
