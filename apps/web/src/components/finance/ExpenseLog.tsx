/**
 * @file ExpenseLog.tsx
 * @description Tab "Ghi thu/chi" — tách 3 form rõ ràng:
 *  - Thu nhập thực tế (mọi member)
 *  - Chi cá nhân (mọi member)
 *  - Chi chung gia đình (PARENT)
 *
 * Mỗi form có checkbox cập nhật sổ ghi nhận nội bộ. Đây là ledger demo,
 * không phải ví điện tử thật hoặc giao dịch thanh toán.
 *
 * Danh sách nhật ký phía dưới gộp 3 loại theo `occurredAt` và badge phân biệt
 * (có/không cập nhật ledger).
 */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Loader2, Receipt, TrendingUp, ArrowDownToLine } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useActualIncomes,
  useCreateActualIncome,
  useCreateFamilyExpense,
  useCreatePersonalExpense,
  useFamilyExpenses,
  usePersonalExpenses,
  type IncomeSource,
} from '@/hooks/useFinance'

const PERSONAL_CATEGORIES = ['Ăn vặt', 'Đi chơi', 'Mua sắm', 'Đi lại', 'Khác']
const FAMILY_CATEGORIES = ['Tiền nhà', 'Điện', 'Nước', 'Ăn uống', 'Internet', 'Khác']
const SOURCE_LABELS: Record<IncomeSource['sourceType'], string> = {
  SALARY: 'Lương',
  BUSINESS: 'Kinh doanh',
  INVESTMENT: 'Đầu tư',
  ALLOWANCE: 'Trợ cấp',
  RENTAL: 'Cho thuê',
  FREELANCE: 'Freelance',
  OTHER: 'Khác',
}

export function ExpenseLog({ isParent, year, month }: { isParent: boolean; year?: number; month?: number }) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1
  const from = new Date(y, m - 1, 1).toISOString()
  const to = new Date(y, m, 1).toISOString()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActualIncomeForm defaultDate={isCurrentMonth(y, m) ? undefined : firstDayOfMonth(y, m)} />
        <PersonalExpenseForm defaultDate={isCurrentMonth(y, m) ? undefined : firstDayOfMonth(y, m)} />
        {isParent && <FamilyExpenseForm defaultDate={isCurrentMonth(y, m) ? undefined : firstDayOfMonth(y, m)} />}
      </div>
      <LedgerList from={from} to={to} monthLabel={`${m}/${y}`} />
    </div>
  )
}

function isCurrentMonth(y: number, m: number) {
  const now = new Date()
  return y === now.getFullYear() && m === now.getMonth() + 1
}
function firstDayOfMonth(y: number, m: number) {
  return new Date(y, m - 1, 1).toISOString().slice(0, 10)
}

function ActualIncomeForm({ defaultDate }: { defaultDate?: string }) {
  const [amount, setAmount] = useState('')
  const [sourceType, setSourceType] = useState<IncomeSource['sourceType']>('SALARY')
  const [note, setNote] = useState('')
  const [creditToWallet, setCreditToWallet] = useState(true)
  const create = useCreateActualIncome()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-green-700">
          <TrendingUp className="w-4 h-4" />Ghi thu nhập thực tế
        </CardTitle>
        <p className="text-xs text-muted-foreground">Mỗi lần thực sự nhận tiền (lương, freelance, thưởng...).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Số tiền (VND)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15000000" />
          </div>
          <div className="space-y-1">
            <Label>Nguồn</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as IncomeSource['sourceType'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SOURCE_LABELS) as [IncomeSource['sourceType'], string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lương tháng 5..." />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={creditToWallet}
            onChange={(e) => setCreditToWallet(e.target.checked)}
            className="rounded"
          />
          <ArrowDownToLine className="w-3.5 h-3.5 text-green-600" />
          Cập nhật sổ ghi nhận cá nhân của tôi
        </label>
        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          disabled={!amount || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                amount: Number(amount),
                sourceType,
                note: note || undefined,
                creditToWallet,
                occurredAt: defaultDate,
              })
              toast.success(creditToWallet ? 'Đã ghi thu & cập nhật sổ cá nhân' : 'Đã ghi thu nhập')
              setAmount('')
              setNote('')
            } catch (e) {
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
              toast.error(msg ?? 'Ghi thu nhập thất bại')
            }
          }}
        >
          {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ghi thu nhập
        </Button>
      </CardContent>
    </Card>
  )
}

