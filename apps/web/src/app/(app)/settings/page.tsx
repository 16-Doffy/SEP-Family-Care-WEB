'use client'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials, formatDate } from '@/lib/utils'

const relationshipLabel = (value?: string | null) => {
  const labels: Record<string, string> = {
    FATHER: 'Bố',
    MOTHER: 'Mẹ',
    CHILD: 'Con',
    GRANDPARENT: 'Ông/Bà',
    SIBLING: 'Anh/Chị/Em',
    SPOUSE: 'Vợ/Chồng',
    RELATIVE: 'Người thân',
    OTHER: 'Chưa đặt',
  }
  return labels[value ?? 'OTHER'] ?? 'Chưa đặt'
}

const roleLabel = (value?: string) => {
  if (value === 'SUPER_ADMIN') return 'Admin'
  if (value === 'PARENT') return 'Phụ huynh'
  return 'Thành viên'
}

export default function SettingsPage() {
  const { user } = useAuth()
  const member = user?.familyMember

  return (
    <div>
      <Topbar title="Hồ sơ & cài đặt" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ cá nhân</CardTitle>
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={user?.role === 'PARENT' ? 'default' : 'secondary'}>
                    Quyền: {roleLabel(user?.role)}
                  </Badge>
                  {member && (
                    <Badge variant="outline">
                      Vai vế: {relationshipLabel(member.relationship)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {member?.family && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin trong gia đình</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tên gia đình</span>
                <span className="font-medium">{member.family.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Biệt danh</span>
                <span className="font-medium">{member.nickname ?? 'Chưa đặt'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vai vế</span>
                <span className="font-medium">{relationshipLabel(member.relationship)}</span>
              </div>
              {member.birthDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ngày sinh</span>
                  <span className="font-medium">{formatDate(member.birthDate)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gói đăng ký</span>
                <Badge variant="outline">{member.family.plan}</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
