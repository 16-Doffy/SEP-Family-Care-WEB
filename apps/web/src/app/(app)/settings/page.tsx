/**
 * Trang cài đặt tài khoản — hiển thị thông tin cá nhân và thông tin gia đình của người dùng.
 * Hiện tại là trang chỉ đọc; có thể mở rộng để chỉnh sửa thông tin sau.
 */
'use client'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

/**
 * Trang cài đặt — xem thông tin tài khoản và gia đình.
 * Phần thông tin gia đình chỉ hiển thị khi user đã tham gia một gia đình.
 */
export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div>
      <Topbar title="Cài đặt" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-xl bg-blue-100 text-blue-700">
                  {user?.displayName ? getInitials(user.displayName) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-semibold">{user?.displayName}</p>
                <p className="text-muted-foreground">{user?.email}</p>
                <Badge className="mt-1" variant={user?.role === 'PARENT' ? 'default' : 'secondary'}>
                  {user?.role === 'SUPER_ADMIN' ? 'Admin' : user?.role === 'PARENT' ? 'Phụ huynh' : 'Con cái'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {user?.familyMember?.family && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin gia đình</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tên gia đình</span>
                <span className="font-medium">{user.familyMember.family.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gói đăng ký</span>
                <Badge variant="outline">{user.familyMember.family.plan}</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
