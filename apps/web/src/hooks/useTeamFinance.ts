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

export function useBudgetPlans(familyId: string | null) {
  return useQuery<Paginated<BudgetPlan>>({
    queryKey: fkey(familyId ?? '', 'budget-plans'),
    queryFn: () => api.get(`/families/${familyId}/finance/budget-plans`).then((r) => r.data),
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

export function useFinancialGoals(familyId: string | null) {
  return useQuery<Paginated<FinancialGoal>>({
    queryKey: fkey(familyId ?? '', 'financial-goals'),
    queryFn: () => api.get(`/families/${familyId}/finance/financial-goals`).then((r) => r.data),
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

export function useSupportRequests(familyId: string | null) {
  return useQuery<Paginated<SupportRequest>>({
    queryKey: fkey(familyId ?? '', 'support-requests'),
    queryFn: () => api.get(`/families/${familyId}/finance/support-requests`).then((r) => r.data),
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
    mutationFn: ({ requestId, decision, decisionNote }: { requestId: string; decision: 'APPROVE' | 'REJECT'; decisionNote?: string }) =>
      api.patch(`/families/${familyId}/finance/support-requests/${requestId}/review`, { decision, decisionNote }).then((r) => r.data),
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

export function useBudgetAlerts(familyId: string | null) {
  return useQuery<Paginated<BudgetAlert>>({
    queryKey: fkey(familyId ?? '', 'alerts'),
    queryFn: () => api.get(`/families/${familyId}/finance/alerts`).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useRecomputeAlerts(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: () => api.post(`/families/${familyId}/finance/alerts/recompute`, { scope: 'ALL' }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAlertAction(familyId: string | null) {
  const invalidate = useInvalidateFinance(familyId)
  return useMutation({
    mutationFn: ({ alertId, action }: { alertId: string; action: 'acknowledge' | 'resolve' }) =>
      api.patch(`/families/${familyId}/finance/alerts/${alertId}/${action}`).then((r) => r.data),
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

export function useFinanceReportOverview(familyId: string | null) {
  return useQuery<FinanceReportOverview>({
    queryKey: fkey(familyId ?? '', 'report-overview'),
    queryFn: () => api.get(`/families/${familyId}/finance/reports/overview`).then((r) => r.data),
    enabled: !!familyId,
  })
}
