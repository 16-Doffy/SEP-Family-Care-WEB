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
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, ArrowLeftRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface WalletType { id: string; name: string; type: string; balance: number | string; currency: string; owner?: { user: { displayName: string } } | null }
interface Transaction { id: string; amount: number; type: string; description?: string; createdAt: string; fromWallet?: { name: string } | null; toWallet?: { name: string } | null }

export default function WalletPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)

  const { data: wallets = [] } = useQuery<WalletType[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallets').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: walletDetail } = useQuery({
    queryKey: ['wallet-detail', selectedWallet?.id],
    queryFn: () => api.get(`/wallets/${selectedWallet!.id}`).then((r) => r.data),
    enabled: !!selectedWallet,
  })

  const [transferForm, setTransferForm] = useState({ fromWalletId: '', toWalletId: '', amount: '', description: '' })
  const [depositForm, setDepositForm] = useState({ walletId: '', amount: '', description: 'Nạp tiền' })

  const transferMut = useMutation({
    mutationFn: (data: typeof transferForm) => api.post('/wallets/transfer', { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      toast.success('Chuyển tiền thành công!')
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallet-detail'] })
      setTransferOpen(false)
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const depositMut = useMutation({
    mutationFn: (data: typeof depositForm) => api.post('/wallets/deposit', { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      toast.success('Nạp tiền thành công!')
      qc.invalidateQueries({ queryKey: ['wallets'] })
      setDepositOpen(false)
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'),
  })

  const isParent = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'
  const transactions: Transaction[] = walletDetail?.transactions ?? []

  return (
    <div>
      <Topbar title="Ví tiền" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Quản lý ví</h2>
          {isParent && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDepositOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Nạp tiền
              </Button>
              <Button onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="w-4 h-4 mr-2" />Chuyển tiền
              </Button>
            </div>
          )}
        </div>

        {/* Wallet cards */}
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

        {/* Transaction history */}
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
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển tiền</DialogTitle>
            <DialogDescription>Chuyển tiền giữa các ví trong gia đình</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Từ ví</Label>
              <Select value={transferForm.fromWalletId} onValueChange={(v) => setTransferForm({ ...transferForm, fromWalletId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn ví nguồn" /></SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} – {formatCurrency(Number(w.balance))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Đến ví</Label>
              <Select value={transferForm.toWalletId} onValueChange={(v) => setTransferForm({ ...transferForm, toWalletId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn ví đích" /></SelectTrigger>
                <SelectContent>
                  {wallets.filter((w) => w.id !== transferForm.fromWalletId).map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} – {formatCurrency(Number(w.balance))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND)</Label>
              <Input type="number" min="1000" placeholder="100000" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Input placeholder="Tiền tiêu vặt tuần này..." value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => transferMut.mutate(transferForm)} disabled={transferMut.isPending || !transferForm.fromWalletId || !transferForm.toWalletId || !transferForm.amount}>
              {transferMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Chuyển tiền
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nạp tiền</DialogTitle>
            <DialogDescription>Nạp tiền vào ví gia đình</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ví nhận</Label>
              <Select value={depositForm.walletId} onValueChange={(v) => setDepositForm({ ...depositForm, walletId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn ví" /></SelectTrigger>
                <SelectContent>
                  {wallets.filter(w => w.type === 'JOINT').map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND)</Label>
              <Input type="number" min="1000" placeholder="1000000" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Input value={depositForm.description} onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => depositMut.mutate(depositForm)} disabled={depositMut.isPending || !depositForm.walletId || !depositForm.amount}>
              {depositMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Nạp tiền
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
