'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Shield, Users, Crown, Menu, LogOut, Server, Download, BarChart3, UserCircle, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import toast from 'react-hot-toast'

type Tab = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const tabs: Tab[] = [
  { href: '/admin', label: 'Tổng quan', icon: Shield },
  { href: '/admin/families', label: 'Gia đình', icon: Users },
  { href: '/admin/users', label: 'Users', icon: UserCircle },
  { href: '/admin/plans', label: 'Gói', icon: Crown },
]

export function MobileAdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, clearAuth } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }) } catch {}
    }
    clearAuth()
    router.push('/login')
  }

  const exportBackup = async () => {
    try {
      const res = await api.get('/admin/backup/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `family-care-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất backup')
      setMoreOpen(false)
    } catch {
      toast.error('Không thể xuất backup')
    }
  }

  const isActive = (tab: Tab) => {
    if (tab.href === '/admin') return pathname === '/admin'
    return pathname.startsWith(tab.href)
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 h-16 grid grid-cols-5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-violet-700' : 'text-gray-500 hover:text-violet-700'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-gray-500 hover:text-violet-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>Thêm</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Khác</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <div className="px-3 py-2 mb-2 rounded-lg bg-violet-50">
              <p className="text-sm font-medium text-violet-900 truncate">{user?.displayName}</p>
              <p className="text-xs text-violet-700 truncate">{user?.email}</p>
            </div>

            <Link
              href="/admin/revenue"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <BarChart3 className="w-5 h-5 text-green-600" />
              Thống kê doanh thu
            </Link>
            <Link
              href="/admin/system"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <Server className="w-5 h-5 text-indigo-600" />
              Hệ thống & Docker
            </Link>
            <button
              onClick={exportBackup}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <Download className="w-5 h-5 text-blue-600" />
              Xuất backup hệ thống
            </button>
            <Link
              href="/dashboard"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <Home className="w-5 h-5 text-gray-500" />
              Về dashboard người dùng
            </Link>

            <div className="border-t my-2" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
