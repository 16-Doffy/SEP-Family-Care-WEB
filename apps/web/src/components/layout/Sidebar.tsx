'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wallet, CheckSquare, Settings, Users, Shield, LogOut, MessageSquare, CalendarDays, Siren, Image, MapPin, Sparkles, Crown, UserRound, BarChart3, UserCircle, Server, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  danger?: boolean
}

const parentItems: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/wallet', label: 'Sổ quỹ gia đình', icon: Wallet },
  { href: '/tasks', label: 'Quản lý nhiệm vụ', icon: CheckSquare },
  { href: '/chat', label: 'Trò chuyện', icon: MessageSquare },
  { href: '/ai-chat', label: 'Trợ lý AI', icon: Sparkles },
  { href: '/calendar', label: 'Lịch gia đình', icon: CalendarDays },
  { href: '/album', label: 'Album ảnh', icon: Image },
  { href: '/location', label: 'Vị trí gia đình', icon: MapPin },
  { href: '/devices', label: 'Thiết bị & GPS', icon: Activity },
  { href: '/sos', label: 'SOS Khẩn cấp', icon: Siren, danger: true },
  { href: '/family', label: 'Gia đình', icon: Users },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
]

// Family Member: thành viên trong gia đình (con, ông bà, anh chị em, người thân).
const familyMemberItems: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/wallet', label: 'Sổ ghi nhận cá nhân', icon: Wallet },
  { href: '/tasks', label: 'Nhiệm vụ của tôi', icon: CheckSquare },
  { href: '/chat', label: 'Trò chuyện', icon: MessageSquare },
  { href: '/ai-chat', label: 'Trợ lý AI', icon: Sparkles },
  { href: '/calendar', label: 'Lịch gia đình', icon: CalendarDays },
  { href: '/album', label: 'Album gia đình', icon: Image },
  { href: '/location', label: 'Chia sẻ vị trí', icon: MapPin },
  { href: '/devices', label: 'Thiết bị & GPS', icon: Activity },
  { href: '/sos', label: 'Gửi SOS', icon: Siren, danger: true },
  { href: '/family', label: 'Thành viên gia đình', icon: Users },
  { href: '/settings', label: 'Cài đặt cá nhân', icon: Settings },
]

const adminItems: NavItem[] = [
  { href: '/admin', label: 'Tổng quan hệ thống', icon: Shield },
  { href: '/admin/families', label: 'Gia đình', icon: Users },
  { href: '/admin/users', label: 'Người dùng', icon: UserCircle },
  { href: '/admin/plans', label: 'Gói thuê bao', icon: Crown },
  { href: '/admin/revenue', label: 'Doanh thu', icon: BarChart3 },
  { href: '/admin/system', label: 'Hệ thống & Docker', icon: Server },
]

const roleNavItems = {
  PARENT: parentItems,
  FAMILY_MEMBER: familyMemberItems,
  SUPER_ADMIN: adminItems,
}

/** Theme màu cho từng role */
const roleTheme = {
  PARENT: {
    headerBg: 'bg-blue-600',
    headerBorder: 'border-blue-700',
    logoBg: 'bg-white/20',
    activeBg: 'bg-blue-50 text-blue-700',
    activeHover: 'hover:bg-blue-50 hover:text-blue-700',
    avatarBg: 'bg-blue-100 text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-700',
    badgeLabel: 'Deputy Member',
    BadgeIcon: Crown,
    sidebarBorder: 'border-blue-100',
  },
  FAMILY_MEMBER: {
    headerBg: 'bg-emerald-600',
    headerBorder: 'border-emerald-700',
    logoBg: 'bg-white/20',
    activeBg: 'bg-emerald-50 text-emerald-700',
    activeHover: 'hover:bg-emerald-50 hover:text-emerald-700',
    avatarBg: 'bg-emerald-100 text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-700',
    badgeLabel: 'Family Member',
    BadgeIcon: UserRound,
    sidebarBorder: 'border-emerald-100',
  },
  SUPER_ADMIN: {
    headerBg: 'bg-violet-600',
    headerBorder: 'border-violet-700',
    logoBg: 'bg-white/20',
    activeBg: 'bg-violet-50 text-violet-700',
    activeHover: 'hover:bg-violet-50 hover:text-violet-700',
    avatarBg: 'bg-violet-100 text-violet-700',
    badgeBg: 'bg-violet-100 text-violet-700',
    badgeLabel: 'Admin',
    BadgeIcon: Shield,
    sidebarBorder: 'border-violet-100',
  },
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, clearAuth } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }) } catch {}
    }
    clearAuth()
    router.push('/login')
  }

  const role = (user?.role ?? 'FAMILY_MEMBER') as keyof typeof roleTheme
  const theme = roleTheme[role] ?? roleTheme.FAMILY_MEMBER
  const { BadgeIcon } = theme

  const items = roleNavItems[role] ?? roleNavItems.FAMILY_MEMBER
  const homeHref = role === 'SUPER_ADMIN' ? '/admin' : '/dashboard'

  return (
    <aside className={cn('hidden md:flex flex-col w-64 border-r h-screen sticky top-0 bg-white', theme.sidebarBorder)}>
      {/* Header với màu theo role */}
      <div className={cn('p-5', theme.headerBg)}>
        <Link href={homeHref} className="flex items-center gap-2 mb-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme.logoBg)}>
            <span className="text-white font-bold text-sm">FC</span>
          </div>
          <span className="font-bold text-lg text-white">Family Care</span>
        </Link>

        {/* Role badge + tên gia đình */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
            <BadgeIcon className="w-3 h-3" />
            {theme.badgeLabel}
          </span>
          {user?.familyMember?.family && (
            <span className="text-white/70 text-xs truncate">{user.familyMember.family.name}</span>
          )}
        </div>
      </div>

      {/* Danh sách điều hướng */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map(({ href, label, icon: Icon, danger }) => {
          const isActive = href === '/admin' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive && danger
                  ? 'bg-red-50 text-red-700'
                  : isActive
                  ? theme.activeBg
                  : danger
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : cn('text-gray-600', theme.activeHover),
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: avatar + tên + role badge + logout */}
      <div className={cn('p-4 border-t', theme.sidebarBorder)}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0', theme.avatarBg)}>
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
              <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', theme.badgeBg)}>
                <BadgeIcon className="w-2.5 h-2.5" />
                {theme.badgeLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
