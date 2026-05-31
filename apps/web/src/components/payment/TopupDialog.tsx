'use client'
/**
 * @module TopupDialog
 * @description Dialog ghi nhận nạp Family Fund qua luồng thanh toán mô phỏng.
 *
 * Cho phép người dùng:
 * - Chọn ví gia đình (loại JOINT) muốn nạp tiền vào.
 * - Nhập số tiền thủ công hoặc chọn nhanh từ các mệnh giá định sẵn.
 * - Nút ghi nhận Family Fund bị vô hiệu hoá nếu số tiền dưới 10.000 VND.
 *
 * Luồng thanh toán được xử lý bởi `startCheckout` (mock hoặc Stripe).
 * Sau khi nạp thành công (mock mode), làm mới danh sách ví và đóng dialog.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CreditCard, Wallet as WalletIcon, Landmark } from 'lucide-react'
import { startCheckout } from '@/lib/payments'
import toast from 'react-hot-toast'

/** Thông tin ví tối thiểu cần thiết để hiển thị trong dropdown */
interface Wallet { id: string; name: string; type: string }

/**
 * Danh sách mệnh giá nạp tiền nhanh (đơn vị VND).
 * Hiển thị dưới dạng các nút chip để chọn nhanh không cần gõ số.
 */
const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 2_000_000]

/**
 * Phương thức thanh toán hỗ trợ.
 * Hiện tại chỉ Stripe (ví gia đình) hoạt động;
 * MoMo và ngân hàng là tuỳ chọn dự kiến — chưa khả dụng.
 */
type PaymentMethod = 'STRIPE' | 'MOMO' | 'BANK'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; description: string; available: boolean }[] = [
  { value: 'STRIPE', label: 'Mock Payment', description: 'Ghi nhận nội bộ cho Family Fund', available: true },
  { value: 'MOMO', label: 'Ví MoMo', description: 'Sắp ra mắt', available: false },
  { value: 'BANK', label: 'Chuyển khoản ngân hàng', description: 'Sắp ra mắt', available: false },
]

/**
 * Dialog nạp tiền vào ví gia đình.
 *
 * @param open - Trạng thái mở/đóng dialog
 * @param onOpenChange - Callback khi trạng thái dialog thay đổi
 * @param wallets - Danh sách tất cả ví của người dùng (sẽ lọc ra các ví JOINT)
 */
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
  /** Chỉ hiển thị ví loại JOINT (ví gia đình chung) trong danh sách chọn */
  const jointWallets = wallets.filter((w) => w.type === 'JOINT')
  /** ID ví được chọn, mặc định là ví JOINT đầu tiên (nếu có) */
  const [walletId, setWalletId] = useState<string>(jointWallets[0]?.id ?? '')
  /** Số tiền nhập vào dạng chuỗi (để tương thích với input[type=number]) */
  const [amount, setAmount] = useState('')
  /** Phương thức thanh toán đang chọn — mặc định Stripe (ví gia đình) */
  const [method, setMethod] = useState<PaymentMethod>('STRIPE')

  /** Mutation thực hiện nạp tiền qua hàm `startCheckout` */
  const topupMut = useMutation({
    mutationFn: () => startCheckout({ type: 'WALLET_TOPUP', amount: Number(amount), walletId }),
    onSuccess: (instant) => {
      if (instant) {
        // Mock mode: nạp tiền thành công, làm mới cache ví và đóng dialog
        toast.success(`💰 Đã ghi nhận ${Number(amount).toLocaleString('vi-VN')} VND vào Family Fund`)
        qc.invalidateQueries({ queryKey: ['wallets'] })
        qc.invalidateQueries({ queryKey: ['wallet-detail'] })
        onOpenChange(false)
        setAmount('') // Reset form để lần sau mở lại bắt đầu từ đầu
      }
      // Stripe mode: trình duyệt đã redirect, không cần xử lý gì thêm
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Ghi nhận thất bại')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Ghi nhận Family Fund
          </DialogTitle>
          <DialogDescription>
            Đây là Family Fund/Internal Ledger dùng cho demo capstone; mock payment chỉ ghi nhận nội bộ, không phải ví điện tử thật.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Chọn phương thức thanh toán (chỉ Stripe khả dụng) */}
          <div className="space-y-2">
            <Label>Phương thức thanh toán</Label>
            <Select
              value={method}
              onValueChange={(v) => {
                const next = v as PaymentMethod
                const cfg = PAYMENT_METHODS.find((m) => m.value === next)
                if (cfg && !cfg.available) {
                  toast(`${cfg.label} sắp ra mắt — vui lòng dùng ví gia đình`, { icon: '🚧' })
                  return
                }
                setMethod(next)
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.value === 'BANK' ? Landmark : m.value === 'MOMO' ? WalletIcon : CreditCard
                  return (
                    <SelectItem key={m.value} value={m.value} disabled={!m.available}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                        {!m.available && (
                          <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            Sắp ra mắt
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Chọn ví gia đình nhận tiền */}
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

          {/* Nhập số tiền với các nút chọn nhanh */}
          <div className="space-y-2">
            <Label>Số tiền (VND)</Label>
            <Input
              type="number"
              min="10000"
              placeholder="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {/* Các nút chọn nhanh mệnh giá phổ biến */}
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
          {/* Nút ghi nhận Family Fund: vô hiệu hoá khi đang xử lý, chưa chọn ví, hoặc số tiền < 10.000 VND */}
          <Button onClick={() => topupMut.mutate()} disabled={topupMut.isPending || !walletId || !amount || Number(amount) < 10_000}>
            {topupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Ghi nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
