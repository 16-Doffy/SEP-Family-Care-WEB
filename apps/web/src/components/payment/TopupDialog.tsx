'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CreditCard } from 'lucide-react'
import { startCheckout } from '@/lib/payments'
import toast from 'react-hot-toast'

interface Wallet { id: string; name: string; type: string }

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 2_000_000]

export function TopupDialog({
  open,
  onOpenChange,
  wallets,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  wallets: Wallet[]
}) {
  const qc = useQueryClient()
  const jointWallets = wallets.filter((w) => w.type === 'JOINT')
  const [walletId, setWalletId] = useState<string>(jointWallets[0]?.id ?? '')
  const [amount, setAmount] = useState('')

  const topupMut = useMutation({
    mutationFn: () => startCheckout({ type: 'WALLET_TOPUP', amount: Number(amount), walletId }),
    onSuccess: (instant) => {
      if (instant) {
        toast.success(`💰 Đã nạp ${Number(amount).toLocaleString('vi-VN')} VND`)
        qc.invalidateQueries({ queryKey: ['wallets'] })
        qc.invalidateQueries({ queryKey: ['wallet-detail'] })
        onOpenChange(false)
        setAmount('')
      }
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Nạp tiền thất bại')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Nạp tiền qua cổng thanh toán
          </DialogTitle>
          <DialogDescription>
            Nạp tiền vào ví gia đình thông qua Stripe (mock mode khi chưa cấu hình)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ví nhận</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Chọn ví" /></SelectTrigger>
              <SelectContent>
                {jointWallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Số tiền (VND)</Label>
            <Input
              type="number"
              min="10000"
              placeholder="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(String(a))}
                  className="text-xs px-3 py-1 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {a.toLocaleString('vi-VN')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={() => topupMut.mutate()} disabled={topupMut.isPending || !walletId || !amount || Number(amount) < 10_000}>
            {topupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Nạp tiền
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
