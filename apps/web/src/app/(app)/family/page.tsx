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
import { UserPlus, Copy, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FamilyPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteRole, setInviteRole] = useState<'PARENT' | 'CHILD'>('CHILD')

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const inviteMut = useMutation({
    mutationFn: (role: string) => api.post('/family/invite', { role }),
    onSuccess: (res) => setInviteCode(res.data.code),
  })

  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const members = family?.members ?? []

  const copyInviteLink = () => {
    const link = `${window.location.origin}/register?invite=${inviteCode}`
    navigator.clipboard.writeText(link)
    toast.success('Đã copy link mời!')
  }

  return (
    <div>
      <Topbar title="Gia đình" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{family?.name ?? 'Gia đình của bạn'}</h2>
            <p className="text-sm text-muted-foreground">Gói: {family?.subscriptionPlan?.name ?? family?.plan ?? 'FREE'}</p>
          </div>
          {isParent && (
            <Button onClick={() => setInviteOpen(true)}>
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
              {members.map((member: { id: string; nickname?: string; user: { id: string; displayName: string; email: string; role: string } }) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials(member.user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.user.displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                  <Badge variant={member.user.role === 'PARENT' ? 'default' : 'secondary'}>
                    {member.user.role === 'PARENT' ? 'Phụ huynh' : 'Con cái'}
                  </Badge>
                  {member.user.id === user?.id && (
                    <Badge variant="outline" className="text-xs">Bạn</Badge>
                  )}
                </div>
              ))}
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
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'PARENT' | 'CHILD')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARENT">Phụ huynh</SelectItem>
                  <SelectItem value="CHILD">Con cái</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!inviteCode ? (
              <Button className="w-full" onClick={() => inviteMut.mutate(inviteRole)} disabled={inviteMut.isPending}>
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
    </div>
  )
}
