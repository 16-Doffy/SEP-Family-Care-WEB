/**
 * Finance ledger page for internal family records.
 * This UI does not present Family Fund as a real e-wallet or payment balance.
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Wallet, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Loader2, HandCoins, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { FinanceOverview } from '@/components/finance/FinanceOverview'
import { PersonalOverview } from '@/components/finance/PersonalOverview'
import { BudgetTable } from '@/components/finance/BudgetTable'
import { ExpenseLog } from '@/components/finance/ExpenseLog'
import { MonthSelector } from '@/components/finance/MonthSelector'
import { useMonthlySummary, usePrediction, useWarnings } from '@/hooks/useFinance'

/** Backend wallet model shown as an internal ledger record. */
interface WalletType { id: string; name: string; type: string; balance: number | string; currency: string; owner?: { user: { displayName: string } } | null }

/** Existing transaction model shown as an internal ledger entry. */
interface Transaction { id: string; amount: number; type: string; description?: string; createdAt: string; fromWallet?: { name: string } | null; toWallet?: { name: string } | null }

/** Spending support request from a member to a manager/deputy. */
interface MoneyRequest {
  id: string; amount: number; reason?: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; note?: string | null
  createdAt: string; resolvedAt?: string | null
  requester: { user: { id: string; displayName: string; avatarUrl?: string | null } }
  resolvedBy?: { user: { displayName: string } } | null
}

