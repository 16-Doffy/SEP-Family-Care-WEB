'use client'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Home, Activity, BarChart3, Server as ServerIcon } from 'lucide-react'
import { useAdminUsers, useAdminFamilies } from '@/hooks/useAdmin'

export default function AdminPage() {
  const { data: usersData } = useAdminUsers({ limit: 1 })
  const { data: activeUsersData } = useAdminUsers({ limit: 1, accountStatus: 'ACTIVE' })
  const { data: familiesData } = useAdminFamilies({ limit: 1 })

  return (
    <div>
      <Topbar title="Admin Dashboard" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Home className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{familiesData?.total ?? '—'}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Tổng gia đình</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Users className="w-7 h-7 md:w-8 md:h-8 text-green-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{usersData?.total ?? '—'}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Tổng người dùng</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Activity className="w-7 h-7 md:w-8 md:h-8 text-purple-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{activeUsersData?.total ?? '—'}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Đang hoạt động</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Truy cập nhanh */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Truy cập nhanh</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/admin/revenue">
              <Button variant="outline" className="gap-2 w-full flex-col h-auto py-3">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <span className="text-xs">Doanh thu</span>
              </Button>
            </Link>
            <Link href="/admin/system">
              <Button variant="outline" className="gap-2 w-full flex-col h-auto py-3">
                <ServerIcon className="w-5 h-5 text-indigo-600" />
                <span className="text-xs">Hệ thống</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
