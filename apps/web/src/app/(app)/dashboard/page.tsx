'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getInitials } from '@/lib/utils'
import { Wallet, CheckSquare, Users, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-summary'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const jointWallet = family?.wallets?.[0]
  const members = family?.members ?? []
  const tasks = tasksData ?? []
  const pendingApprovals = tasks.filter((t: { status: string }) => t.status === 'SUBMITTED').length
  const activeTasks = tasks.filter((t: { status: string }) => ['PENDING', 'IN_PROGRESS'].includes(t.status)).length

  return (
    <div>
      <Topbar title="Tổng quan" />
      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Xin chào, {user?.displayName} 👋
          </h2>
          <p className="text-muted-foreground">{family?.name ?? 'Đang tải...'}</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ví gia đình</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {jointWallet ? formatCurrency(Number(jointWallet.balance)) : '---'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Task đang làm</p>
                  <p className="text-2xl font-bold text-orange-600">{activeTasks}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chờ duyệt</p>
                  <p className="text-2xl font-bold text-purple-600">{pendingApprovals}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Thành viên</p>
                  <p className="text-2xl font-bold text-green-600">{members.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thành viên gia đình</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member: { id: string; nickname?: string; user: { id: string; displayName: string; email: string; role: string; avatarUrl?: string } }) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {getInitials(member.user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                  <Badge variant={member.user.role === 'PARENT' ? 'default' : 'secondary'} className="text-xs">
                    {member.user.role === 'PARENT' ? 'Phụ huynh' : 'Con'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nhiệm vụ gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.slice(0, 5).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Chưa có nhiệm vụ nào</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task: { id: string; title: string; status: string; reward?: number; assignedTo?: { user: { displayName: string } } }) => (
                  <div key={task.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.assignedTo && (
                        <p className="text-xs text-muted-foreground">{task.assignedTo.user.displayName}</p>
                      )}
                    </div>
                    {task.reward && (
                      <span className="text-xs font-medium text-green-600">+{formatCurrency(task.reward)}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      task.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      task.status === 'SUBMITTED' ? 'bg-purple-100 text-purple-700' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {task.status === 'PENDING' ? 'Chờ' : task.status === 'IN_PROGRESS' ? 'Đang làm' : task.status === 'SUBMITTED' ? 'Chờ duyệt' : task.status === 'APPROVED' ? 'Xong' : task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
