/**
 * Trang tổng quan (Dashboard) của ứng dụng Family Care.
 * Hiển thị tóm tắt: số dư ví, nhiệm vụ, thành viên gia đình và nhiệm vụ gần đây.
 */
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

/**
 * Trang Dashboard — điểm đến đầu tiên sau khi đăng nhập.
 * Chỉ gọi API khi user đã có familyMember (đã tham gia gia đình),
 * tránh lỗi khi user vừa đăng ký chưa có gia đình.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'

  // Lấy thông tin gia đình bao gồm ví và danh sách thành viên
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  // Lấy danh sách nhiệm vụ để tính số liệu tóm tắt
  const { data: tasksData } = useQuery({
    queryKey: ['tasks-summary'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets-summary'],
    queryFn: () => api.get('/wallets').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  // Ví chung của gia đình thường là ví đầu tiên trong danh sách
  const jointWallet = wallets.find((w: { type: string }) => w.type === 'JOINT') ?? family?.wallets?.find?.((w: { type: string }) => w.type === 'JOINT') ?? family?.wallets?.[0]
  const personalWallet = wallets.find((w: { type: string }) => w.type === 'PERSONAL') ?? wallets[0]
  const walletSummary = isParent ? jointWallet : personalWallet
  const members = family?.members ?? []
  const tasks = tasksData ?? []
  // Đếm nhiệm vụ đang chờ phụ huynh duyệt
  const pendingApprovals = tasks.filter((t: { status: string }) => t.status === 'SUBMITTED').length
  // Đếm nhiệm vụ đang hoạt động (chưa làm hoặc đang làm)
  const activeTasks = tasks.filter((t: { status: string }) => ['PENDING', 'IN_PROGRESS'].includes(t.status)).length

  return (
    <div>
      <Topbar title={isParent ? 'Tổng quan phụ huynh' : 'Tổng quan của tôi'} />
      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Xin chào, {user?.displayName} 👋
          </h2>
          <p className="text-muted-foreground">
            {isParent ? 'Quản lý hoạt động gia đình' : 'Theo dõi ví cá nhân, nhiệm vụ và thông báo của bạn'} · {family?.name ?? 'Đang tải...'}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isParent ? 'Ví gia đình' : 'Ví cá nhân'}</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {walletSummary ? formatCurrency(Number(walletSummary.balance)) : '---'}
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
                  <p className="text-sm text-muted-foreground">{isParent ? 'Task đang làm' : 'Việc cần làm'}</p>
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
                  <p className="text-sm text-muted-foreground">{isParent ? 'Chờ duyệt' : 'Đã nộp chờ duyệt'}</p>
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
                  <p className="text-sm text-muted-foreground">{isParent ? 'Thành viên' : 'Người trong nhà'}</p>
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
            <CardTitle className="text-lg">{isParent ? 'Thành viên gia đình' : 'Gia đình của tôi'}</CardTitle>
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
            <CardTitle className="text-lg">{isParent ? 'Nhiệm vụ gần đây trong gia đình' : 'Nhiệm vụ của tôi gần đây'}</CardTitle>
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
