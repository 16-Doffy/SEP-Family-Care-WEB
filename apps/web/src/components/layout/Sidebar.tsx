'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wallet, CheckSquare, Settings, Users, Shield, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const navItems = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/wallet', label: 'Ví tiền', icon: Wallet },
  { href: '/tasks', label: 'Nhiệm vụ', icon: CheckSquare },
  { href: '/family', label: 'Gia đình', icon: Users },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
]

const adminItems = [
  { href: '/admin', label: 'Admin', icon: Shield },
]

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

  const items = [...navItems, ...(user?.role === 'SUPER_ADMIN' ? adminItems : [])]

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-white h-screen sticky top-0">
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">FC</span>
          </div>
          <span className="font-bold text-lg text-gray-900">Family Care</span>
        </Link>
        {user?.familyMember?.family && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            {user.familyMember.family.name}
          </p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
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
