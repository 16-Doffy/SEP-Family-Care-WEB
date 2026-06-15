'use client'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getFamilyRoleLabel, getInitials, formatDate } from '@/lib/utils'
import { KeyRound, Save, ShieldCheck, Trash2 } from 'lucide-react'

const relationshipLabel = (value?: string | null) => ({
  FATHER: 'Bo',
  MOTHER: 'Me',
  CHILD: 'Con',
  GRANDPARENT: 'Ong/Ba',
  SIBLING: 'Anh/Chi/Em',
  SPOUSE: 'Vo/Chong',
  RELATIVE: 'Nguoi than',
  OTHER: 'Chua dat',
}[value ?? 'OTHER'] ?? 'Chua dat')

interface SessionRow { id: string; createdAt: string; expiresAt: string }
interface MyStats { completedTasks: number; totalReward: number; sosCount: number; moneyRequests: number }

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const qc = useQueryClient()
  const member = user?.familyMember
  const [profile, setProfile] = useState({ displayName: '', avatarUrl: '' })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' })

  useEffect(() => {
    setProfile({ displayName: user?.displayName ?? '', avatarUrl: user?.avatarUrl ?? '' })
  }, [user?.displayName, user?.avatarUrl])

  const { data: stats } = useQuery<MyStats>({
    queryKey: ['me-stats'],
    queryFn: () => api.get('/auth/me/stats').then((r) => r.data),
  })

  const { data: sessions = [] } = useQuery<SessionRow[]>({
    queryKey: ['me-sessions'],
    queryFn: () => api.get('/auth/me/sessions').then((r) => r.data),
  })

  const updateProfile = useMutation({
    mutationFn: () => api.patch('/auth/me', {
      displayName: profile.displayName.trim(),
      avatarUrl: profile.avatarUrl.trim() || null,
    }).then((r) => r.data),
    onSuccess: (data) => {
      setUser(data)
      toast.success('Da cap nhat ho so')
    },
    onError: () => toast.error('Khong cap nhat duoc ho so'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', password),
    onSuccess: () => {
      setPassword({ currentPassword: '', newPassword: '' })
      toast.success('Da doi mat khau. Hay dang nhap lai neu token het han.')
    },
    onError: () => toast.error('Khong doi duoc mat khau'),
  })

  const revokeSession = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/me/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-sessions'] })
      toast.success('Da thu hoi phien')
    },
    onError: () => toast.error('Khong thu hoi duoc phien'),
  })

  return (
    <div>
      <Topbar title="Ho so & cai dat" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ho so ca nhan</CardTitle>
          </CardHeader>
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
                  <Badge variant={member?.isOwner ? 'default' : user?.role === 'PARENT' ? 'outline' : 'secondary'}>Quyen: {getFamilyRoleLabel({ user, isOwner: member?.isOwner })}</Badge>
                  {member && <Badge variant="outline">Vai ve: {relationshipLabel(member.relationship)}</Badge>}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ten hien thi</Label>
                <Input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <Button className="gap-2" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending || !profile.displayName.trim()}>
              <Save className="w-4 h-4" /> Luu ho so
            </Button>
          </CardContent>
        </Card>

        {member?.family && (
          <Card>
            <CardHeader>
              <CardTitle>Thong tin trong gia dinh</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ten gia dinh</span><span className="font-medium">{member.family.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Biet danh</span><span className="font-medium">{member.nickname ?? 'Chua dat'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vai ve</span><span className="font-medium">{relationshipLabel(member.relationship)}</span></div>
              {member.birthDate && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ngay sinh</span><span className="font-medium">{formatDate(member.birthDate)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Goi dang ky</span><Badge variant="outline">{member.family.plan}</Badge></div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Thong ke ca nhan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Stat label="Task da duyet" value={stats?.completedTasks ?? 0} />
            <Stat label="Reward record" value={`${(stats?.totalReward ?? 0).toLocaleString('vi-VN')}d`} />
            <Stat label="SOS da gui" value={stats?.sosCount ?? 0} />
            <Stat label="Yeu cau ho tro" value={stats?.moneyRequests ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bao mat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mat khau hien tai</Label>
                <Input type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Mat khau moi</Label>
                <Input type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} />
              </div>
            </div>
            <Button className="gap-2" variant="outline" onClick={() => changePassword.mutate()} disabled={changePassword.isPending || password.newPassword.length < 6 || !password.currentPassword}>
              <KeyRound className="w-4 h-4" /> Doi mat khau
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phien dang nhap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Khong co phien refresh token dang hoat dong.</p>
            ) : sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Tao luc {formatDate(s.createdAt)}</p>
                  <p className="text-muted-foreground">Het han {formatDate(s.expiresAt)}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => revokeSession.mutate(s.id)} title="Thu hoi phien">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
