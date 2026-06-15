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