/** Display config for spending support request status. */
const MR_STATUS = {
  PENDING: { label: 'Chờ duyệt', icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  APPROVED: { label: 'Đã duyệt', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
  REJECTED: { label: 'Từ chối', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
}

/**
 * Finance page shown as internal ledger and planning records only.
 */
export default function WalletPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState<MoneyRequest | null>(null)
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)
  const isParentEarly = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const [activeTab, setActiveTab] = useState<'overview' | 'wallets' | 'budget' | 'log' | 'requests'>(
    isParentEarly ? 'overview' : 'overview',
  )
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const { data: summary } = useMonthlySummary(selectedYear, selectedMonth)
  const { data: forecast } = usePrediction(3)
  const { data: warnings } = useWarnings()

  const { data: wallets = [] } = useQuery<WalletType[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallets').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  // Load ledger-like detail from the existing wallet detail endpoint.
  const { data: walletDetail } = useQuery({
    queryKey: ['wallet-detail', selectedWallet?.id],
    queryFn: () => api.get(`/wallets/${selectedWallet!.id}`).then((r) => r.data),
    enabled: !!selectedWallet,
  })

  const { data: mrData } = useQuery<{ requests: MoneyRequest[] }>({
    queryKey: ['money-requests'],
    queryFn: () => api.get('/money-requests').then((r) => r.data),
    enabled: !!user?.familyMember,
  })
  const moneyRequests = mrData?.requests ?? []
  // Count pending spending support requests for the tab badge.
  const pendingCount = moneyRequests.filter((r) => r.status === 'PENDING').length

  const [transferForm, setTransferForm] = useState({ fromWalletId: '', toWalletId: '', amount: '', description: '' })
  const [requestForm, setRequestForm] = useState({ amount: '', reason: '' })
  const [rejectNote, setRejectNote] = useState('')

  const transferMut = useMutation({
    mutationFn: (data: typeof transferForm) => api.post('/wallets/transfer', { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      toast.success('Đã ghi nhận phân bổ nội bộ')
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallet-detail'] })
      setTransferOpen(false)
      setTransferForm({ fromWalletId: '', toWalletId: '', amount: '', description: '' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const requestMut = useMutation({
    mutationFn: (data: typeof requestForm) => api.post('/money-requests', { amount: Number(data.amount), reason: data.reason }),
    onSuccess: () => {
      toast.success('Đã gửi yêu cầu hỗ trợ chi tiêu')
      qc.invalidateQueries({ queryKey: ['money-requests'] })
      setRequestOpen(false)
      setRequestForm({ amount: '', reason: '' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const resolveMut = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api.patch(`/money-requests/${id}`, { status, note }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'Đã duyệt yêu cầu!' : 'Đã từ chối yêu cầu')
      qc.invalidateQueries({ queryKey: ['money-requests'] })
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallet-detail'] })
      setRejectOpen(null)
      setRejectNote('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  // SUPER_ADMIN is treated as a workspace manager for demo/admin flows.
  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const pageTitle = 'Sổ quỹ & kế hoạch tài chính'
  const requestTabLabel = isParent ? 'Yêu cầu hỗ trợ chi tiêu' : 'Yêu cầu hỗ trợ của tôi'
  const transactions: Transaction[] = walletDetail?.transactions ?? []

  return (
    <div className="flex h-screen flex-col">
      <Topbar title={pageTitle} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg flex-wrap">
              <button
                onClick={() => setActiveTab('overview')}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', activeTab === 'overview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                {isParent ? 'Tổng quan gia đình' : 'Tổng quan của tôi'}
              </button>
              <button
                onClick={() => setActiveTab('wallets')}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', activeTab === 'wallets' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                {isParent ? 'Sổ quỹ gia đình' : 'Sổ ghi nhận cá nhân'}
              </button>
              <button
                onClick={() => setActiveTab('budget')}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', activeTab === 'budget' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                {isParent ? 'Ngân sách tháng' : 'Ngân sách cá nhân'}
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', activeTab === 'log' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                {isParent ? 'Ghi nhận thu / chi' : 'Ghi nhận của tôi'}
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative', activeTab === 'requests' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                {requestTabLabel}
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isParent
                ? 'Family Manager/Deputy quản lý sổ quỹ nội bộ, ngân sách và yêu cầu hỗ trợ chi tiêu. Đây không phải ví điện tử thật.'
                : 'Bạn ghi nhận thu/chi cá nhân và gửi yêu cầu hỗ trợ chi tiêu khi cần. Không có giao dịch tiền thật trong hệ thống.'}
            </p>
          </div>

          <div className="flex gap-2">
            {!isParent && (
              <Button variant="outline" onClick={() => setRequestOpen(true)} className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                <HandCoins className="w-4 h-4" />Gửi yêu cầu hỗ trợ
              </Button>
            )}
            {isParent && (
              <Button onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="w-4 h-4 mr-2" />Phân bổ nội bộ
              </Button>
            )}
          </div>
        </div>

        {/* Thanh chọn tháng — áp dụng cho overview/budget/log */}
        {(activeTab === 'overview' || activeTab === 'budget' || activeTab === 'log') && (
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => {
              setSelectedYear(y)
              setSelectedMonth(m)
            }}
          />
        )}

        {/* === TAB: OVERVIEW === */}
        {activeTab === 'overview' && isParent && (
          <FinanceOverview summary={summary} forecast={forecast} warnings={warnings} />
        )}
        {activeTab === 'overview' && !isParent && (
          <PersonalOverview
            summary={summary}
            warnings={warnings}
            currentMemberId={user?.familyMember?.id}
            personalWalletBalance={Number(
              // FAMILY_MEMBER backend đã filter wallets về của mình → lấy PERSONAL wallet đầu tiên
              wallets.find((w) => w.type === 'PERSONAL')?.balance ?? 0,
            )}
          />
        )}

        {/* === TAB: BUDGET === */}
        {activeTab === 'budget' && summary && (
          <BudgetTable summary={summary} isParent={isParent} currentMemberId={user?.familyMember?.id} />
        )}

        {/* === TAB: EXPENSE LOG === */}
        {activeTab === 'log' && (
          <ExpenseLog isParent={isParent} year={selectedYear} month={selectedMonth} />
        )}

        {/* === TAB: WALLETS === */}
        {activeTab === 'wallets' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wallets.map((wallet) => (
                <Card
                  key={wallet.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedWallet?.id === wallet.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
                  onClick={() => setSelectedWallet(wallet)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wallet.type === 'JOINT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {wallet.type === 'JOINT' ? 'Gia đình' : 'Cá nhân'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{wallet.name}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(Number(wallet.balance))}</p>
                    {wallet.owner && (
                      <p className="text-xs text-muted-foreground mt-1">{wallet.owner.user.displayName}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedWallet && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lịch sử giao dịch – {selectedWallet.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Chưa có giao dịch nào</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => {
                        // Xác định chiều giao dịch: nhận vào (xanh) hay gửi đi (đỏ)
                        const isIncoming = tx.toWallet?.name === selectedWallet.name
                        return (
                          <div key={tx.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncoming ? 'bg-green-100' : 'bg-red-100'}`}>
                              {isIncoming ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                              {tx.fromWallet && tx.toWallet && (
                                <p className="text-xs text-muted-foreground">{tx.fromWallet.name} → {tx.toWallet.name}</p>
                              )}
                            </div>
                            <p className={`font-semibold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncoming ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* === TAB: MONEY REQUESTS === */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {moneyRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <HandCoins className="w-10 h-10 opacity-30" />
                <p className="text-sm">{isParent ? 'Chưa có yêu cầu hỗ trợ chi tiêu nào từ thành viên' : 'Bạn chưa gửi yêu cầu hỗ trợ chi tiêu nào'}</p>
              </div>
            ) : (
              moneyRequests.map((mr) => {
                const cfg = MR_STATUS[mr.status]
                const StatusIcon = cfg.icon
                return (
                  <div key={mr.id} className="bg-white rounded-xl border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-semibold text-amber-700 text-sm">
                          {mr.requester.user.displayName[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{mr.requester.user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(mr.createdAt)}</p>
                        </div>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border', cfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold text-amber-600">{formatCurrency(Number(mr.amount))}</p>
                        {mr.reason && <p className="text-sm text-gray-600 mt-0.5">"{mr.reason}"</p>}
                      </div>
                    </div>

                    {mr.note && (
                      <p className="text-xs text-muted-foreground bg-gray-50 rounded px-3 py-2">
                        Ghi chú: {mr.note}
                      </p>
                    )}

                    {mr.resolvedBy && (
                      <p className="text-xs text-muted-foreground">
                        {mr.status === 'APPROVED' ? 'Duyệt bởi' : 'Từ chối bởi'} {mr.resolvedBy.user.displayName}
                        {mr.resolvedAt && ` lúc ${new Date(mr.resolvedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    )}

                    {isParent && mr.status === 'PENDING' && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          onClick={() => resolveMut.mutate({ id: mr.id, status: 'APPROVED' })}
                          disabled={resolveMut.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 gap-1"
                          onClick={() => { setRejectOpen(mr); setRejectNote('') }}
                          disabled={resolveMut.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />Từ chối
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Internal allocation modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phân bổ nội bộ</DialogTitle>
            <DialogDescription>Ghi nhận phân bổ giữa các sổ quỹ nội bộ. Không xử lý thanh toán thật.</DialogDescription>
          </DialogHeader>
          {(() => {
            const fromWallet = wallets.find((w) => w.id === transferForm.fromWalletId)
            const fromBalance = fromWallet ? Number(fromWallet.balance) : 0
            const transferAmount = Number(transferForm.amount) || 0
            const insufficient = !!transferForm.fromWalletId && transferAmount > 0 && transferAmount > fromBalance
            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Từ sổ quỹ</Label>
                  <Select value={transferForm.fromWalletId} onValueChange={(v) => setTransferForm({ ...transferForm, fromWalletId: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn sổ quỹ nguồn" /></SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name} – {formatCurrency(Number(w.balance))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromWallet && (
                    <p className="text-xs text-muted-foreground">Số liệu hiện tại: <span className="font-medium text-gray-700">{formatCurrency(fromBalance)}</span></p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Đến sổ ghi nhận</Label>
                  <Select value={transferForm.toWalletId} onValueChange={(v) => setTransferForm({ ...transferForm, toWalletId: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn sổ ghi nhận đích" /></SelectTrigger>
                    <SelectContent>
                      {wallets.filter((w) => w.id !== transferForm.fromWalletId).map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name} – {formatCurrency(Number(w.balance))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Số tiền ghi nhận (VND)</Label>
                  <Input
                    type="number" min="1000" placeholder="100000"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    className={insufficient ? 'border-red-400 focus-visible:ring-red-400' : ''}
                  />
                  {insufficient && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      Số liệu nguồn không đủ. Sổ quỹ chỉ còn {formatCurrency(fromBalance)}.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Ghi chú</Label>
                  <Input placeholder="Phân bổ allowance tuần này, hỗ trợ học phí..." value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>Hủy</Button>
                  <Button
                    onClick={() => transferMut.mutate(transferForm)}
                    disabled={transferMut.isPending || !transferForm.fromWalletId || !transferForm.toWalletId || !transferForm.amount || insufficient}
                  >
                    {transferMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Ghi nhận phân bổ
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Spending support request modal */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yêu cầu hỗ trợ chi tiêu</DialogTitle>
            <DialogDescription>Gửi yêu cầu để Family Manager/Deputy xem xét và ghi nhận nội bộ nếu được duyệt.</DialogDescription>
          </DialogHeader>
          {(() => {
            const jointBalance = summary?.jointWalletBalance ?? 0
            const reqAmount = Number(requestForm.amount) || 0
            const exceedsFund = reqAmount > 0 && reqAmount > jointBalance
            return (
              <div className="space-y-4">
                <div className="rounded-lg border bg-blue-50/40 px-3 py-2 text-xs">
                  <p className="text-muted-foreground">Sổ quỹ gia đình hiện ghi nhận</p>
                  <p className="font-semibold text-blue-700 text-base">
                    {formatCurrency(jointBalance)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Số tiền cần hỗ trợ (VND) *</Label>
                  <Input
                    type="number" min="1000" placeholder="50000"
                    value={requestForm.amount}
                    onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                    className={exceedsFund ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
                  />
                  {exceedsFund && (
                    <p className="text-xs text-amber-600">
                      Số tiền yêu cầu lớn hơn số liệu quỹ chung. Manager/Deputy có thể từ chối.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Lý do</Label>
                  <Input
                    placeholder="Mua sách giáo khoa, tiền xe bus..."
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                  />
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Hủy</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => requestMut.mutate(requestForm)}
              disabled={requestMut.isPending || !requestForm.amount}
            >
              {requestMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with note modal */}
      <Dialog open={!!rejectOpen} onOpenChange={() => { setRejectOpen(null); setRejectNote('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu</DialogTitle>
            <DialogDescription>
              Từ chối yêu cầu {formatCurrency(Number(rejectOpen?.amount))} của {rejectOpen?.requester.user.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Lý do từ chối (không bắt buộc)</Label>
            <Input
              placeholder="Hết tiền rồi, tuần sau nhé..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => rejectOpen && resolveMut.mutate({ id: rejectOpen.id, status: 'REJECTED', note: rejectNote })}
              disabled={resolveMut.isPending}
            >
              {resolveMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
