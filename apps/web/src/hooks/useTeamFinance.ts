/**
 * @module hooks/useTeamFinance
 * @description React Query hooks cho module Tài chính gia đình theo API team.
 *
 * Mọi endpoint nằm dưới `/families/{familyId}/finance/...` và trả về số tiền
 * dưới dạng chuỗi (Decimal). UI tự `Number(...)` khi hiển thị.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Số tiền có thể là chuỗi (Decimal) hoặc số. */
type Money = string | number

export interface FinanceJar {
  id: string
  financeModelId: string
  name: string
  jarCode: string
  allocationPercentage: Money
  description: string | null
  isActive: boolean
  financeModel?: { id: string; name: string; modelType: string; status: string }
}

export interface FinanceModel {
  id: string
  familyId: string
  modelType: 'FIVE_JARS' | 'EIGHTY_TWENTY' | 'CUSTOM'
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | string
  jars?: FinanceJar[]
}

export interface ModelTemplate {
  modelType: 'FIVE_JARS' | 'EIGHTY_TWENTY' | 'CUSTOM'
  name: string
  description: string
  jars: { name: string; jarCode: string; allocationPercentage: number; description: string }[]
}

export interface FinanceCategory {
  id: string
  familyId: string
  name: string
  categoryType: 'INCOME' | 'EXPENSE'
  essentialType: 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL' | null
  status: string
}

export type LedgerEntryType =
  | 'INCOME' | 'EXPENSE' | 'CONTRIBUTION' | 'ALLOWANCE' | 'REWARD' | 'SUPPORT' | 'ADJUSTMENT'

export interface LedgerEntry {
  id: string
  ledgerId: string
  categoryId: string | null
  createdByMemberId: string | null
  entryType: LedgerEntryType
  amount: Money
  description: string
  note: string | null
  entryDate: string
  status: string
  category?: FinanceCategory | null
  createdByMember?: { id: string; displayName: string | null; user?: { id: string; fullName: string; avatarUrl?: string | null } } | null
}

export interface FinanceOverview {
  period: { month: number; year: number }
  ledger: { id: string; ledgerName: string; status: string } | null
  totalIncome: Money
  totalExpense: Money
  balance: Money
  entryCount: number
  monthlyFinance: unknown | null
}

const fkey = (familyId: string, ...rest: unknown[]) => ['finance', familyId, ...rest]

