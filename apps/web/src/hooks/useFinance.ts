/**
 * @module hooks/useFinance
 * @description React Query hooks cho Core flow 1 (Family Finance).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MemberSummary {
  memberId: string
  nickname: string | null
  displayName: string
  avatarUrl: string | null
  occupation: string | null
  hasIncome: boolean
  plannedIncome: number
  plannedPersonalExpense: number
  personalSpendingLimit: number | null
  actualPersonalExpense: number
  isOverLimit: boolean
}

export interface MonthlySummary {
  year: number
  month: number
  jointWalletBalance: number
  planned: { income: number; sharedExpense: number; personalExpense: number; totalExpense: number; surplus: number }
  actual: { income: number; sharedExpense: number; personalExpense: number; totalExpense: number; surplus: number }
  budget: {
    id: string
    plannedSharedExpense: number | string
    notes: string | null
    categories: { id: string; name: string; amount: number | string }[]
  } | null
  perMember: MemberSummary[]
}

export interface Forecast {
  startBalance: number
  avgMonthlySurplus: number
  history: {
    year: number
    month: number
    surplus: number
    jointWalletBalance: number
    totalIncome: number
    totalExpense: number
  }[]
  projections: { year: number; month: number; expectedSurplus: number; projectedBalance: number }[]
}

export interface FinanceWarning {
  code: 'BUDGET_WARNING' | 'FUND_LOW_WARNING' | 'FUND_SURPLUS_SUGGESTION' | 'INCOME_VS_EXPENSE_TIGHT'
  severity: 'info' | 'warning' | 'danger'
  title: string
  body: string
  metadata?: Record<string, unknown>
}

export interface IncomeSource {
  id: string
  memberId: string
  label: string
  sourceType: 'SALARY' | 'BUSINESS' | 'INVESTMENT' | 'ALLOWANCE' | 'RENTAL' | 'FREELANCE' | 'OTHER'
  amountPerMonth: number | string
  isActive: boolean
}

export interface PersonalExpense {
  id: string
  memberId: string
  amount: number | string
  category: string
  note: string | null
  occurredAt: string
}

export interface FamilyExpense {
  id: string
  familyId: string
  amount: number | string
  category: string
  note: string | null
  paidById: string | null
  occurredAt: string
  paidBy?: { user: { displayName: string } } | null
}

export function useMonthlySummary(year?: number, month?: number) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1
  return useQuery<MonthlySummary>({
    queryKey: ['finance-summary', y, m],
    queryFn: () => api.get(`/finance/summary?year=${y}&month=${m}`).then((r) => r.data),
  })
}

export function usePrediction(months = 3) {
  return useQuery<Forecast>({
    queryKey: ['finance-prediction', months],
    queryFn: () => api.get(`/finance/prediction?months=${months}`).then((r) => r.data),
  })
}

export function useWarnings() {
  return useQuery<FinanceWarning[]>({
    queryKey: ['finance-warnings'],
    queryFn: () => api.get('/finance/warnings').then((r) => r.data),
    refetchInterval: 60_000,
  })
}

export function useIncomeSources(memberId?: string) {
  return useQuery<IncomeSource[]>({
    queryKey: ['income-sources', memberId],
    queryFn: () => api.get(`/finance/members/${memberId}/income-sources`).then((r) => r.data),
    enabled: !!memberId,
  })
}

export function useUpsertBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      year: number
      month: number
      notes?: string
      categories: { name: string; amount: number }[]
    }) => api.put('/finance/budget', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useCreatePersonalExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { memberId?: string; amount: number; category: string; note?: string; occurredAt?: string }) =>
      api.post('/finance/personal-expenses', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
      qc.invalidateQueries({ queryKey: ['finance-warnings'] })
      qc.invalidateQueries({ queryKey: ['personal-expenses'] })
    },
  })
}

export function useCreateFamilyExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { amount: number; category: string; note?: string; paidById?: string; occurredAt?: string }) =>
      api.post('/finance/family-expenses', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
      qc.invalidateQueries({ queryKey: ['family-expenses'] })
    },
  })
}

export function usePersonalExpenses(memberId?: string) {
  return useQuery<PersonalExpense[]>({
    queryKey: ['personal-expenses', memberId],
    queryFn: () =>
      api
        .get('/finance/personal-expenses', { params: memberId ? { memberId } : {} })
        .then((r) => r.data),
  })
}

export function useFamilyExpenses() {
  return useQuery<FamilyExpense[]>({
    queryKey: ['family-expenses'],
    queryFn: () => api.get('/finance/family-expenses').then((r) => r.data),
  })
}

export function useCreateIncomeSource(memberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string; sourceType?: IncomeSource['sourceType']; amountPerMonth: number }) =>
      api.post(`/finance/members/${memberId}/income-sources`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-sources', memberId] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useUpdateIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IncomeSource> }) =>
      api.patch(`/finance/income-sources/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-sources'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useDeleteIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/finance/income-sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-sources'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useUpdateMemberBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string
      data: { occupation?: string; plannedPersonalExpense?: number; personalSpendingLimit?: number | null }
    }) => api.put(`/finance/members/${memberId}/budget`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
      qc.invalidateQueries({ queryKey: ['family'] })
    },
  })
}
