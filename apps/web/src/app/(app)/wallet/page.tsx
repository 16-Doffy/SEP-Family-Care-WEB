/**
 * Trang Tài chính gia đình — viết lại theo API team (Family Care API).
 *
 * Dữ liệu lấy từ `/families/{familyId}/finance/...`:
 * - Tổng quan: số dư, tổng thu/chi, số giao dịch của sổ chung.
 * - Mô hình & Lọ: thiết lập mô hình (5 hũ / 80-20 / tùy chỉnh) và xem các hũ %.
 * - Giao dịch: liệt kê & tạo giao dịch trong sổ chung.
 * - Danh mục: liệt kê & tạo danh mục thu/chi.
 *
 * Đây là sổ ghi nhận nội bộ, không phải ví điện tử hay thanh toán thật.
 */
'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Wallet, ArrowDownLeft, ArrowUpRight, Loader2, PiggyBank, Tags, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useActiveFamily } from '@/hooks/useFamily'
import {
  useFinanceOverview, useFinanceModels, useModelTemplates, useFinanceJars,
  useFinanceCategories, useLedgerEntries, useCreateFinanceModel, useActivateFinanceModel,
  useCreateFinanceCategory, useCreateLedgerEntry,
  type FinanceModel, type FinanceJar, type LedgerEntryType,
} from '@/hooks/useTeamFinance'
import { BudgetTab, GoalsTab, SupportTab, AlertsTab, ReportTab } from '@/components/finance/ExtraFinanceTabs'

type Tab = 'overview' | 'jars' | 'log' | 'categories' | 'budget' | 'goals' | 'support' | 'alerts' | 'report'

const ENTRY_TYPES: { value: LedgerEntryType; label: string; income: boolean }[] = [
  { value: 'INCOME', label: 'Thu nhập', income: true },
  { value: 'CONTRIBUTION', label: 'Đóng góp', income: true },
  { value: 'EXPENSE', label: 'Chi tiêu', income: false },
  { value: 'ALLOWANCE', label: 'Trợ cấp', income: false },
  { value: 'REWARD', label: 'Thưởng', income: false },
  { value: 'SUPPORT', label: 'Hỗ trợ', income: false },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh', income: false },
]
const isIncomeType = (t: LedgerEntryType) => ENTRY_TYPES.find((e) => e.value === t)?.income ?? false

export default function FinancePage() {
  const { user } = useAuth()
  const { familyId, family, isLoading: familyLoading } = useActiveFamily()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const myRole = family?.members?.find((m) => m.userId === user?.id)?.familyRole
  const isManager = myRole === 'FAMILY_MANAGER' || myRole === 'DEPUTY_MEMBER' || user?.role === 'SYSTEM_ADMIN'

  const overview = useFinanceOverview(familyId)
  const models = useFinanceModels(familyId)
  const jars = useFinanceJars(familyId)
  const categories = useFinanceCategories(familyId)
  const entries = useLedgerEntries(familyId)

  if (familyLoading) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar title="Tài chính gia đình" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (!familyId) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar title="Tài chính gia đình" />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Wallet className="w-10 h-10 opacity-30" />
          <p className="text-sm">Bạn chưa thuộc gia đình nào. Hãy tạo hoặc tham gia một gia đình trước.</p>
        </div>
      </div>
    )
  }

  const activeModel = models.data?.find((m) => m.status === 'ACTIVE') ?? null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'jars', label: 'Mô hình & Lọ' },
    { id: 'log', label: 'Giao dịch' },
    { id: 'categories', label: 'Danh mục' },
    { id: 'budget', label: 'Ngân sách' },
    { id: 'goals', label: 'Mục tiêu' },
    { id: 'support', label: 'Hỗ trợ chi tiêu' },
    { id: 'alerts', label: 'Cảnh báo' },
    { id: 'report', label: 'Báo cáo' },
  ]

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Tài chính gia đình" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg flex-wrap w-fit">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sổ tài chính chung của <span className="font-medium text-gray-700">{family?.name}</span>. Đây là sổ ghi nhận nội bộ, không phải ví điện tử thật.
          </p>
        </div>

        {activeTab === 'overview' && <OverviewTab overview={overview.data} activeModel={activeModel} categoryCount={categories.data?.length ?? 0} />}
        {activeTab === 'jars' && <JarsTab familyId={familyId} models={models.data ?? []} jars={jars.data ?? []} />}
        {activeTab === 'log' && <LedgerTab familyId={familyId} entries={entries.data ?? []} categories={categories.data ?? []} />}
        {activeTab === 'categories' && <CategoriesTab familyId={familyId} />}
        {activeTab === 'budget' && <BudgetTab familyId={familyId} isManager={isManager} />}
        {activeTab === 'goals' && <GoalsTab familyId={familyId} isManager={isManager} />}
        {activeTab === 'support' && <SupportTab familyId={familyId} isManager={isManager} />}
        {activeTab === 'alerts' && <AlertsTab familyId={familyId} isManager={isManager} />}
        {activeTab === 'report' && <ReportTab familyId={familyId} />}
      </div>
    </div>
  )
}