/** Tổng quan sổ tài chính chung của gia đình. */
export function useFinanceOverview(familyId: string | null) {
  return useQuery<FinanceOverview>({
    queryKey: fkey(familyId ?? '', 'overview'),
    queryFn: () => api.get(`/families/${familyId}/finance/overview`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Danh sách mô hình tài chính (thành viên thường chỉ thấy mô hình ACTIVE). */
export function useFinanceModels(familyId: string | null) {
  return useQuery<FinanceModel[]>({
    queryKey: fkey(familyId ?? '', 'models'),
    queryFn: () => api.get(`/families/${familyId}/finance/models`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Mẫu mô hình có sẵn (FIVE_JARS / EIGHTY_TWENTY / CUSTOM). */
export function useModelTemplates(familyId: string | null) {
  return useQuery<ModelTemplate[]>({
    queryKey: fkey(familyId ?? '', 'model-templates'),
    queryFn: () => api.get(`/families/${familyId}/finance/model-templates`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Danh sách hũ tài chính. */
export function useFinanceJars(familyId: string | null) {
  return useQuery<FinanceJar[]>({
    queryKey: fkey(familyId ?? '', 'jars'),
    queryFn: () => api.get(`/families/${familyId}/finance/jars`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Danh sách danh mục thu/chi. */
export function useFinanceCategories(familyId: string | null) {
  return useQuery<FinanceCategory[]>({
    queryKey: fkey(familyId ?? '', 'categories'),
    queryFn: () => api.get(`/families/${familyId}/finance/categories`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Giao dịch trong sổ chung, lọc theo tháng/năm (tùy chọn). */
export function useLedgerEntries(familyId: string | null, month?: number, year?: number) {
  return useQuery<LedgerEntry[]>({
    queryKey: fkey(familyId ?? '', 'ledger', month, year),
    queryFn: () =>
      api
        .get(`/families/${familyId}/finance/ledger/entries`, {
          params: month && year ? { month, year } : {},
        })
        .then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Tổng quan tài chính tháng (tùy chọn truyền month/year để xem tháng khác). */
export function useFinanceOverviewMonth(familyId: string | null, month?: number, year?: number) {
  return useQuery<FinanceOverview>({
    queryKey: fkey(familyId ?? '', 'overview', month, year),
    queryFn: () => api.get(`/families/${familyId}/finance/overview`, { params: month && year ? { month, year } : {} }).then((r) => r.data),
    enabled: !!familyId,
  })
}

/** Invalidate toàn bộ cache finance của một gia đình. */
function useInvalidateFinance(familyId: string | null) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['finance', familyId ?? ''] })
}

/** Tạo mô hình tài chính (mô hình chuẩn sẽ tự sinh các hũ mặc định). */
export function useCreateFinanceModel(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: { modelType: ModelTemplate['modelType']; name: string }) =>
      api.post(`/families/${familyId}/finance/models`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/** Kích hoạt một mô hình (vô hiệu hóa mô hình đang hoạt động khác). */
export function useActivateFinanceModel(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (modelId: string) =>
      api.patch(`/families/${familyId}/finance/models/${modelId}/activate`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/** Tạo danh mục thu/chi. */
export function useCreateFinanceCategory(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: {
      name: string
      categoryType: 'INCOME' | 'EXPENSE'
      essentialType?: 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL'
    }) => api.post(`/families/${familyId}/finance/categories`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/** Tạo giao dịch trong sổ chung. */
export function useCreateLedgerEntry(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: {
      entryType: LedgerEntryType
      amount: number
      description: string
      entryDate: string
      categoryId?: string
      note?: string
      sourceType?: string
      sourceId?: string
    }) => api.post(`/families/${familyId}/finance/ledger/entries`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* =====================================================================
 * Ngân sách (budget plans), mục tiêu, hỗ trợ chi tiêu, cảnh báo, báo cáo
 * ===================================================================== */

/** Kết quả phân trang chuẩn của API team. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BudgetLine {
  id: string
  budgetPlanId: string
  categoryId: string | null
  jarId: string | null
  plannedAmount: Money
  thresholdAmount: Money | null
  thresholdPercent: Money | null
  essentialType: string | null
  note: string | null
  category?: FinanceCategory | null
  jar?: FinanceJar | null
}

export interface BudgetPlan {
  id: string
  familyId: string
  planName: string
  periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  periodStart: string
  periodEnd: string
  expectedSharedIncome: Money | null
  expectedSharedExpense: Money | null
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELED' | string
  _count?: { lines: number }
}

export interface BudgetReport {
  budgetPlan: BudgetPlan & { lines: BudgetLine[] }
  totals: {
    plannedIncome: Money; plannedExpense: Money; actualIncome: Money; actualExpense: Money
    plannedBalance: Money; actualBalance: Money; varianceExpense: Money; varianceIncome: Money
  }
  lines: {
    budgetLine: BudgetLine
    actualAmount: Money
    varianceAmount: Money
    thresholdLimit: Money | null
    isOverBudget: boolean
  }[]
  warnings: unknown[]
}

export interface FinancialGoal {
  id: string
  familyId: string
  goalName: string
  targetAmount: Money
  deadline: string | null
  monthlyContributionTarget: Money | null
  relatedJarId: string | null
  status: 'ACTIVE' | 'ACHIEVED' | 'CANCELED' | string
  relatedJar?: { id: string; name: string } | null
}

export interface SupportRequest {
  id: string
  amount: Money
  purpose: string
  categoryId: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | string
  decisionNote: string | null
  createdAt: string
  requesterMember?: { id: string; displayName: string | null; user?: { fullName: string } } | null
  reviewedByMember?: { id: string; displayName: string | null; user?: { fullName: string } } | null
  category?: FinanceCategory | null
}

export interface BudgetAlert {
  id: string
  alertType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string
  thresholdValue: Money | null
  actualValue: Money | null
  message: string
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | string
  createdAt: string
  budgetPlan?: { id: string; planName: string } | null
  category?: { id: string; name: string } | null
}

/* ----------------------------- Budget plans ----------------------------- */

export function useBudgetPlans(
  familyId: string | null,
  params?: { page?: number; limit?: number; status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELED'; periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' },
) {
  return useQuery<Paginated<BudgetPlan>>({
    queryKey: fkey(familyId ?? '', 'budget-plans', params),
    queryFn: () => api.get(`/families/${familyId}/finance/budget-plans`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useBudgetPlanReport(familyId: string | null, planId: string | null) {
  return useQuery<BudgetReport>({
    queryKey: fkey(familyId ?? '', 'budget-plan-report', planId),
    queryFn: () => api.get(`/families/${familyId}/finance/budget-plans/${planId}/report`).then((r) => r.data),
    enabled: !!familyId && !!planId,
  })
}

export interface CreateBudgetPlanInput {
  planName: string
  periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  periodStart: string
  periodEnd: string
  expectedSharedIncome?: number
  expectedSharedExpense?: number
  lines?: { categoryId?: string; jarId?: string; plannedAmount: number; thresholdPercent?: number; essentialType?: string; note?: string }[]
}

export function useCreateBudgetPlan(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: CreateBudgetPlanInput) =>
      api.post(`/families/${familyId}/finance/budget-plans`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/** Thao tác vòng đời kế hoạch ngân sách: activate / close / cancel. */
export function useBudgetPlanAction(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ planId, action }: { planId: string; action: 'activate' | 'close' | 'cancel' }) =>
      api.patch(`/families/${familyId}/finance/budget-plans/${planId}/${action}`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Financial goals ----------------------------- */

export function useFinancialGoals(
  familyId: string | null,
  params?: { page?: number; limit?: number; status?: 'ACTIVE' | 'ACHIEVED' | 'CANCELED'; relatedJarId?: string; includeProgress?: boolean },
) {
  return useQuery<Paginated<FinancialGoal>>({
    queryKey: fkey(familyId ?? '', 'financial-goals', params),
    queryFn: () => api.get(`/families/${familyId}/finance/financial-goals`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useCreateFinancialGoal(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: { goalName: string; targetAmount: number; deadline?: string; monthlyContributionTarget?: number; relatedJarId?: string }) =>
      api.post(`/families/${familyId}/finance/financial-goals`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useCancelFinancialGoal(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (goalId: string) =>
      api.patch(`/families/${familyId}/finance/financial-goals/${goalId}/cancel`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Support requests ----------------------------- */

export function useSupportRequests(
  familyId: string | null,
  params?: { page?: number; limit?: number; status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'; requesterMemberId?: string; categoryId?: string; fromDate?: string; toDate?: string; mine?: boolean },
) {
  return useQuery<Paginated<SupportRequest>>({
    queryKey: fkey(familyId ?? '', 'support-requests', params),
    queryFn: () => api.get(`/families/${familyId}/finance/support-requests`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useCreateSupportRequest(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: { amount: number; purpose: string; categoryId?: string }) =>
      api.post(`/families/${familyId}/finance/support-requests`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useReviewSupportRequest(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ requestId, decision, decisionNote, occurredAt }: { requestId: string; decision: 'APPROVE' | 'REJECT'; decisionNote?: string; occurredAt?: string }) =>
      api.patch(`/families/${familyId}/finance/support-requests/${requestId}/review`, { decision, decisionNote, occurredAt }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useCancelSupportRequest(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (requestId: string) =>
      api.patch(`/families/${familyId}/finance/support-requests/${requestId}/cancel`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Alerts ----------------------------- */

export function useBudgetAlerts(
  familyId: string | null,
  params?: { page?: number; limit?: number; status?: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED'; alertType?: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH'; budgetPlanId?: string; goalId?: string; jarId?: string; categoryId?: string; fromDate?: string; toDate?: string },
) {
  return useQuery<Paginated<BudgetAlert>>({
    queryKey: fkey(familyId ?? '', 'alerts', params),
    queryFn: () => api.get(`/families/${familyId}/finance/alerts`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useRecomputeAlerts(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (params?: { scope?: 'ALL' | 'BUDGET' | 'GOAL' | 'NON_ESSENTIAL'; budgetPlanId?: string; goalId?: string; periodStart?: string; periodEnd?: string }) =>
      api.post(`/families/${familyId}/finance/alerts/recompute`, { scope: 'ALL', ...params }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAlertAction(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ alertId, action, note }: { alertId: string; action: 'acknowledge' | 'resolve'; note?: string }) =>
      api.patch(`/families/${familyId}/finance/alerts/${alertId}/${action}`, note ? { note } : undefined).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Reports ----------------------------- */

export interface FinanceReportOverview {
  period: { periodStart: string; periodEnd: string }
  budget: {
    activeBudgetPlan: { id: string; planName: string } | null
    plannedIncome: Money; plannedExpense: Money; actualIncome: Money; actualExpense: Money
    plannedBalance: Money; actualBalance: Money; incomeVariance: Money; expenseVariance: Money
    overBudgetLineCount: number
  }
  goals: {
    totalGoals: number; activeGoals: number; achievedGoals: number; atRiskGoals: number
    totalTargetAmount: Money; totalCurrentAmount: Money; averageProgressPercent: Money
  }
  spending: {
    totalExpense: Money; essentialExpense: Money; nonEssentialExpense: Money; nonEssentialRatio: Money
    byCategory: { categoryId: string; name: string; amount: Money }[]
    byJar: { jarId: string; name: string; amount: Money }[]
  }
  alerts: { totalNew: number; totalAcknowledged: number; totalResolved: number; highCount: number; mediumCount: number; lowCount: number }
}

export function useFinanceReportOverview(
  familyId: string | null,
  params?: { periodStart?: string; periodEnd?: string; budgetPlanId?: string; includeAlerts?: boolean; includeGoals?: boolean; includeBreakdown?: boolean },
) {
  return useQuery<FinanceReportOverview>({
    queryKey: fkey(familyId ?? '', 'report-overview', params),
    queryFn: () => api.get(`/families/${familyId}/finance/reports/overview`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

/* ----------------------------- Report: budget-goal ----------------------------- */

export interface BudgetGoalReport {
  period?: { periodStart: string; periodEnd: string }
  budget?: {
    budgetPlan: BudgetPlan | null
    lines: { budgetLine: BudgetLine; actualAmount: Money; varianceAmount: Money; isOverBudget: boolean }[]
    totals: { plannedExpense: Money; actualExpense: Money; varianceExpense: Money; overBudgetLineCount: number }
  } | null
  goals?: {
    items: (FinancialGoal & { currentAmount?: Money; progressPercent?: Money })[]
    summary: { totalGoals: number; activeGoals: number; achievedGoals: number; atRiskGoals: number; averageProgressPercent: Money }
  } | null
  alerts?: BudgetAlert[] | null
}

export function useReportBudgetGoal(
  familyId: string | null,
  params?: { periodStart?: string; periodEnd?: string; budgetPlanId?: string; includeAlerts?: boolean; includeGoals?: boolean; includeBreakdown?: boolean },
) {
  return useQuery<BudgetGoalReport>({
    queryKey: fkey(familyId ?? '', 'report-budget-goal', params),
    queryFn: () => api.get(`/families/${familyId}/finance/reports/budget-goal`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

/* ----------------------------- Report: non-essential spending ----------------------------- */

export interface NonEssentialSpendingReport {
  period?: { periodStart: string; periodEnd: string }
  summary?: { totalExpense: Money; nonEssentialExpense: Money; nonEssentialRatio: Money; essentialExpense: Money }
  byCategory?: { categoryId: string; name: string; amount: Money; ratio: Money }[]
  breakdown?: { entryId: string; amount: Money; description: string; entryDate: string; category?: { name: string } | null }[]
  alerts?: BudgetAlert[] | null
}

export function useReportNonEssential(
  familyId: string | null,
  params?: { periodStart?: string; periodEnd?: string; budgetPlanId?: string; includeAlerts?: boolean; includeBreakdown?: boolean },
) {
  return useQuery<NonEssentialSpendingReport>({
    queryKey: fkey(familyId ?? '', 'report-non-essential', params),
    queryFn: () => api.get(`/families/${familyId}/finance/reports/non-essential-spending`, { params }).then((r) => r.data),
    enabled: !!familyId,
  })
}

/* ----------------------------- Jars: tạo & sửa ----------------------------- */

export function useCreateFinanceJar(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: { financeModelId: string; name: string; jarCode: string; allocationPercentage: number; description?: string; isActive?: boolean }) =>
      api.post(`/families/${familyId}/finance/jars`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateFinanceJar(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ jarId, ...data }: { jarId: string; name?: string; jarCode?: string; allocationPercentage?: number; description?: string | null; isActive?: boolean }) =>
      api.patch(`/families/${familyId}/finance/jars/${jarId}`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Budget plan: chi tiết & sửa ----------------------------- */

export function useBudgetPlan(familyId: string | null, planId: string | null) {
  return useQuery<BudgetPlan & { lines: BudgetLine[] }>({
    queryKey: fkey(familyId ?? '', 'budget-plan', planId),
    queryFn: () => api.get(`/families/${familyId}/finance/budget-plans/${planId}`).then((r) => r.data),
    enabled: !!familyId && !!planId,
  })
}

export function useUpdateBudgetPlan(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ planId, ...data }: { planId: string; planName?: string; periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; periodStart?: string; periodEnd?: string; expectedSharedIncome?: number | null; expectedSharedExpense?: number | null }) =>
      api.patch(`/families/${familyId}/finance/budget-plans/${planId}`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Budget lines: thêm / sửa / xóa ----------------------------- */

export function useAddBudgetLine(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ planId, ...data }: { planId: string; plannedAmount: number; categoryId?: string; jarId?: string; thresholdAmount?: number; thresholdPercent?: number; essentialType?: 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL'; note?: string }) =>
      api.post(`/families/${familyId}/finance/budget-plans/${planId}/lines`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateBudgetLine(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ lineId, ...data }: { lineId: string; plannedAmount?: number; categoryId?: string | null; jarId?: string | null; thresholdAmount?: number | null; thresholdPercent?: number | null; essentialType?: 'ESSENTIAL' | 'NON_ESSENTIAL' | 'NEUTRAL'; note?: string | null }) =>
      api.patch(`/families/${familyId}/finance/budget-lines/${lineId}`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteBudgetLine(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (lineId: string) =>
      api.delete(`/families/${familyId}/finance/budget-lines/${lineId}`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Financial goal: chi tiết & sửa ----------------------------- */

export interface GoalProgress {
  goalId: string
  goalName: string
  targetAmount: Money
  currentAmount: Money
  progressPercent: Money
  remainingAmount: Money
  deadline: string | null
  monthlyContributionTarget: Money | null
  estimatedMonthsToComplete: number | null
  isOnTrack: boolean
}

export interface GoalAllocation {
  id: string
  goalId: string
  ledgerEntryId: string
  amount: Money
  createdAt: string
  ledgerEntry?: LedgerEntry | null
}

export function useFinancialGoal(familyId: string | null, goalId: string | null) {
  return useQuery<FinancialGoal>({
    queryKey: fkey(familyId ?? '', 'financial-goal', goalId),
    queryFn: () => api.get(`/families/${familyId}/finance/financial-goals/${goalId}`).then((r) => r.data),
    enabled: !!familyId && !!goalId,
  })
}

export function useUpdateFinancialGoal(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ goalId, ...data }: { goalId: string; goalName?: string; targetAmount?: number; deadline?: string | null; monthlyContributionTarget?: number | null; relatedJarId?: string | null }) =>
      api.patch(`/families/${familyId}/finance/financial-goals/${goalId}`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useGoalProgress(familyId: string | null, goalId: string | null) {
  return useQuery<GoalProgress>({
    queryKey: fkey(familyId ?? '', 'goal-progress', goalId),
    queryFn: () => api.get(`/families/${familyId}/finance/financial-goals/${goalId}/progress`).then((r) => r.data),
    enabled: !!familyId && !!goalId,
  })
}

export function useGoalAllocations(familyId: string | null, goalId: string | null) {
  return useQuery<GoalAllocation[]>({
    queryKey: fkey(familyId ?? '', 'goal-allocations', goalId),
    queryFn: () => api.get(`/families/${familyId}/finance/financial-goals/${goalId}/allocations`).then((r) => r.data),
    enabled: !!familyId && !!goalId,
  })
}

export function useAddGoalAllocation(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ goalId, ledgerEntryId, amount }: { goalId: string; ledgerEntryId: string; amount: number }) =>
      api.post(`/families/${familyId}/finance/financial-goals/${goalId}/allocations`, { ledgerEntryId, amount }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateGoalAllocation(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ allocationId, amount }: { allocationId: string; amount: number }) =>
      api.patch(`/families/${familyId}/finance/goal-allocations/${allocationId}`, { amount }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteGoalAllocation(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (allocationId: string) =>
      api.delete(`/families/${familyId}/finance/goal-allocations/${allocationId}`).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Monthly finances (tài chính tháng cá nhân) ----------------------------- */

export interface MonthlyFinance {
  id: string
  familyMemberId: string
  periodMonth: number
  periodYear: number
  expectedIncome: Money | null
  actualIncome: Money | null
  expectedPersonalExpense: Money | null
  actualPersonalExpense: Money | null
  incomeVisibility: 'PRIVATE' | 'FAMILY'
  expenseVisibility: 'PRIVATE' | 'FAMILY'
  note: string | null
}

export interface MonthlyFinanceInput {
  periodMonth: number
  periodYear: number
  expectedIncome?: number | null
  actualIncome?: number | null
  expectedPersonalExpense?: number | null
  actualPersonalExpense?: number | null
  incomeVisibility?: 'PRIVATE' | 'FAMILY'
  expenseVisibility?: 'PRIVATE' | 'FAMILY'
  note?: string | null
}

/** Lấy tài chính tháng cá nhân (yêu cầu month + year). */
export function useMonthlyFinance(familyId: string | null, month: number | null, year: number | null) {
  return useQuery<MonthlyFinance>({
    queryKey: fkey(familyId ?? '', 'monthly-finance', month, year),
    queryFn: () => api.get(`/families/${familyId}/finance/monthly-finances/me`, { params: { month, year } }).then((r) => r.data),
    enabled: !!familyId && !!month && !!year,
  })
}

/** Tạo bản ghi tài chính tháng (lần đầu cho tháng/năm đó). */
export function useCreateMonthlyFinance(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: MonthlyFinanceInput) =>
      api.post(`/families/${familyId}/finance/monthly-finances/me`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/** Cập nhật bản ghi tài chính tháng đã tồn tại. */
export function useUpdateMonthlyFinance(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: (data: MonthlyFinanceInput) =>
      api.put(`/families/${familyId}/finance/monthly-finances/me`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

/* ----------------------------- Alert & SupportRequest: chi tiết ----------------------------- */

export function useBudgetAlertDetail(familyId: string | null, alertId: string | null) {
  return useQuery<BudgetAlert>({
    queryKey: fkey(familyId ?? '', 'alert', alertId),
    queryFn: () => api.get(`/families/${familyId}/finance/alerts/${alertId}`).then((r) => r.data),
    enabled: !!familyId && !!alertId,
  })
}

export function useSupportRequestDetail(familyId: string | null, requestId: string | null) {
  return useQuery<SupportRequest>({
    queryKey: fkey(familyId ?? '', 'support-request', requestId),
    queryFn: () => api.get(`/families/${familyId}/finance/support-requests/${requestId}`).then((r) => r.data),
    enabled: !!familyId && !!requestId,
  })
}
