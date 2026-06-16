'use client'
/**
 * @module ExtraFinanceTabs
 * @description Các tab tài chính nâng cao theo API team (Family Care API):
 * - BudgetTab: kế hoạch ngân sách + báo cáo planned-vs-actual.
 * - GoalsTab: mục tiêu tài chính.
 * - SupportTab: yêu cầu hỗ trợ chi tiêu (tạo / duyệt / hủy).
 * - AlertsTab: cảnh báo ngân sách (tính lại / xác nhận / giải quyết).
 * - ReportTab: báo cáo tổng quan tài chính.
 */
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Loader2, Plus, Target, HandCoins, AlertTriangle, RefreshCw, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/api'
import {
  useBudgetPlans, useBudgetPlanReport, useCreateBudgetPlan, useBudgetPlanAction,
  useAddBudgetLine, useUpdateBudgetLine, useDeleteBudgetLine,
  useFinancialGoals, useCreateFinancialGoal, useCancelFinancialGoal,
  useGoalProgress, useGoalAllocations, useAddGoalAllocation,
  useSupportRequests, useCreateSupportRequest, useReviewSupportRequest, useCancelSupportRequest,
  useBudgetAlerts, useRecomputeAlerts, useAlertAction,
  useFinanceReportOverview, useReportBudgetGoal, useReportNonEssential,
  useFinanceCategories, useLedgerEntries,
  useMonthlyFinance, useCreateMonthlyFinance, useUpdateMonthlyFinance,
  type BudgetPlan, type BudgetLine, type FinancialGoal, type FinanceCategory, type MonthlyFinanceInput,
} from '@/hooks/useTeamFinance'

const n = (v: unknown) => Number(v ?? 0)
const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Nháp', cls: 'bg-gray-100 text-gray-600' },
  ACTIVE: { label: 'Đang áp dụng', cls: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Đã đóng', cls: 'bg-slate-200 text-slate-700' },
  CANCELED: { label: 'Đã hủy', cls: 'bg-red-100 text-red-700' },
}

/* ============================== Ngân sách ============================== */
type DraftLine = { plannedAmount: string; categoryId: string }