function PersonalExpenseForm({ defaultDate }: { defaultDate?: string }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(PERSONAL_CATEGORIES[0])
  const [note, setNote] = useState('')
  const [deductFromWallet, setDeductFromWallet] = useState(true)
  const create = useCreatePersonalExpense()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-blue-700">
          <Receipt className="w-4 h-4" />Ghi chi cá nhân
        </CardTitle>
        <p className="text-xs text-muted-foreground">Chi tiêu riêng của bạn (đi chơi, ăn vặt...).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Số tiền (VND)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
          </div>
          <div className="space-y-1">
            <Label>Danh mục</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Trà sữa..." />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={deductFromWallet}
            onChange={(e) => setDeductFromWallet(e.target.checked)}
            className="rounded"
          />
          Cập nhật sổ ghi nhận cá nhân của tôi
        </label>
        <Button
          className="w-full"
          disabled={!amount || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                amount: Number(amount),
                category,
                note: note || undefined,
                deductFromWallet,
                occurredAt: defaultDate,
              })
              toast.success(deductFromWallet ? 'Đã ghi chi & cập nhật sổ cá nhân' : 'Đã ghi chi tiêu')
              setAmount('')
              setNote('')
            } catch (e) {
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
              toast.error(msg ?? 'Ghi chi tiêu thất bại')
            }
          }}
        >
          {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ghi chi cá nhân
        </Button>
      </CardContent>
    </Card>
  )
}

function FamilyExpenseForm({ defaultDate }: { defaultDate?: string }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(FAMILY_CATEGORIES[0])
  const [note, setNote] = useState('')
  const [deductFromWallet, setDeductFromWallet] = useState(true)
  const create = useCreateFamilyExpense()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-700">
          <Receipt className="w-4 h-4" />Ghi chi chung gia đình
        </CardTitle>
        <p className="text-xs text-muted-foreground">Chi cho cả nhà (tiền nhà, điện, nước...).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Số tiền (VND)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000000" />
          </div>
          <div className="space-y-1">
            <Label>Danh mục</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAMILY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hoá đơn điện tháng 5..." />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={deductFromWallet}
            onChange={(e) => setDeductFromWallet(e.target.checked)}
            className="rounded"
          />
          Cập nhật sổ quỹ gia đình
        </label>
        <Button
          className="w-full bg-amber-600 hover:bg-amber-700"
          disabled={!amount || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                amount: Number(amount),
                category,
                note: note || undefined,
                deductFromWallet,
                occurredAt: defaultDate,
              })
              toast.success(deductFromWallet ? 'Đã ghi chi & cập nhật sổ quỹ gia đình' : 'Đã ghi chi chung')
              setAmount('')
              setNote('')
            } catch (e) {
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
              toast.error(msg ?? 'Ghi chi chung thất bại')
            }
          }}
        >
          {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ghi chi chung
        </Button>
      </CardContent>
    </Card>
  )
}

function LedgerList({ from, to, monthLabel }: { from: string; to: string; monthLabel: string }) {
  const range = { from, to }
  const { data: incomes = [] } = useActualIncomes(range)
  const { data: personal = [] } = usePersonalExpenses(range)
  const { data: family = [] } = useFamilyExpenses(range)

  const rows = [
    ...incomes.map((e) => ({
      kind: 'income' as const,
      id: e.id,
      amount: Number(e.amount),
      category: SOURCE_LABELS[e.sourceType] ?? e.sourceType,
      note: e.note,
      occurredAt: e.occurredAt,
      walletFlag: e.creditedToWallet,
      who: e.member?.user.displayName,
    })),
    ...personal.map((e) => ({
      kind: 'personal' as const,
      id: e.id,
      amount: Number(e.amount),
      category: e.category,
      note: e.note,
      occurredAt: e.occurredAt,
      walletFlag: e.deductedFromWallet,
      who: e.member?.user.displayName,
    })),
    ...family.map((e) => ({
      kind: 'family' as const,
      id: e.id,
      amount: Number(e.amount),
      category: e.category,
      note: e.note,
      occurredAt: e.occurredAt,
      walletFlag: e.deductedFromWallet,
      who: e.paidBy?.user.displayName,
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Nhật ký thu / chi
          <span className="text-xs font-normal text-muted-foreground">Tháng {monthLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Receipt className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm mt-2">Chưa có khoản nào trong tháng {monthLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 30).map((r) => {
              const isIncome = r.kind === 'income'
              const kindLabel =
                r.kind === 'income' ? 'Thu' : r.kind === 'personal' ? 'Cá nhân' : 'Gia đình'
              const kindClass =
                r.kind === 'income'
                  ? 'bg-green-50 text-green-700'
                  : r.kind === 'personal'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-amber-50 text-amber-700'
              return (
                <div key={`${r.kind}-${r.id}`} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div className="flex items-start gap-2">
                    <span className={cn('inline-block px-1.5 py-0.5 text-[10px] rounded font-medium', kindClass)}>
                      {kindLabel}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{r.category}</p>
                      {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateTime(r.occurredAt)}
                        {r.who && ` · ${r.who}`}
                        {r.walletFlag && (
                          <span className="ml-1 text-gray-700">
                            · Ledger
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className={cn('text-sm font-semibold', isIncome ? 'text-green-600' : 'text-red-600')}>
                    {isIncome ? '+' : '-'}
                    {formatCurrency(r.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