/* ----------------------------- Tổng quan ----------------------------- */
function OverviewTab({
  overview,
  activeModel,
  categoryCount,
}: {
  overview?: ReturnType<typeof useFinanceOverview>['data']
  activeModel: FinanceModel | null
  categoryCount: number
}) {
  const stat = (label: string, value: string, cls: string) => (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', cls)}>{value}</p>
      </CardContent>
    </Card>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stat('Số dư sổ chung', formatCurrency(Number(overview?.balance ?? 0)), 'text-gray-900')}
        {stat('Tổng thu', formatCurrency(Number(overview?.totalIncome ?? 0)), 'text-green-600')}
        {stat('Tổng chi', formatCurrency(Number(overview?.totalExpense ?? 0)), 'text-red-600')}
      </div>
      <Card>
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Kỳ</p>
            <p className="font-semibold">{overview ? `Tháng ${overview.period.month}/${overview.period.year}` : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Số giao dịch</p>
            <p className="font-semibold">{overview?.entryCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mô hình đang dùng</p>
            <p className="font-semibold">{activeModel?.name ?? 'Chưa thiết lập'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Số danh mục</p>
            <p className="font-semibold">{categoryCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* --------------------------- Mô hình & Lọ --------------------------- */
function JarsTab({ familyId, models, jars }: { familyId: string; models: FinanceModel[]; jars: FinanceJar[] }) {
  const templates = useModelTemplates(familyId)
  const createModel = useCreateFinanceModel(familyId)
  const activateModel = useActivateFinanceModel(familyId)
  const [setupOpen, setSetupOpen] = useState(false)
  const [tplType, setTplType] = useState<'FIVE_JARS' | 'EIGHTY_TWENTY' | 'CUSTOM'>('FIVE_JARS')
  const [name, setName] = useState('')

  const submit = () => {
    createModel.mutate(
      { modelType: tplType, name: name || templates.data?.find((t) => t.modelType === tplType)?.name || 'Mô hình mới' },
      {
        onSuccess: () => {
          toast.success('Đã tạo mô hình. Nhấn "Kích hoạt" để áp dụng.')
          setSetupOpen(false)
          setName('')
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Tạo mô hình thất bại')),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Mô hình phân bổ & các hũ</h3>
        <Button onClick={() => setSetupOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Tạo mô hình</Button>
      </div>

      {/* Danh sách mô hình */}
      {models.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <PiggyBank className="w-10 h-10 mx-auto opacity-30 mb-2" />
          Chưa có mô hình nào. Tạo "5 chiếc lọ" hoặc "80/20" để bắt đầu phân bổ.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
              <div>
                <p className="font-medium">{m.name} <span className="text-xs text-muted-foreground">({m.modelType})</span></p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                  {m.status === 'ACTIVE' ? 'Đang dùng' : m.status}
                </span>
              </div>
              {m.status !== 'ACTIVE' && (
                <Button size="sm" variant="outline" disabled={activateModel.isPending}
                  onClick={() => activateModel.mutate(m.id, {
                    onSuccess: () => toast.success('Đã kích hoạt mô hình'),
                    onError: (e) => toast.error(getApiErrorMessage(e, 'Kích hoạt thất bại')),
                  })}
                >Kích hoạt</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Các hũ */}
      {jars.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jars.map((j) => (
            <Card key={j.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{j.name}</p>
                  <span className="text-lg font-bold text-blue-600">{Number(j.allocationPercentage)}%</span>
                </div>
                {j.description && <p className="text-xs text-muted-foreground mt-1">{j.description}</p>}
                {j.financeModel && <p className="text-[11px] text-muted-foreground mt-2">{j.financeModel.name}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal thiết lập mô hình */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" />Tạo mô hình tài chính</DialogTitle>
            <DialogDescription>Chọn mẫu phân bổ. Mô hình chuẩn sẽ tự tạo các hũ theo tỉ lệ %.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loại mô hình</Label>
              <Select value={tplType} onValueChange={(v) => setTplType(v as typeof tplType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(templates.data ?? []).map((t) => (
                    <SelectItem key={t.modelType} value={t.modelType}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {templates.data?.find((t) => t.modelType === tplType)?.description}
              </p>
            </div>
            {/* Xem trước các hũ của mẫu */}
            {(templates.data?.find((t) => t.modelType === tplType)?.jars.length ?? 0) > 0 && (
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                {templates.data!.find((t) => t.modelType === tplType)!.jars.map((j) => (
                  <div key={j.jarCode} className="flex justify-between text-sm">
                    <span>{j.name}</span><span className="font-medium">{j.allocationPercentage}%</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tên mô hình (tùy chọn)</Label>
              <Input placeholder="VD: Mô hình 5 hũ của nhà mình" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>Hủy</Button>
            <Button onClick={submit} disabled={createModel.isPending}>
              {createModel.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Tạo mô hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ----------------------------- Giao dịch ----------------------------- */
function LedgerTab({
  familyId,
  entries,
  categories,
}: {
  familyId: string
  entries: NonNullable<ReturnType<typeof useLedgerEntries>['data']>
  categories: NonNullable<ReturnType<typeof useFinanceCategories>['data']>
}) {
  const createEntry = useCreateLedgerEntry(familyId)
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ entryType: 'EXPENSE' as LedgerEntryType, amount: '', description: '', entryDate: today, categoryId: '' })

  const submit = () => {
    createEntry.mutate(
      {
        entryType: form.entryType,
        amount: Number(form.amount.replace(/\D/g, '')),
        description: form.description,
        entryDate: form.entryDate,
        categoryId: form.categoryId || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Đã ghi nhận giao dịch')
          setOpen(false)
          setForm({ entryType: 'EXPENSE', amount: '', description: '', entryDate: today, categoryId: '' })
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Ghi nhận thất bại')),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Giao dịch sổ chung</h3>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Ghi nhận thu / chi</Button>
      </div>

      {entries.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Chưa có giao dịch nào.</CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-1">
          {entries.map((e) => {
            const income = isIncomeType(e.entryType)
            return (
              <div key={e.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', income ? 'bg-green-100' : 'bg-red-100')}>
                  {income ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.entryDate)}
                    {e.category && ` · ${e.category.name}`}
                    {e.createdByMember?.user && ` · ${e.createdByMember.user.fullName}`}
                  </p>
                </div>
                <p className={cn('font-semibold', income ? 'text-green-600' : 'text-red-600')}>
                  {income ? '+' : '-'}{formatCurrency(Number(e.amount))}
                </p>
              </div>
            )
          })}
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi nhận giao dịch</DialogTitle>
            <DialogDescription>Thêm một giao dịch vào sổ tài chính chung của gia đình.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loại giao dịch</Label>
              <Select value={form.entryType} onValueChange={(v) => setForm({ ...form, entryType: v as LedgerEntryType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND) *</Label>
              <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="250.000" />
            </div>
            <div className="space-y-2">
              <Label>Mô tả *</Label>
              <Input placeholder="Đi chợ, tiền điện..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ngày</Label>
              <Input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Danh mục (tùy chọn)</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={submit} disabled={createEntry.isPending || !form.amount || !form.description}>
              {createEntry.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Ghi nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ----------------------------- Danh mục ----------------------------- */
function CategoriesTab({ familyId }: { familyId: string }) {
  const categories = useFinanceCategories(familyId)
  const createCategory = useCreateFinanceCategory(familyId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', categoryType: 'EXPENSE' as 'INCOME' | 'EXPENSE', essentialType: 'ESSENTIAL' as 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL' })

  const submit = () => {
    createCategory.mutate(form, {
      onSuccess: () => {
        toast.success('Đã tạo danh mục')
        setOpen(false)
        setForm({ name: '', categoryType: 'EXPENSE', essentialType: 'ESSENTIAL' })
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Tạo danh mục thất bại')),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Danh mục thu / chi</h3>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Tạo danh mục</Button>
      </div>

      {(categories.data?.length ?? 0) === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Tags className="w-10 h-10 mx-auto opacity-30 mb-2" />Chưa có danh mục nào.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.data!.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.categoryType === 'INCOME' ? 'Thu' : 'Chi'}{c.essentialType ? ` · ${c.essentialType}` : ''}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', c.categoryType === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                {c.categoryType === 'INCOME' ? 'Thu' : 'Chi'}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo danh mục</DialogTitle>
            <DialogDescription>Danh mục giúp phân loại các giao dịch trong sổ chung.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên danh mục *</Label>
              <Input placeholder="Ăn uống, Học phí..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select value={form.categoryType} onValueChange={(v) => setForm({ ...form, categoryType: v as 'INCOME' | 'EXPENSE' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Chi tiêu</SelectItem>
                  <SelectItem value="INCOME">Thu nhập</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mức thiết yếu</Label>
              <Select value={form.essentialType} onValueChange={(v) => setForm({ ...form, essentialType: v as 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESSENTIAL">Thiết yếu</SelectItem>
                  <SelectItem value="NON_ESSENTIAL">Không thiết yếu</SelectItem>
                  <SelectItem value="NEUTRAL">Trung tính</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={submit} disabled={createCategory.isPending || !form.name}>
              {createCategory.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
