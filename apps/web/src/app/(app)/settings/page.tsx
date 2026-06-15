/**
 * Trang Hồ sơ & cài đặt — theo API team (Family Care API).
 *
 * API team hiện chỉ cung cấp `GET /auth/me` cho người dùng tự xem hồ sơ
 * (chưa có cập nhật hồ sơ / đổi mật khẩu / quản lý phiên ở phía self-service),
 * nên trang này hiển thị thông tin ở dạng chỉ đọc, kèm thông tin gia đình.
 */
'use client'
import { useAuth } from '@/context/AuthContext'
import { useActiveFamily } from '@/hooks/useFamily'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  FAMILY_MANAGER: 'Family Manager',
  DEPUTY_MEMBER: 'Deputy Member',
  FAMILY_MEMBER: 'Family Member',
}
const RELATIONSHIP_LABEL: Record<string, string> = {
  FATHER: 'Bố', MOTHER: 'Mẹ', SPOUSE: 'Vợ/Chồng', CHILD: 'Con',
  SISTER: 'Chị/Em gái', BROTHER: 'Anh/Em trai', GRANDPARENT: 'Ông/Bà', OTHER: 'Khác',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { family } = useActiveFamily()
  const member = family?.members?.find((m) => m.userId === user?.id)

  return (
    <div>
      <Topbar title="Hồ sơ & cài đặt" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Hồ sơ cá nhân</CardTitle></CardHeader>
          <CardContent className="space-y-5">
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
                  {member && <Badge>{ROLE_LABEL[member.familyRole] ?? 'Thành viên'}</Badge>}
                  {member?.relationship && <Badge variant="outline">Vai vế: {RELATIONSHIP_LABEL[member.relationship] ?? member.relationship}</Badge>}
                  {user?.role === 'SYSTEM_ADMIN' && <Badge variant="secondary">System Admin</Badge>}
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Họ tên</span><span className="font-medium">{user?.displayName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
              {user?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Điện thoại</span><span className="font-medium">{user.phone}</span></div>}
            </div>
          </CardContent>
        </Card>

        {family && (
          <Card>
            <CardHeader><CardTitle>Thông tin trong gia đình</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tên gia đình</span><span className="font-medium">{family.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vai trò</span><span className="font-medium">{member ? (ROLE_LABEL[member.familyRole] ?? '—') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Số thành viên</span><span className="font-medium">{family.members?.length ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái</span><Badge variant="outline">{family.status}</Badge></div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Cập nhật hồ sơ, đổi mật khẩu và quản lý phiên đăng nhập sẽ khả dụng khi API chung bổ sung các endpoint tương ứng.
        </p>
      </div>
    </div>
  )
}
