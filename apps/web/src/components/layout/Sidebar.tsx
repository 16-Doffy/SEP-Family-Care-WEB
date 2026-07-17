'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Wallet, Settings, Users, LogOut, Crown, UserCircle,
  TrendingUp, ClipboardList, Archive, GitBranch, LayoutDashboard,
  ChevronLeft, ChevronRight, Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAdminUsers, useAdminSystemHealth } from '@/hooks/useAdmin'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string | null
}

type AdminNavGroup = {
  label: string
  items: NavItem[]
}

/** Family sidebar items — only pages with real backend support */
const familyItems: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/wallet', label: 'Tài chính gia đình', icon: Wallet },
  { href: '/family', label: 'Gia đình', icon: Users },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
]

/* ─── Admin Sidebar (dark navy) ─────────────────────────────────────────── */

function AdminSidebar() {
  const pathname = usePathname()
  const { user, clearAuth } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)

  // Live badge data from real APIs
  const { data: suspendedData } = useAdminUsers({ accountStatus: 'SUSPENDED', limit: 1 })
  const { data: healthData } = useAdminSystemHealth()

  const suspendedCount = suspendedData?.total ?? 0
  const isHealthBad = !!healthData?.status && healthData.status !== 'ok' && healthData.status !== 'UP'

  const navGroups: AdminNavGroup[] = [
    {
      label: 'QUẢN LÝ',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/users', label: 'Người dùng', icon: UserCircle },
        { href: '/admin/families', label: 'Gia đình', icon: Home },
        { href: '/admin/revenue', label: 'Doanh thu', icon: TrendingUp },
      ],
    },
    {
      label: 'VẬN HÀNH',
      items: [
        { href: '/admin/system', label: 'Hệ thống', icon: Server, badge: isHealthBad ? '!' : null },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
        { href: '/admin/plans', label: 'Gói dịch vụ', icon: Crown },
      ],
    },
    {
      label: 'HỆ THỐNG',
      items: [
        { href: '/admin/backups', label: 'Backup & Restore', icon: Archive },
        { href: '/admin/provisioning-logs', label: 'Provisioning', icon: GitBranch },
      ],
    },
  ]

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }) } catch {}
    }
    clearAuth()
    router.push('/login')
  }

  const initials = (user?.displayName ?? 'SA')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 overflow-hidden z-20',
        'bg-[#0f172a] border-r border-[#1e293b]',
        collapsed ? 'w-[68px]' : 'w-[220px]',
      )}
    >
      {/* ── Logo header ── */}
      <div className="flex items-center gap-2.5 px-4 py-[18px] border-b border-[#1e293b] shrink-0 relative">
        <Link href="/admin" className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
            <span className="text-teal-400 font-bold text-[11px]">SF</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-[13px] text-white truncate leading-tight tracking-tight">
              SEPFamilyCare
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
          className={cn(
            'w-5 h-5 rounded-full bg-[#1e293b] border border-[#334155] flex items-center justify-center',
            'text-slate-400 hover:text-white hover:bg-[#334155] transition-colors shrink-0',
            collapsed && 'absolute -right-2.5 top-1/2 -translate-y-1/2 z-30 shadow-md',
          )}
        >
          {collapsed
            ? <ChevronRight className="w-2.5 h-2.5" />
            : <ChevronLeft className="w-2.5 h-2.5" />
          }
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9.5px] font-bold text-slate-600 uppercase tracking-[0.12em] px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const isActive = href === '/admin'
                  ? pathname === href
                  : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative group',
                      'border-l-2',
                      collapsed ? 'px-3 justify-center' : 'pl-[10px] pr-2',
                      isActive
                        ? 'bg-[#1e293b] text-white border-teal-400'
                        : 'text-slate-400 hover:bg-[#1e293b]/70 hover:text-slate-200 border-transparent',
                    )}
                  >
                    <Icon className={cn('w-[16px] h-[16px] shrink-0', isActive ? 'text-teal-400' : '')} />
                    {!collapsed && <span className="truncate flex-1 leading-none">{label}</span>}
                    {!collapsed && badge != null && (
                      <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                        {badge}
                      </span>
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e293b] border border-[#334155] text-white text-xs rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {label}
                        {badge != null && (
                          <span className="ml-1.5 bg-rose-500 text-white text-[10px] rounded-full px-1 py-0.5">
                            {badge}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className="border-t border-[#1e293b] p-2.5 shrink-0">
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#1e293b] transition-colors cursor-default',
          collapsed && 'justify-center',
        )}>
          <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-[11px] shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate leading-tight">
                  {user?.displayName ?? 'Super Admin'}
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-600 hover:text-rose-400 transition-colors p-1 rounded shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const { clearAuth } = useAuth()
  const router = useRouter()

  const isAdmin = user?.role === 'SYSTEM_ADMIN'

  if (isAdmin) return <AdminSidebar />

  /* ─── Family sidebar (light blue theme, unchanged) ───────────────────── */
  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }) } catch {}
    }
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 border-r h-screen sticky top-0 bg-white border-blue-100">
      <div className="p-5 bg-blue-600">
        <Link href="/dashboard" className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
            <span className="text-white font-bold text-sm">FC</span>
          </div>
          <span className="font-bold text-lg text-white">Family Care</span>
        </Link>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
          <Users className="w-3 h-3" /> Family
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {familyItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />{label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-blue-100">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 bg-blue-100 text-blue-700">
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  )
}
