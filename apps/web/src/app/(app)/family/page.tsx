/**
 * Trang quản lý gia đình — theo API team (Family Care API).
 *
 * - Xem thành viên (`/families/my` → members).
 * - Family Manager mời thành viên: POST `/families/{id}/invitations` (email + vai trò + quan hệ)
 *   → trả về token để tạo link mời `/register?invite={token}`.
 * - Family Manager xóa thành viên: DELETE `/families/{id}/members/{userId}`.
 *
 * Lưu ý: API team chưa hỗ trợ đổi vai trò / sửa hồ sơ thành viên ở cấp gia đình
 * (chỉ có ở khu vực admin), nên các thao tác đó không hiển thị ở đây.
 */
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useActiveFamily } from '@/hooks/useFamily'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { UserPlus, Copy, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type FamilyRole = 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
type Relationship = 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'SISTER' | 'BROTHER' | 'GRANDPARENT' | 'OTHER'

const ROLE_LABEL: Record<FamilyRole, string> = {
  FAMILY_MANAGER: 'Family Manager',
  DEPUTY_MEMBER: 'Deputy Member',
  FAMILY_MEMBER: 'Family Member',
}

const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'CHILD', label: 'Con' },
  { value: 'FATHER', label: 'Bố' },
  { value: 'MOTHER', label: 'Mẹ' },
  { value: 'SPOUSE', label: 'Vợ/Chồng' },
  { value: 'BROTHER', label: 'Anh/Em trai' },
  { value: 'SISTER', label: 'Chị/Em gái' },
  { value: 'GRANDPARENT', label: 'Ông/Bà' },
  { value: 'OTHER', label: 'Khác' },
]
const relationshipLabel = (value?: string | null) =>
  RELATIONSHIP_OPTIONS.find((item) => item.value === value)?.label ?? 'Chưa đặt'

export default function FamilyPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { family, familyId, isLoading } = useActiveFamily()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<FamilyRole>('FAMILY_MEMBER')
  const [inviteRelationship, setInviteRelationship] = useState<Relationship>('CHILD')

  const members = family?.members ?? []
  const myRole = members.find((m) => m.userId === user?.id)?.familyRole
  const isManager = myRole === 'FAMILY_MANAGER' || user?.role === 'SYSTEM_ADMIN'

  const inviteMut = useMutation({
    mutationFn: (data: { email: string; familyRole: FamilyRole; relationship: Relationship }) =>
      api.post(`/families/${familyId}/invitations`, data).then((r) => r.data),
    onSuccess: (data) => setInviteToken(data.token),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể tạo lời mời')),
  })

  const removeMut = useMutation({
    mutationFn: (userId: string) => api.delete(`/families/${familyId}/members/${userId}`),
    onSuccess: () => {
      toast.success('Đã xóa thành viên')
      qc.invalidateQueries({ queryKey: ['families', 'my'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Không thể xóa thành viên')),
  })

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register?invite=${inviteToken}`)
    toast.success('Đã copy link mời!')
  }

  const resetInvite = () => {
    setInviteToken('')
    setInviteEmail('')
    setInviteRole('FAMILY_MEMBER')
    setInviteRelationship('CHILD')
  }

  if (isLoading) {
    return (
      <div>
        <Topbar title="Gia đình" />
        <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </div>
    )
  }

  if (!familyId) {
    return (
      <div>
        <Topbar title="Gia đình" />
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-muted-foreground">
          <UserPlus className="w-10 h-10 opacity-30" />
          <p className="text-sm">Bạn chưa thuộc gia đình nào.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="Thành viên gia đình" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{family?.name}</h2>
            <p className="text-sm text-muted-foreground">
              {isManager ? 'Quản lý thành viên và lời mời' : 'Xem thành viên gia đình'}
            </p>
          </div>
          {isManager && (
            <Button onClick={() => { resetInvite(); setInviteOpen(true) }}>
              <UserPlus className="w-4 h-4 mr-2" />Mời thành viên
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thành viên ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => {
                const name = member.user?.fullName ?? member.displayName ?? 'Thành viên'
                const canRemove = isManager && member.userId !== user?.id && member.familyRole !== 'FAMILY_MANAGER'
                return (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Avatar>
                      <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-sm text-muted-foreground truncate">{member.user?.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{relationshipLabel(member.relationship)}</Badge>
                    <Badge variant={member.familyRole === 'FAMILY_MANAGER' ? 'default' : 'secondary'}>
                      {ROLE_LABEL[member.familyRole]}
                    </Badge>
                    {member.userId === user?.id && <Badge variant="outline" className="text-xs">Bạn</Badge>}
                    {canRemove && (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={removeMut.isPending}
                        onClick={() => {
                          if (window.confirm(`Xóa ${name} khỏi gia đình?`)) removeMut.mutate(member.userId)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mời thành viên</DialogTitle>
            <DialogDescription>Tạo lời mời theo email kèm vai trò và quan hệ trong gia đình.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email người được mời *</Label>
              <Input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as FamilyRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPUTY_MEMBER">Deputy Member</SelectItem>
                  <SelectItem value="FAMILY_MEMBER">Family Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quan hệ</Label>
              <Select value={inviteRelationship} onValueChange={(v) => setInviteRelationship(v as Relationship)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!inviteToken ? (
              <Button
                className="w-full"
                disabled={inviteMut.isPending || !inviteEmail}
                onClick={() => inviteMut.mutate({ email: inviteEmail, familyRole: inviteRole, relationship: inviteRelationship })}
              >
                {inviteMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Tạo link mời
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>Link mời (hiệu lực 7 ngày)</Label>
                <div className="flex gap-2">
                  <Input value={`${window.location.origin}/register?invite=${inviteToken}`} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyInviteLink}><Copy className="w-4 h-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Chia sẻ link này cho người được mời.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