export function BudgetTab({ familyId, isManager }: { familyId: string; isManager: boolean }) {
  const plans = useBudgetPlans(familyId)
  const createPlan = useCreateBudgetPlan(familyId)
  const action = useBudgetPlanAction(familyId)
  const categories = useFinanceCategories(familyId)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const report = useBudgetPlanReport(familyId, selectedId)

  const monthStart = new Date(); monthStart.setDate(1)
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const [form, setForm] = useState({
    planName: '', periodType: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    periodStart: monthStart.toISOString().slice(0, 10),
    periodEnd: monthEnd.toISOString().slice(0, 10),
    expectedSharedIncome: '', expectedSharedExpense: '',
  })
  const [lines, setLines] = useState<DraftLine[]>([{ plannedAmount: '', categoryId: '' }])
  const addLine = () => setLines((prev) => [...prev, { plannedAmount: '', categoryId: '' }])
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, k: keyof DraftLine, v: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))

  const submit = () => {
    createPlan.mutate(
      {
        planName: form.planName, periodType: form.periodType,
        periodStart: form.periodStart, periodEnd: form.periodEnd,
        expectedSharedIncome: form.expectedSharedIncome ? Number(form.expectedSharedIncome) : undefined,
        expectedSharedExpense: form.expectedSharedExpense ? Number(form.expectedSharedExpense) : undefined,
        lines: lines.filter((l) => l.plannedAmount).map((l) => ({
          plannedAmount: Number(l.plannedAmount),
          categoryId: l.categoryId || undefined,
        })),
      },
      {
        onSuccess: () => {
          toast.success('Đã tạo kế hoạch ngân sách (nháp)')
          setOpen(false)
          setForm({ ...form, planName: '', expectedSharedIncome: '', expectedSharedExpense: '' })
          setLines([{ plannedAmount: '', categoryId: '' }])
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Tạo kế hoạch thất bại')),
      },
    )
  }

  const doAction = (planId: string, act: 'activate' | 'close' | 'cancel', label: string) =>
    action.mutate({ planId, action: act }, {
      onSuccess: () => toast.success(label),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })

  const items = plans.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Kế hoạch ngân sách</h3>
        {isManager && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Tạo kế hoạch</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Chưa có kế hoạch ngân sách nào.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((p: BudgetPlan) => {
            const st = PLAN_STATUS[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
            return (
              <div key={p.id} className="rounded-lg border bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium">{p.planName} <span className={cn('text-xs px-2 py-0.5 rounded-full ml-1', st.cls)}>{st.label}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {p.periodType} · {new Date(p.periodStart).toLocaleDateString('vi-VN')} – {new Date(p.periodEnd).toLocaleDateString('vi-VN')} · dự chi {formatCurrency(n(p.expectedSharedExpense))}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}>
                      {selectedId === p.id ? 'Ẩn báo cáo' : 'Báo cáo'}
                    </Button>
                    {isManager && p.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => doAction(p.id, 'activate', 'Đã kích hoạt')}>Kích hoạt</Button>}
                    {isManager && p.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => doAction(p.id, 'close', 'Đã đóng kế hoạch')}>Đóng</Button>}
                    {isManager && (p.status === 'DRAFT' || p.status === 'ACTIVE') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => doAction(p.id, 'cancel', 'Đã hủy kế hoạch')}>Hủy</Button>}
                  </div>
                </div>

                {selectedId === p.id && (
                  <div className="mt-3 border-t pt-3">
                    {report.isLoading ? (
                      <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                    ) : report.data ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <Mini label="Dự chi" value={formatCurrency(n(report.data.totals.plannedExpense))} />
                          <Mini label="Thực chi" value={formatCurrency(n(report.data.totals.actualExpense))} cls="text-red-600" />
                          <Mini label="Chênh lệch chi" value={formatCurrency(n(report.data.totals.varianceExpense))} />
                          <Mini label="Số dư thực tế" value={formatCurrency(n(report.data.totals.actualBalance))} />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-muted-foreground border-b">
                              <th className="py-1.5 pr-2">Danh mục</th><th className="py-1.5 px-2 text-right">Kế hoạch</th>
                              <th className="py-1.5 px-2 text-right">Thực tế</th><th className="py-1.5 px-2 text-right">Chênh lệch</th><th className="py-1.5 pl-2"></th>
                            </tr></thead>
                            <tbody>
                              {report.data.lines.map((l) => (
                                <tr key={l.budgetLine.id} className="border-b last:border-0">
                                  <td className="py-1.5 pr-2">{l.budgetLine.category?.name ?? l.budgetLine.jar?.name ?? '—'}</td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(n(l.budgetLine.plannedAmount))}</td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(n(l.actualAmount))}</td>
                                  <td className={cn('py-1.5 px-2 text-right', n(l.varianceAmount) < 0 ? 'text-red-600' : 'text-green-600')}>{formatCurrency(n(l.varianceAmount))}</td>
                                  <td className="py-1.5 pl-2">{l.isOverBudget && <Badge variant="destructive" className="text-[10px]">Vượt</Badge>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {isManager && (p.status === 'DRAFT' || p.status === 'ACTIVE') && (
                          <BudgetLinesEditor familyId={familyId} planId={p.id} lines={report.data.budgetPlan.lines} categories={categories.data ?? []} />
                        )}
                      </div>
                    ) : <p className="text-sm text-muted-foreground py-2">Không tải được báo cáo.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo kế hoạch ngân sách</DialogTitle>
            <DialogDescription>Kế hoạch tạo ở trạng thái nháp, kích hoạt để bắt đầu theo dõi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tên kế hoạch *</Label><Input value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} placeholder="Ngân sách tháng 6" /></div>
            <div className="space-y-2">
              <Label>Chu kỳ</Label>
              <Select value={form.periodType} onValueChange={(v) => setForm({ ...form, periodType: v as typeof form.periodType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Hàng tháng</SelectItem>
                  <SelectItem value="QUARTERLY">Hàng quý</SelectItem>
                  <SelectItem value="YEARLY">Hàng năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Từ ngày</Label><Input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} /></div>
              <div className="space-y-2"><Label>Đến ngày</Label><Input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Dự kiến thu</Label><CurrencyInput value={form.expectedSharedIncome} onChange={(v) => setForm({ ...form, expectedSharedIncome: v })} placeholder="20.000.000" /></div>
              <div className="space-y-2"><Label>Dự kiến chi</Label><CurrencyInput value={form.expectedSharedExpense} onChange={(v) => setForm({ ...form, expectedSharedExpense: v })} placeholder="15.000.000" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dòng ngân sách <span className="text-red-500">*</span></Label>
                <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1 h-7 text-xs px-2">
                  <Plus className="w-3 h-3" />Thêm dòng
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Cần ít nhất 1 dòng để kích hoạt kế hoạch.</p>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <CurrencyInput value={line.plannedAmount} onChange={(v) => updateLine(i, 'plannedAmount', v)} placeholder="Số tiền" />
                    </div>
                    {(categories.data?.length ?? 0) > 0 && (
                      <Select value={line.categoryId || '__none__'} onValueChange={(v) => updateLine(i, 'categoryId', v === '__none__' ? '' : v)}>
                        <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Danh mục" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Không chọn —</SelectItem>
                          {categories.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-red-500 shrink-0" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setLines([{ plannedAmount: '', categoryId: '' }]) }}>Hủy</Button>
            <Button onClick={submit} disabled={createPlan.isPending || !form.planName || lines.every((l) => !l.plannedAmount)}>
              {createPlan.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Mini({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-semibold', cls)}>{value}</p>
    </div>
  )
}

/** Quản lý dòng ngân sách của một kế hoạch đã tồn tại: thêm / sửa / xóa. */
function BudgetLinesEditor({
  familyId, planId, lines, categories,
}: { familyId: string; planId: string; lines: BudgetLine[]; categories: FinanceCategory[] }) {
  const addLine = useAddBudgetLine(familyId)
  const updateLine = useUpdateBudgetLine(familyId)
  const deleteLine = useDeleteBudgetLine(familyId)
  const [newLine, setNewLine] = useState({ plannedAmount: '', categoryId: '' })
  const [editing, setEditing] = useState<Record<string, string>>({})

  const submitAdd = () => {
    if (!newLine.plannedAmount) return
    addLine.mutate(
      { planId, plannedAmount: Number(newLine.plannedAmount), categoryId: newLine.categoryId || undefined },
      {
        onSuccess: () => { toast.success('Đã thêm dòng ngân sách'); setNewLine({ plannedAmount: '', categoryId: '' }) },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Thêm dòng thất bại')),
      },
    )
  }
  const saveEdit = (lineId: string) => {
    const val = editing[lineId]
    if (val == null || !val) return
    updateLine.mutate({ lineId, plannedAmount: Number(val) }, {
      onSuccess: () => { toast.success('Đã cập nhật dòng'); setEditing((p) => { const c = { ...p }; delete c[lineId]; return c }) },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')),
    })
  }
  const removeLine = (lineId: string) =>
    deleteLine.mutate(lineId, {
      onSuccess: () => toast.success('Đã xóa dòng'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Xóa thất bại')),
    })

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <p className="text-sm font-medium text-gray-700">Quản lý dòng ngân sách</p>
      {lines.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <span className="text-sm flex-1 truncate">{l.category?.name ?? l.jar?.name ?? '—'}</span>
          <div className="w-32">
            <CurrencyInput
              value={editing[l.id] ?? String(n(l.plannedAmount))}
              onChange={(v) => setEditing((p) => ({ ...p, [l.id]: v }))}
            />
          </div>
          <Button size="sm" variant="outline" disabled={updateLine.isPending || editing[l.id] == null} onClick={() => saveEdit(l.id)}>Lưu</Button>
          <Button size="sm" variant="ghost" className="text-red-600" disabled={deleteLine.isPending} onClick={() => removeLine(l.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <div className="flex-1">
          <CurrencyInput value={newLine.plannedAmount} onChange={(v) => setNewLine({ ...newLine, plannedAmount: v })} placeholder="Số tiền dòng mới" />
        </div>
        {categories.length > 0 && (
          <Select value={newLine.categoryId || '__none__'} onValueChange={(v) => setNewLine({ ...newLine, categoryId: v === '__none__' ? '' : v })}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Danh mục" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Không chọn —</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={submitAdd} disabled={addLine.isPending || !newLine.plannedAmount} className="gap-1 shrink-0">
          <Plus className="w-3.5 h-3.5" />Thêm dòng
        </Button>
      </div>
    </div>
  )
}

/* ============================== Mục tiêu ============================== */
export function GoalsTab({ familyId, isManager }: { familyId: string; isManager: boolean }) {
  const goals = useFinancialGoals(familyId)
  const createGoal = useCreateFinancialGoal(familyId)
  const cancelGoal = useCancelFinancialGoal(familyId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ goalName: '', targetAmount: '', deadline: '', monthlyContributionTarget: '' })

  const submit = () => {
    createGoal.mutate(
      {
        goalName: form.goalName, targetAmount: Number(form.targetAmount.replace(/\D/g, '')),
        deadline: form.deadline || undefined,
        monthlyContributionTarget: form.monthlyContributionTarget ? Number(form.monthlyContributionTarget.replace(/\D/g, '')) : undefined,
      },
      {
        onSuccess: () => { toast.success('Đã tạo mục tiêu'); setOpen(false); setForm({ goalName: '', targetAmount: '', deadline: '', monthlyContributionTarget: '' }) },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Tạo mục tiêu thất bại')),
      },
    )
  }

  const items = goals.data?.items ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Mục tiêu tài chính</h3>
        {isManager && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Tạo mục tiêu</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Target className="w-10 h-10 mx-auto opacity-30 mb-2" />Chưa có mục tiêu nào.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((g) => (
            <GoalCard key={g.id} familyId={familyId} goal={g} isManager={isManager} onCancel={() => cancelGoal.mutate(g.id, { onSuccess: () => toast.success('Đã hủy mục tiêu'), onError: (e) => toast.error(getApiErrorMessage(e)) })} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tạo mục tiêu tài chính</DialogTitle><DialogDescription>Đặt số tiền mục tiêu và mức góp hàng tháng (tùy chọn).</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tên mục tiêu *</Label><Input value={form.goalName} onChange={(e) => setForm({ ...form, goalName: e.target.value })} placeholder="Mua xe, quỹ dự phòng..." /></div>
            <div className="space-y-2"><Label>Số tiền mục tiêu (VND) *</Label><CurrencyInput value={form.targetAmount} onChange={(v) => setForm({ ...form, targetAmount: v })} placeholder="50.000.000" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Góp/tháng</Label><CurrencyInput value={form.monthlyContributionTarget} onChange={(v) => setForm({ ...form, monthlyContributionTarget: v })} placeholder="2.000.000" /></div>
              <div className="space-y-2"><Label>Hạn (tùy chọn)</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={submit} disabled={createGoal.isPending || !form.goalName || !form.targetAmount}>
              {createGoal.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Thẻ mục tiêu: hiện tiến độ (useGoalProgress), lịch sử phân bổ và form phân bổ giao dịch. */
function GoalCard({
  familyId, goal, isManager, onCancel,
}: { familyId: string; goal: FinancialGoal; isManager: boolean; onCancel: () => void }) {
  const progress = useGoalProgress(familyId, goal.id)
  const allocations = useGoalAllocations(familyId, goal.id)
  const addAlloc = useAddGoalAllocation(familyId)
  const entries = useLedgerEntries(familyId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ledgerEntryId: '', amount: '' })

  const contributionEntries = (entries.data ?? []).filter((e) => e.entryType === 'CONTRIBUTION' || e.entryType === 'INCOME')
  const pct = progress.data ? Math.min(100, n(progress.data.progressPercent)) : 0

  const submit = () => {
    if (!form.ledgerEntryId || !form.amount) return
    addAlloc.mutate(
      { goalId: goal.id, ledgerEntryId: form.ledgerEntryId, amount: Number(form.amount.replace(/\D/g, '')) },
      {
        onSuccess: () => { toast.success('Đã phân bổ vào mục tiêu'); setOpen(false); setForm({ ledgerEntryId: '', amount: '' }) },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Phân bổ thất bại')),
      },
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">{goal.goalName}</p>
          <Badge variant={goal.status === 'ACHIEVED' ? 'default' : goal.status === 'CANCELED' ? 'destructive' : 'secondary'}>{goal.status}</Badge>
        </div>
        <p className="text-2xl font-bold text-blue-600">{formatCurrency(n(goal.targetAmount))}</p>

        {progress.data && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Đã góp {formatCurrency(n(progress.data.currentAmount))} ({pct.toFixed(0)}%)
              {progress.data.estimatedMonthsToComplete != null && ` · còn ~${progress.data.estimatedMonthsToComplete} tháng`}
              {!progress.data.isOnTrack && ' · chậm tiến độ'}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-0.5">
          {goal.monthlyContributionTarget && <p>Góp mỗi tháng: {formatCurrency(n(goal.monthlyContributionTarget))}</p>}
          {goal.deadline && <p>Hạn: {new Date(goal.deadline).toLocaleDateString('vi-VN')}</p>}
        </div>

        {(allocations.data?.length ?? 0) > 0 && (
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
            {allocations.data!.slice(0, 3).map((a) => (
              <div key={a.id} className="flex justify-between">
                <span className="truncate">{a.ledgerEntry?.description ?? 'Giao dịch'}</span>
                <span className="shrink-0">{formatCurrency(n(a.amount))}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {goal.status === 'ACTIVE' && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />Phân bổ</Button>
          )}
          {isManager && goal.status === 'ACTIVE' && (
            <Button size="sm" variant="ghost" className="text-red-600 px-0" onClick={onCancel}>Hủy mục tiêu</Button>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phân bổ giao dịch vào mục tiêu</DialogTitle>
            <DialogDescription>Chọn một giao dịch thu/đóng góp trong sổ chung để gán vào mục tiêu này.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Giao dịch</Label>
              <Select value={form.ledgerEntryId} onValueChange={(v) => setForm({ ...form, ledgerEntryId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn giao dịch" /></SelectTrigger>
                <SelectContent>
                  {contributionEntries.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.description} · {formatCurrency(n(e.amount))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Số tiền phân bổ (VND) *</Label><CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={submit} disabled={addAlloc.isPending || !form.ledgerEntryId || !form.amount}>
              {addAlloc.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Phân bổ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ========================= Hỗ trợ chi tiêu ========================= */
const SR_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
  CANCELED: { label: 'Đã hủy', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}
export function SupportTab({ familyId, isManager }: { familyId: string; isManager: boolean }) {
  const requests = useSupportRequests(familyId)
  const createReq = useCreateSupportRequest(familyId)
  const review = useReviewSupportRequest(familyId)
  const cancel = useCancelSupportRequest(familyId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', purpose: '' })

  const submit = () => {
    createReq.mutate({ amount: Number(form.amount.replace(/\D/g, '')), purpose: form.purpose }, {
      onSuccess: () => { toast.success('Đã gửi yêu cầu hỗ trợ'); setOpen(false); setForm({ amount: '', purpose: '' }) },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Gửi yêu cầu thất bại')),
    })
  }

  const items = requests.data?.items ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Yêu cầu hỗ trợ chi tiêu</h3>
        <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"><HandCoins className="w-4 h-4" />Gửi yêu cầu</Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Chưa có yêu cầu nào.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const st = SR_STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
            return (
              <div key={r.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{r.requesterMember?.user?.fullName ?? 'Thành viên'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                  </div>
                  <span className={cn('inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border', st.cls)}>{st.label}</span>
                </div>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(n(r.amount))}</p>
                <p className="text-sm text-gray-600">{r.purpose}</p>
                {r.decisionNote && <p className="text-xs text-muted-foreground bg-gray-50 rounded px-3 py-2">Ghi chú: {r.decisionNote}</p>}
                <div className="flex gap-2 pt-1">
                  {isManager && r.status === 'PENDING' && (
                    <>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" disabled={review.isPending}
                        onClick={() => review.mutate({ requestId: r.id, decision: 'APPROVE' }, { onSuccess: () => toast.success('Đã duyệt'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>
                        <CheckCircle className="w-3.5 h-3.5" />Duyệt
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-1" disabled={review.isPending}
                        onClick={() => review.mutate({ requestId: r.id, decision: 'REJECT' }, { onSuccess: () => toast.success('Đã từ chối'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>
                        <XCircle className="w-3.5 h-3.5" />Từ chối
                      </Button>
                    </>
                  )}
                  {r.status === 'PENDING' && (
                    <Button size="sm" variant="ghost" className="text-gray-500" disabled={cancel.isPending}
                      onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('Đã hủy yêu cầu'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>Hủy</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yêu cầu hỗ trợ chi tiêu</DialogTitle><DialogDescription>Gửi yêu cầu để Family Manager/Deputy xem xét.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Số tiền (VND) *</Label><CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="300.000" /></div>
            <div className="space-y-2"><Label>Mục đích *</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Mua sách, tiền xe bus..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={submit} disabled={createReq.isPending || !form.amount || !form.purpose}>
              {createReq.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Gửi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================== Cảnh báo ============================== */
const SEVERITY: Record<string, string> = { HIGH: 'text-red-600 bg-red-50 border-red-200', MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200', LOW: 'text-blue-600 bg-blue-50 border-blue-200' }
export function AlertsTab({ familyId, isManager }: { familyId: string; isManager: boolean }) {
  const alerts = useBudgetAlerts(familyId)
  const recompute = useRecomputeAlerts(familyId)
  const action = useAlertAction(familyId)
  const items = alerts.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Cảnh báo ngân sách</h3>
        {isManager && (
          <Button variant="outline" className="gap-2" disabled={recompute.isPending}
            onClick={() => recompute.mutate(undefined, { onSuccess: (d: { candidates: number }) => toast.success(`Đã tính lại (${d?.candidates ?? 0} cảnh báo)`), onError: (e) => toast.error(getApiErrorMessage(e)) })}>
            {recompute.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Tính lại
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><AlertTriangle className="w-10 h-10 mx-auto opacity-30 mb-2" />Không có cảnh báo nào.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className={cn('rounded-lg border p-3', SEVERITY[a.severity] ?? 'bg-gray-50 border-gray-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{a.message}</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {a.alertType} · {a.severity}
                      {a.category && ` · ${a.category.name}`}
                      {a.actualValue != null && ` · thực tế ${formatCurrency(n(a.actualValue))}`}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{a.status}</Badge>
              </div>
              {isManager && a.status !== 'RESOLVED' && (
                <div className="flex gap-2 mt-2">
                  {a.status === 'NEW' && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ alertId: a.id, action: 'acknowledge' }, { onSuccess: () => toast.success('Đã xác nhận'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>Đã xem</Button>}
                  <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ alertId: a.id, action: 'resolve' }, { onSuccess: () => toast.success('Đã giải quyết'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>Giải quyết</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================== Báo cáo ============================== */
const REPORT_SUB_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'budget-goal', label: 'Ngân sách & Mục tiêu' },
  { id: 'non-essential', label: 'Chi không thiết yếu' },
] as const

export function ReportTab({ familyId }: { familyId: string }) {
  const [sub, setSub] = useState<typeof REPORT_SUB_TABS[number]['id']>('overview')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {REPORT_SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', sub === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'overview' && <ReportOverviewSection familyId={familyId} />}
      {sub === 'budget-goal' && <ReportBudgetGoalSection familyId={familyId} />}
      {sub === 'non-essential' && <ReportNonEssentialSection familyId={familyId} />}
    </div>
  )
}

function ReportOverviewSection({ familyId }: { familyId: string }) {
  const report = useFinanceReportOverview(familyId)
  if (report.isLoading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
  if (!report.data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không tải được báo cáo.</CardContent></Card>
  const d = report.data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Ngân sách kỳ này</p>
          <div className="space-y-1 text-sm">
            <Row label="Dự chi" value={formatCurrency(n(d.budget.plannedExpense))} />
            <Row label="Thực chi" value={formatCurrency(n(d.budget.actualExpense))} cls="text-red-600" />
            <Row label="Số dòng vượt NS" value={String(d.budget.overBudgetLineCount)} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Mục tiêu</p>
          <div className="space-y-1 text-sm">
            <Row label="Tổng mục tiêu" value={String(d.goals.totalGoals)} />
            <Row label="Đang theo đuổi" value={String(d.goals.activeGoals)} />
            <Row label="Đã đạt" value={String(d.goals.achievedGoals)} />
            <Row label="Tiến độ TB" value={`${n(d.goals.averageProgressPercent).toFixed(0)}%`} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Cảnh báo</p>
          <div className="space-y-1 text-sm">
            <Row label="Mới" value={String(d.alerts.totalNew)} />
            <Row label="Nghiêm trọng" value={String(d.alerts.highCount)} cls="text-red-600" />
            <Row label="Đã giải quyết" value={String(d.alerts.totalResolved)} />
          </div>
        </CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        <p className="text-sm text-muted-foreground mb-2">Chi tiêu thiết yếu vs không thiết yếu</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Mini label="Tổng chi" value={formatCurrency(n(d.spending.totalExpense))} />
          <Mini label="Thiết yếu" value={formatCurrency(n(d.spending.essentialExpense))} />
          <Mini label="Không thiết yếu" value={formatCurrency(n(d.spending.nonEssentialExpense))} cls="text-amber-600" />
        </div>
        {d.spending.byCategory.length > 0 && (
          <div className="mt-3 space-y-1">
            {d.spending.byCategory.map((c) => (
              <div key={c.categoryId} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span>{c.name}</span><span className="font-medium">{formatCurrency(n(c.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={cn('font-medium', cls)}>{value}</span></div>
}

function ReportBudgetGoalSection({ familyId }: { familyId: string }) {
  const report = useReportBudgetGoal(familyId, { includeGoals: true, includeAlerts: true })
  if (report.isLoading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
  if (!report.data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không tải được báo cáo.</CardContent></Card>
  const d = report.data

  return (
    <div className="space-y-4">
      {d.budget && (
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">{d.budget.budgetPlan?.planName ?? 'Ngân sách'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Mini label="Dự chi" value={formatCurrency(n(d.budget.totals.plannedExpense))} />
            <Mini label="Thực chi" value={formatCurrency(n(d.budget.totals.actualExpense))} cls="text-red-600" />
            <Mini label="Chênh lệch" value={formatCurrency(n(d.budget.totals.varianceExpense))} />
            <Mini label="Dòng vượt NS" value={String(d.budget.totals.overBudgetLineCount)} />
          </div>
        </CardContent></Card>
      )}

      {d.goals && (
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Mục tiêu</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <Mini label="Tổng" value={String(d.goals.summary.totalGoals)} />
            <Mini label="Đang theo đuổi" value={String(d.goals.summary.activeGoals)} />
            <Mini label="Đã đạt" value={String(d.goals.summary.achievedGoals)} />
            <Mini label="Tiến độ TB" value={`${n(d.goals.summary.averageProgressPercent).toFixed(0)}%`} />
          </div>
          <div className="space-y-1">
            {d.goals.items.map((g) => (
              <div key={g.id} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span>{g.goalName}</span><span className="font-medium">{n(g.progressPercent).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {(d.alerts?.length ?? 0) > 0 && (
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Cảnh báo liên quan</p>
          <div className="space-y-1">
            {d.alerts!.map((a) => <div key={a.id} className="text-sm border-b last:border-0 py-1">{a.message}</div>)}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}

function ReportNonEssentialSection({ familyId }: { familyId: string }) {
  const report = useReportNonEssential(familyId, { includeBreakdown: true })
  if (report.isLoading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
  if (!report.data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không tải được báo cáo.</CardContent></Card>
  const d = report.data

  return (
    <div className="space-y-4">
      {d.summary && (
        <Card><CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Mini label="Tổng chi" value={formatCurrency(n(d.summary.totalExpense))} />
            <Mini label="Thiết yếu" value={formatCurrency(n(d.summary.essentialExpense))} />
            <Mini label="Không thiết yếu" value={formatCurrency(n(d.summary.nonEssentialExpense))} cls="text-amber-600" />
            <Mini label="Tỉ lệ" value={`${n(d.summary.nonEssentialRatio).toFixed(0)}%`} />
          </div>
        </CardContent></Card>
      )}

      {(d.byCategory?.length ?? 0) > 0 && (
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Theo danh mục</p>
          <div className="space-y-1">
            {d.byCategory!.map((c) => (
              <div key={c.categoryId} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span>{c.name}</span><span className="font-medium">{formatCurrency(n(c.amount))} ({n(c.ratio).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {(d.breakdown?.length ?? 0) > 0 && (
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Chi tiết giao dịch không thiết yếu</p>
          <div className="space-y-1">
            {d.breakdown!.map((b) => (
              <div key={b.entryId} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span>{b.description}{b.category && ` · ${b.category.name}`}</span><span className="font-medium">{formatCurrency(n(b.amount))}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}

/* ===================== Tài chính tháng cá nhân ===================== */
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function emptyMonthlyForm(month: number, year: number): MonthlyFinanceInput {
  return {
    periodMonth: month, periodYear: year,
    expectedIncome: null, actualIncome: null,
    expectedPersonalExpense: null, actualPersonalExpense: null,
    incomeVisibility: 'PRIVATE', expenseVisibility: 'PRIVATE', note: '',
  }
}

export function MonthlyFinanceTab({ familyId }: { familyId: string }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const mf = useMonthlyFinance(familyId, month, year)
  const create = useCreateMonthlyFinance(familyId)
  const update = useUpdateMonthlyFinance(familyId)
  const [form, setForm] = useState<MonthlyFinanceInput>(emptyMonthlyForm(month, year))

  useEffect(() => {
    if (mf.data) {
      setForm({
        periodMonth: month, periodYear: year,
        expectedIncome: mf.data.expectedIncome != null ? Number(mf.data.expectedIncome) : null,
        actualIncome: mf.data.actualIncome != null ? Number(mf.data.actualIncome) : null,
        expectedPersonalExpense: mf.data.expectedPersonalExpense != null ? Number(mf.data.expectedPersonalExpense) : null,
        actualPersonalExpense: mf.data.actualPersonalExpense != null ? Number(mf.data.actualPersonalExpense) : null,
        incomeVisibility: mf.data.incomeVisibility, expenseVisibility: mf.data.expenseVisibility,
        note: mf.data.note ?? '',
      })
    } else {
      setForm(emptyMonthlyForm(month, year))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mf.data, month, year])

  const exists = !!mf.data
  const pending = create.isPending || update.isPending
  const moneyStr = (v: number | null) => (v != null ? String(v) : '')
  const setMoney = (key: keyof MonthlyFinanceInput) => (v: string) =>
    setForm((p) => ({ ...p, [key]: v ? Number(v) : null }))

  const submit = () => {
    const data: MonthlyFinanceInput = { ...form, periodMonth: month, periodYear: year }
    const mutation = exists ? update : create
    mutation.mutate(data, {
      onSuccess: () => toast.success(exists ? 'Đã cập nhật tài chính tháng' : 'Đã khai báo tài chính tháng'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Lưu thất bại')),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-gray-800">Tài chính tháng cá nhân</h3>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} />
        </div>
      </div>

      {mf.isLoading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <Card><CardContent className="pt-6 space-y-4">
          {!exists && <p className="text-sm text-muted-foreground">Chưa khai báo cho tháng {month}/{year}. Điền thông tin bên dưới để tạo mới.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Thu nhập dự kiến</Label><CurrencyInput value={moneyStr(form.expectedIncome ?? null)} onChange={setMoney('expectedIncome')} /></div>
            <div className="space-y-2"><Label>Thu nhập thực tế</Label><CurrencyInput value={moneyStr(form.actualIncome ?? null)} onChange={setMoney('actualIncome')} /></div>
            <div className="space-y-2"><Label>Chi tiêu cá nhân dự kiến</Label><CurrencyInput value={moneyStr(form.expectedPersonalExpense ?? null)} onChange={setMoney('expectedPersonalExpense')} /></div>
            <div className="space-y-2"><Label>Chi tiêu cá nhân thực tế</Label><CurrencyInput value={moneyStr(form.actualPersonalExpense ?? null)} onChange={setMoney('actualPersonalExpense')} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hiển thị thu nhập</Label>
              <Select value={form.incomeVisibility} onValueChange={(v) => setForm({ ...form, incomeVisibility: v as 'PRIVATE' | 'FAMILY' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PRIVATE">Riêng tư</SelectItem><SelectItem value="FAMILY">Cả nhà xem được</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hiển thị chi tiêu</Label>
              <Select value={form.expenseVisibility} onValueChange={(v) => setForm({ ...form, expenseVisibility: v as 'PRIVATE' | 'FAMILY' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PRIVATE">Riêng tư</SelectItem><SelectItem value="FAMILY">Cả nhà xem được</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Ghi chú</Label><Input value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tùy chọn" /></div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{exists ? 'Cập nhật' : 'Khai báo'}
            </Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
