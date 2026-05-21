/**
 * Trang quản lý gia đình: xem danh sách thành viên, mời người mới và nâng cấp gói.
 * Chỉ phụ huynh mới có thể tạo link mời và nâng cấp gói đăng ký.
 */
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
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
import { UserPlus, Copy, Loader2, Crown, Trash2, Wallet, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { UpgradePlanDialog } from '@/components/payment/UpgradePlanDialog'
import { IncomeSourceManager } from '@/components/finance/IncomeSourceManager'

type FamilyMember = {
  id: string
  nickname?: string
  relationship?: FamilyRelationship
  birthDate?: string | null
  notes?: string | null
  isOwner?: boolean
  user: { id: string; displayName: string; email: string; role: string }
}

type FamilyRelationship =
  | 'FATHER'
  | 'MOTHER'
  | 'CHILD'
  | 'GRANDPARENT'
  | 'SIBLING'
  | 'SPOUSE'
  | 'RELATIVE'
  | 'OTHER'

const RELATIONSHIP_OPTIONS: { value: FamilyRelationship; label: string }[] = [
  { value: 'CHILD', label: 'Con' },
  { value: 'FATHER', label: 'Bố' },
  { value: 'MOTHER', label: 'Mẹ' },
  { value: 'GRANDPARENT', label: 'Ông/Bà' },
  { value: 'SIBLING', label: 'Anh/Chị/Em' },
  { value: 'SPOUSE', label: 'Vợ/Chồng' },
  { value: 'RELATIVE', label: 'Người thân' },
  { value: 'OTHER', label: 'Chưa đặt' },
]

const relationshipLabel = (value?: string) =>
  RELATIONSHIP_OPTIONS.find((item) => item.value === value)?.label ?? 'Chưa đặt'

/**
 * Trang gia đình — quản lý thành viên và gói đăng ký.
 * inviteCode được lưu trong state để hiển thị link mời sau khi tạo,
 * thay vì gọi lại API mỗi lần mở dialog.
 */
export default function FamilyPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  // Code mời được trả về từ API sau khi phụ huynh nhấn "Tạo link mời"
  const [inviteCode, setInviteCode] = useState('')
  const [inviteRole, setInviteRole] = useState<'PARENT' | 'FAMILY_MEMBER'>('FAMILY_MEMBER')
  const [inviteRelationship, setInviteRelationship] = useState<FamilyRelationship>('CHILD')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [profileForms, setProfileForms] = useState<Record<string, { nickname: string; relationship: FamilyRelationship; birthDate: string; notes: string }>>({})

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const inviteMut = useMutation({
    mutationFn: (data: { role: string; relationship: FamilyRelationship }) => api.post('/family/invite', data),
    onSuccess: (res) => setInviteCode(res.data.code),
  })

  const profileMut = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { nickname: string; relationship: FamilyRelationship; birthDate: string | null; notes: string } }) =>
      api.patch(`/family/members/${memberId}/profile`, data),
    onSuccess: () => {
      toast.success('Đã cập nhật hồ sơ thành viên')
      qc.invalidateQueries({ queryKey: ['family'] })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thể cập nhật hồ sơ'),
  })

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'PARENT' | 'FAMILY_MEMBER' }) =>
      api.patch(`/family/members/${userId}/role`, { role }),
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò')
      qc.invalidateQueries({ queryKey: ['family'] })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thể cập nhật vai trò'),
  })

  const removeMut = useMutation({
    mutationFn: (userId: string) => api.delete(`/family/members/${userId}`),
    onSuccess: () => {
      toast.success('Đã xóa thành viên')
      qc.invalidateQueries({ queryKey: ['family'] })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thể xóa thành viên'),
  })

  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const members: FamilyMember[] = family?.members ?? []
  const pageTitle = isParent ? 'Quản lý gia đình' : 'Thành viên gia đình'

  /**
   * Sao chép link mời vào clipboard.
   * Link bao gồm invite code dạng query param để trang đăng ký tự nhận diện.
   */
  const copyInviteLink = () => {
    const link = `${window.location.origin}/register?invite=${inviteCode}`
    navigator.clipboard.writeText(link)
    toast.success('Đã copy link mời!')
  }

  return (
    <div>
      <Topbar title={pageTitle} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{family?.name ?? 'Gia đình của bạn'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {isParent ? 'Quản lý thành viên, lời mời và gói sử dụng' : 'Xem thông tin các thành viên trong gia đình'} · Gói: {family?.subscriptionPlan?.name ?? family?.plan ?? 'FREE'}
              </p>
              {family?.subscriptionExpiresAt && (
                <span className="text-xs text-muted-foreground">
                  · Hết hạn: {new Date(family.subscriptionExpiresAt).toLocaleDateString('vi-VN')}
                </span>
              )}
              {family?.subscriptionStatus === 'EXPIRED' && (
                <Badge variant="destructive" className="text-[10px]">Đã hết hạn</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isParent && (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)} className="gap-2">
                <Crown className="w-4 h-4 text-amber-500" />Nâng cấp gói
              </Button>
            )}
            {isParent && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />Mời thành viên
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thành viên ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => {
                const canManageMember = isParent && member.user.id !== user?.id && !member.isOwner
                const canEditFinance = isParent || member.user.id === user?.id
                const expanded = expandedMember === member.id
                const profileForm = profileForms[member.id] ?? {
                  nickname: member.nickname ?? '',
                  relationship: member.relationship ?? 'OTHER',
                  birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
                  notes: member.notes ?? '',
                }
                return (
                  <div key={member.id} className="rounded-lg border">
                    <div className="flex items-center gap-3 p-3">
                      <Avatar>
                        <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials(member.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.user.displayName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.nickname ? `${member.nickname} · ` : ''}{member.user.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Vai vế: {relationshipLabel(member.relationship)}
                      </Badge>
                      <Badge variant={member.user.role === 'PARENT' ? 'default' : 'secondary'}>
                        Quyền: {member.user.role === 'PARENT' ? 'Phụ huynh' : 'Thành viên'}
                      </Badge>
                      {member.isOwner && (
                        <Badge variant="outline" className="text-xs">Chủ hộ</Badge>
                      )}
                      {member.user.id === user?.id && (
                        <Badge variant="outline" className="text-xs">Bạn</Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setExpandedMember(expanded ? null : member.id)}
                        title="Thông tin tài chính"
                      >
                        <Wallet className={`w-4 h-4 ${expanded ? 'text-blue-600' : 'text-gray-400'}`} />
                      </Button>
                      {canManageMember && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.user.role === 'PARENT' ? 'PARENT' : 'FAMILY_MEMBER'}
                            onValueChange={(role) => roleMut.mutate({ userId: member.user.id, role: role as 'PARENT' | 'FAMILY_MEMBER' })}
                            disabled={roleMut.isPending}
                          >
                            <SelectTrigger className="w-44 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PARENT">Chủ hộ / Phụ huynh</SelectItem>
                              <SelectItem value="FAMILY_MEMBER">Thành viên</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={removeMut.isPending}
                            onClick={() => {
                              if (window.confirm(`Xóa ${member.user.displayName} khỏi gia đình?`)) {
                                removeMut.mutate(member.user.id)
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {expanded && (
                      <div className="border-t bg-gray-50 p-3 space-y-3">
                        {isParent && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-md border bg-white p-3">
                            <div className="space-y-1">
                              <Label>Biệt danh</Label>
                              <Input
                                value={profileForm.nickname}
                                onChange={(e) =>
                                  setProfileForms((prev) => ({
                                    ...prev,
                                    [member.id]: { ...profileForm, nickname: e.target.value },
                                  }))
                                }
                                placeholder="Ví dụ: Bé Lan"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Vai vế</Label>
                              <Select
                                value={profileForm.relationship}
                                onValueChange={(relationship) =>
                                  setProfileForms((prev) => ({
                                    ...prev,
                                    [member.id]: { ...profileForm, relationship: relationship as FamilyRelationship },
                                  }))
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {RELATIONSHIP_OPTIONS.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Ngày sinh</Label>
                              <Input
                                type="date"
                                value={profileForm.birthDate}
                                onChange={(e) =>
                                  setProfileForms((prev) => ({
                                    ...prev,
                                    [member.id]: { ...profileForm, birthDate: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Ghi chú</Label>
                              <div className="flex gap-2">
                                <Input
                                  value={profileForm.notes}
                                  onChange={(e) =>
                                    setProfileForms((prev) => ({
                                      ...prev,
                                      [member.id]: { ...profileForm, notes: e.target.value },
                                    }))
                                  }
                                  placeholder="Học sinh, đã đi làm..."
                                />
                                <Button
                                  size="icon"
                                  disabled={profileMut.isPending}
                                  onClick={() =>
                                    profileMut.mutate({
                                      memberId: member.id,
                                      data: {
                                        nickname: profileForm.nickname,
                                        relationship: profileForm.relationship,
                                        birthDate: profileForm.birthDate || null,
                                        notes: profileForm.notes,
                                      },
                                    })
                                  }
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        <IncomeSourceManager memberId={member.id} canEdit={canEditFinance} />
                      </div>
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
            <DialogTitle>Mời thành viên mới</DialogTitle>
            <DialogDescription>Tạo link mời và chia sẻ cho thành viên gia đình</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'PARENT' | 'FAMILY_MEMBER')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARENT">Chủ hộ / Phụ huynh</SelectItem>
                  <SelectItem value="FAMILY_MEMBER">Thành viên gia đình</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vai vế trong gia đình</Label>
              <Select value={inviteRelationship} onValueChange={(v) => setInviteRelationship(v as FamilyRelationship)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!inviteCode ? (
              <Button className="w-full" onClick={() => inviteMut.mutate({ role: inviteRole, relationship: inviteRelationship })} disabled={inviteMut.isPending}>
                {inviteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Tạo link mời
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>Link mời (có hiệu lực 7 ngày)</Label>
                <div className="flex gap-2">
                  <Input value={`${window.location.origin}/register?invite=${inviteCode}`} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyInviteLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Chia sẻ link này cho thành viên muốn mời</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlanId={family?.subscriptionPlan?.id ?? null}
      />
    </div>
  )
}
