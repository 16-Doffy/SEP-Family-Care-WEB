/**
 * @file ErdFinancePanel.tsx
 * @description Tab "Sổ quỹ & Lọ (ERD)" — internal ledger theo mô hình ERD:
 * FinanceModel/Jar, LedgerEntry (phân loại + lọ), BudgetPlan planned-vs-actual.
 * Đây là sổ ghi nhận nội bộ, không phải ví điện tử thật.
 */
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { Loader2, PiggyBank, Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

interface Jar { id: string; name: string; purpose?: string | null; color: string; allocationRatio: number; allocatedThisMonth: number; currentAmount: number }
interface BudgetLine { id: string; name: string; categoryId: string | null; jarId: string | null; plannedAmount: number; actualAmount: number }
interface Budget { id: string; name: string; periodType: string; expectedSharedIncome: number | null; expectedSharedExpense: number | null; lines: BudgetLine[] }
interface Entry { id: string; type: string; amount: number; title: string; essentialType: string; entryDate: string; category?: { id: string; name: string } | null; jar?: { id: string; name: string; color: string } | null; recordedBy?: string | null }
interface Category { id: string; name: string; type: 'INCOME' | 'EXPENSE' }
interface Overview {
  ledger: { id: string; name: string; balance: number; currency: string }
  totals: { inflow: number; outflow: number; monthIncome: number; monthExpense: number }
  model: { id: string; name: string; type: string } | null
  jars: Jar[]
  budget: Budget | null
  recentEntries: Entry[]
}

const ENTRY_LABELS: Record<string, string> = {
  INCOME: 'Thu nhập', EXPENSE: 'Chi tiêu', CONTRIBUTION: 'Đóng góp quỹ',
  ALLOWANCE: 'Phụ cấp', REWARD: 'Thưởng', SUPPORT: 'Hỗ trợ',
}
const INFLOW = new Set(['INCOME', 'CONTRIBUTION'])

const FIVE_JARS = [
  { name: 'Thiết yếu', allocationRatio: 55, purpose: 'Ăn ở, hoá đơn, đi lại' },
  { name: 'Tiết kiệm dài hạn', allocationRatio: 10, purpose: 'Quỹ dự phòng/mục tiêu lớn' },
  { name: 'Giáo dục', allocationRatio: 10, purpose: 'Học phí, sách vở' },
  { name: 'Hưởng thụ', allocationRatio: 10, purpose: 'Giải trí, du lịch' },
  { name: 'Tự do tài chính', allocationRatio: 10, purpose: 'Đầu tư' },
  { name: 'Cho đi', allocationRatio: 5, purpose: 'Từ thiện, quà tặng' },
]
const EIGHTY_TWENTY = [
  { name: 'Chi tiêu (80%)', allocationRatio: 80, purpose: 'Chi tiêu sinh hoạt' },
  { name: 'Tiết kiệm (20%)', allocationRatio: 20, purpose: 'Tiết kiệm & đầu tư' },
]

export function ErdFinancePanel({ isParent }: { isParent: boolean }) {
  const qc = useQueryClient()
  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ['erd-finance-overview'],
    queryFn: () => api.get('/finance/erd/overview').then((r) => r.data),
  })
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['erd-finance-categories'],
    queryFn: () => api.get('/finance/erd/categories').then((r) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['erd-finance-overview'] })
    qc.invalidateQueries({ queryKey: ['erd-finance-categories'] })
  }

  const setupModel = useMutation({
    mutationFn: (body: { type: string; jars: typeof FIVE_JARS }) => api.post('/finance/erd/model', body),
    onSuccess: () => { toast.success('Đã thiết lập mô hình tài chính'); invalidate() },
    onError: () => toast.error('Không thiết lập được mô hình'),
  })

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Đang tải sổ quỹ...</p>
  }
  if (!overview) return null

  // Chưa có mô hình → màn thiết lập.
  if (!overview.model) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PiggyBank className="w-5 h-5 text-blue-600" />Chọn mô hình tài chính</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sổ quỹ gia đình theo ERD dùng mô hình chia lọ (jar) để phân bổ thu nhập. Đây là bản ghi nội bộ — không phải ví điện tử thật.
          </p>
          {isParent ? (
            <div className="flex flex-wrap gap-3">
              <Button disabled={setupModel.isPending} onClick={() => setupModel.mutate({ type: 'FIVE_JARS', jars: FIVE_JARS })}>
                {setupModel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dùng mô hình 5 chiếc lọ'}
              </Button>
              <Button variant="outline" disabled={setupModel.isPending} onClick={() => setupModel.mutate({ type: 'EIGHTY_TWENTY', jars: EIGHTY_TWENTY })}>
                Dùng mô hình 80/20
              </Button>
            </div>
          ) : (
            <p className="text-sm text-amber-600">Quản gia chưa thiết lập mô hình tài chính cho gia đình.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<Wallet className="w-5 h-5 text-blue-600" />} label="Số dư sổ quỹ" value={overview.ledger.balance} tone="blue" />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Thu nhập tháng này" value={overview.totals.monthIncome} tone="green" />
        <SummaryCard icon={<TrendingDown className="w-5 h-5 text-red-600" />} label="Chi tiêu tháng này" value={overview.totals.monthExpense} tone="red" />
      </div>

      {/* Jars */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Các lọ — {overview.model.name}</CardTitle>
          <span className="text-xs text-muted-foreground">Phân bổ theo % thu nhập tháng</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.jars.map((j) => (
              <div key={j.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: j.color }} />
                    <span className="font-medium text-sm">{j.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{j.allocationRatio}%</span>
                </div>
                {j.purpose && <p className="text-xs text-muted-foreground mb-2">{j.purpose}</p>}
                <p className="text-xs text-muted-foreground">Phân bổ tháng này</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(j.allocatedThisMonth)}</p>
                <p className={cn('text-xs mt-1', j.currentAmount >= 0 ? 'text-green-600' : 'text-red-600')}>
                  Đã ghi vào lọ: {formatCurrency(j.currentAmount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget planned vs actual */}
      {overview.budget && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ngân sách: {overview.budget.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.budget.lines.length === 0 && <p className="text-sm text-muted-foreground">Chưa có dòng ngân sách.</p>}
            {overview.budget.lines.map((l) => {
              const pct = l.plannedAmount > 0 ? Math.min(100, Math.round((l.actualAmount / l.plannedAmount) * 100)) : 0
              const over = l.actualAmount > l.plannedAmount
              return (
                <div key={l.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{l.name}</span>
                    <span className={cn(over ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                      {formatCurrency(l.actualAmount)} / {formatCurrency(l.plannedAmount)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={cn('h-full rounded-full', over ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AddEntryForm jars={overview.jars} categories={categories} onDone={invalidate} />
        <RecentEntries entries={overview.recentEntries} />
      </div>

      {isParent && <ManagerTools jars={overview.jars} categories={categories} onDone={invalidate} />}
    </div>
  )
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'blue' | 'green' | 'red' }) {
  const bg = { blue: 'bg-blue-100', green: 'bg-green-100', red: 'bg-red-100' }[tone]
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', bg)}>{icon}</div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  )
}

function AddEntryForm({ jars, categories, onDone }: { jars: Jar[]; categories: Category[]; onDone: () => void }) {
  const [form, setForm] = useState({ type: 'EXPENSE', amount: '', title: '', jarId: '', categoryId: '', essentialType: 'NA' })
  const m = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/erd/entries', body),
    onSuccess: () => { toast.success('Đã ghi nhận giao dịch'); setForm({ type: 'EXPENSE', amount: '', title: '', jarId: '', categoryId: '', essentialType: 'NA' }); onDone() },
    onError: () => toast.error('Không ghi được giao dịch'),
  })
  const submit = () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return toast.error('Nhập số tiền hợp lệ')
    if (!form.title.trim()) return toast.error('Nhập mô tả')
    m.mutate({
      type: form.type,
      amount,
      title: form.title.trim(),
      ...(form.jarId ? { jarId: form.jarId } : {}),
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      ...(form.essentialType !== 'NA' ? { essentialType: form.essentialType } : {}),
    })
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Plus className="w-4 h-4" />Ghi nhận giao dịch</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Loại</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['INCOME', 'EXPENSE', 'CONTRIBUTION'].map((t) => <SelectItem key={t} value={t}>{ENTRY_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Số tiền</Label>
            <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Mô tả</Label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="VD: Đi chợ tuần 1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lọ (jar)</Label>
            <Select value={form.jarId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, jarId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Không gán" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không gán</SelectItem>
                {jars.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Danh mục</Label>
            <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Không gán" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không gán</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.type === 'EXPENSE' && (
          <div>
            <Label className="text-xs">Tính chất chi</Label>
            <Select value={form.essentialType} onValueChange={(v) => setForm((f) => ({ ...f, essentialType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NA">Không phân loại</SelectItem>
                <SelectItem value="ESSENTIAL">Thiết yếu</SelectItem>
                <SelectItem value="NON_ESSENTIAL">Không thiết yếu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button className="w-full" disabled={m.isPending} onClick={submit}>
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ghi nhận'}
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentEntries({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Giao dịch gần đây</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>}
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {entries.map((e) => {
            const inflow = INFLOW.has(e.type)
            return (
              <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ENTRY_LABELS[e.type] ?? e.type}
                    {e.jar && <> · <span style={{ color: e.jar.color }}>{e.jar.name}</span></>}
                    {e.category && <> · {e.category.name}</>}
                  </p>
                </div>
                <span className={cn('text-sm font-semibold shrink-0 ml-2', inflow ? 'text-green-600' : 'text-red-600')}>
                  {inflow ? '+' : '−'}{formatCurrency(e.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ManagerTools({ jars, categories, onDone }: { jars: Jar[]; categories: Category[]; onDone: () => void }) {
  const [cat, setCat] = useState({ name: '', type: 'EXPENSE', jarId: '' })
  const [budget, setBudget] = useState({ name: 'Ngân sách tháng', lines: [{ name: '', categoryId: '', plannedAmount: '' }] })

  const addCat = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/erd/categories', body),
    onSuccess: () => { toast.success('Đã thêm danh mục'); setCat({ name: '', type: 'EXPENSE', jarId: '' }); onDone() },
    onError: () => toast.error('Không thêm được danh mục'),
  })
  const saveBudget = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/erd/budget-plans', body),
    onSuccess: () => { toast.success('Đã tạo ngân sách'); onDone() },
    onError: () => toast.error('Không tạo được ngân sách'),
  })

  return (
    <Card className="border-dashed">
      <CardHeader><CardTitle className="text-base text-muted-foreground">Công cụ quản gia: danh mục & ngân sách</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add category */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Thêm danh mục</Label>
          <Input placeholder="Tên danh mục" value={cat.name} onChange={(e) => setCat((c) => ({ ...c, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={cat.type} onValueChange={(v) => setCat((c) => ({ ...c, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Chi</SelectItem>
                <SelectItem value="INCOME">Thu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cat.jarId || 'none'} onValueChange={(v) => setCat((c) => ({ ...c, jarId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Lọ mặc định" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không gán lọ</SelectItem>
                {jars.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={addCat.isPending || !cat.name.trim()}
            onClick={() => addCat.mutate({ name: cat.name.trim(), type: cat.type, ...(cat.jarId ? { defaultJarId: cat.jarId } : {}) })}>
            {addCat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Thêm danh mục'}
          </Button>
        </div>

        {/* Create budget */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tạo ngân sách (planned vs actual)</Label>
          <Input placeholder="Tên ngân sách" value={budget.name} onChange={(e) => setBudget((b) => ({ ...b, name: e.target.value }))} />
          {budget.lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input className="col-span-5" placeholder="Tên dòng" value={line.name}
                onChange={(e) => setBudget((b) => ({ ...b, lines: b.lines.map((l, idx) => idx === i ? { ...l, name: e.target.value } : l) }))} />
              <div className="col-span-4">
                <Select value={line.categoryId || 'none'} onValueChange={(v) => setBudget((b) => ({ ...b, lines: b.lines.map((l, idx) => idx === i ? { ...l, categoryId: v === 'none' ? '' : v } : l) }))}>
                  <SelectTrigger><SelectValue placeholder="Danh mục" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— danh mục —</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input className="col-span-3" type="number" placeholder="Kế hoạch" value={line.plannedAmount}
                onChange={(e) => setBudget((b) => ({ ...b, lines: b.lines.map((l, idx) => idx === i ? { ...l, plannedAmount: e.target.value } : l) }))} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setBudget((b) => ({ ...b, lines: [...b.lines, { name: '', categoryId: '', plannedAmount: '' }] }))}>+ Dòng</Button>
            <Button size="sm" variant="outline" disabled={saveBudget.isPending || !budget.name.trim()}
              onClick={() => saveBudget.mutate({
                name: budget.name.trim(),
                lines: budget.lines.filter((l) => l.name.trim() && Number(l.plannedAmount) > 0).map((l) => ({
                  name: l.name.trim(),
                  plannedAmount: Number(l.plannedAmount),
                  ...(l.categoryId ? { categoryId: l.categoryId } : {}),
                })),
              })}>
              {saveBudget.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu ngân sách'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
