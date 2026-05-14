'use client'
/**
 * @module Sidebar
 * @description Thanh điều hướng bên trái cố định của ứng dụng (chỉ hiển thị trên màn hình md trở lên).
 *
 * Hiển thị:
 * - Logo và tên ứng dụng, cùng tên gia đình hiện tại (nếu có).
 * - Danh sách các liên kết điều hướng chính, với mục SOS được tô màu đỏ nổi bật.
 * - Mục Admin (chỉ dành cho người dùng có vai trò `SUPER_ADMIN`).
 * - Thông tin người dùng và nút đăng xuất ở phía dưới.
 */

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wallet, CheckSquare, Settings, Users, Shield, LogOut, MessageSquare, CalendarDays, Siren, Image, MapPin, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

/** Kiểu cho một mục điều hướng trong sidebar */
type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Nếu `true`, mục này sẽ được tô màu đỏ (dùng cho SOS) */
  danger?: boolean
}

/**
 * Các mục điều hướng chính hiển thị cho mọi người dùng đã đăng nhập.
 * Thứ tự trong mảng quyết định thứ tự hiển thị trong sidebar.
 */
const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/wallet', label: 'Ví tiền', icon: Wallet },
  { href: '/tasks', label: 'Nhiệm vụ', icon: CheckSquare },
  { href: '/chat', label: 'Trò chuyện', icon: MessageSquare },
  { href: '/ai-chat', label: 'Trợ lý AI', icon: Sparkles },
  { href: '/calendar', label: 'Lịch gia đình', icon: CalendarDays },
  { href: '/album', label: 'Album ảnh', icon: Image },
  { href: '/location', label: 'Vị trí gia đình', icon: MapPin },
  { href: '/sos', label: 'SOS Khẩn cấp', icon: Siren, danger: true },
  { href: '/family', label: 'Gia đình', icon: Users },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
]

/**
 * Các mục điều hướng dành riêng cho quản trị viên hệ thống (`SUPER_ADMIN`).
 * Chỉ được thêm vào danh sách cuối cùng nếu người dùng có đủ quyền.
 */
const adminItems: NavItem[] = [
  { href: '/admin', label: 'Admin', icon: Shield },
]

/**
 * Component Sidebar - thanh điều hướng cố định bên trái.
 * Ẩn trên mobile, chỉ hiển thị từ breakpoint `md` trở lên.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { user, clearAuth } = useAuth()
  const router = useRouter()

  /**
   * Xử lý đăng xuất:
   * 1. Gọi API `/auth/logout` để vô hiệu hoá refresh token trên server.
   * 2. Xóa auth state và localStorage thông qua `clearAuth`.
   * 3. Chuyển hướng về trang đăng nhập.
   */
  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      // Báo server vô hiệu hoá refresh token (best effort - bỏ qua lỗi nếu có)
      try { await api.post('/auth/logout', { refreshToken }) } catch {}
    }
    clearAuth()
    router.push('/login')
  }

  // Ghép mục admin vào cuối danh sách nếu người dùng là SUPER_ADMIN
  const items = [...navItems, ...(user?.role === 'SUPER_ADMIN' ? adminItems : [])]

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-white h-screen sticky top-0">
      {/* Phần header: logo và tên gia đình */}
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">FC</span>
          </div>
          <span className="font-bold text-lg text-gray-900">Family Care</span>
        </Link>
        {/* Hiển thị tên gia đình nếu người dùng đã tham gia */}
        {user?.familyMember?.family && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            {user.familyMember.family.name}
          </p>
        )}
      </div>

      {/* Danh sách điều hướng */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon, danger }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              // Ưu tiên: active + danger > active > danger > mặc định
              pathname.startsWith(href) && danger
                ? 'bg-red-50 text-red-700'
                : pathname.startsWith(href)
                ? 'bg-blue-50 text-blue-700'
                : danger
                ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Phần footer: thông tin người dùng và nút đăng xuất */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          {/* Avatar chữ cái đầu của tên hiển thị */}
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
