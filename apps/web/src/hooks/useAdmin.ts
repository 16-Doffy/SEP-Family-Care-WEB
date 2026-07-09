/**
 * @module hooks/useAdmin
 * @description React Query hooks cho khu vực Admin (SYSTEM_ADMIN), theo đúng API team:
 * `/admin/users`, `/admin/families`, `/admin/family-members`, `/admin/subscription-plans`,
 * `/admin/invitations`. Swagger không khai báo schema response chi tiết cho các GET này,
 * nên các interface dưới đây dựa trên field của DTO ghi (PATCH/POST) — coi các field còn
 * lại là "best effort", luôn fallback an toàn khi hiển thị.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Paginated } from './useTeamFinance'

export interface AdminUser {
  id: string
  email: string
  fullName: string
  phone?: string | null
  avatarUrl?: string | null
  userType: 'NORMAL_USER' | 'SYSTEM_ADMIN'
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED'
  createdAt?: string
}

export interface AdminUpdateUserInput {
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  userType?: 'NORMAL_USER' | 'SYSTEM_ADMIN'
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED'
  fullName?: string
  phone?: string
  avatarUrl?: string
}

export function useAdminUsers(params?: { page?: number; limit?: number; search?: string; userType?: string; accountStatus?: string }) {
  return useQuery<Paginated<AdminUser>>({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', { params }).then((r) => r.data),
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateUserInput & { id: string }) =>
      api.patch(`/admin/users/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export interface AdminFamilyMember {
  id: string
  userId: string
  familyId: string
  familyRole: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'REMOVED'
  displayName?: string | null
  user?: { id: string; fullName: string; email: string } | null
}

export interface AdminFamily {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED'
  activationStatus?: 'ACTIVE' | 'PENDING' | 'FAILED'
  createdAt?: string
  members?: AdminFamilyMember[]
  _count?: { members: number }
}

export interface AdminUpdateFamilyInput {
  name?: string
  description?: string
  avatarUrl?: string
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED'
  activationStatus?: 'ACTIVE' | 'PENDING' | 'FAILED'
}

export function useAdminFamilies(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  return useQuery<Paginated<AdminFamily>>({
    queryKey: ['admin', 'families', params],
    queryFn: () => api.get('/admin/families', { params }).then((r) => r.data),
  })
}

export function useAdminFamily(id: string | null) {
  return useQuery<AdminFamily>({
    queryKey: ['admin', 'family', id],
    queryFn: () => api.get(`/admin/families/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useUpdateAdminFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateFamilyInput & { id: string }) =>
      api.patch(`/admin/families/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'families'] }),
  })
}

export interface AdminUpdateMemberInput {
  familyRole?: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship?: 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'SISTER' | 'BROTHER' | 'GRANDPARENT' | 'OTHER'
  status?: 'ACTIVE' | 'INACTIVE' | 'REMOVED'
  displayName?: string
}

export function useAdminFamilyMembers(params?: { page?: number; limit?: number; familyId?: string; userId?: string; familyRole?: string; status?: string }) {
  return useQuery<Paginated<AdminFamilyMember>>({
    queryKey: ['admin', 'family-members', params],
    queryFn: () => api.get('/admin/family-members', { params }).then((r) => r.data),
    enabled: !!params?.familyId || params == null,
  })
}

export function useUpdateAdminFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateMemberInput & { id: string }) =>
      api.patch(`/admin/family-members/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-members'] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
      qc.invalidateQueries({ queryKey: ['admin', 'family'] })
    },
  })
}

export interface SubscriptionPlan {
  id: string
  planCode: string
  name: string
  annualPrice: number | string
  maxMembers: number | null
  storageLimit: number
  stripePriceId?: string | null
  featureAccess?: Record<string, unknown> | null
  isActive: boolean
  _count?: { families: number }
}

export interface SubscriptionPlanInput {
  planCode: string
  name: string
  annualPrice: number
  maxMembers?: number
  storageLimit: number
  stripePriceId?: string
  featureAccess?: Record<string, unknown>
  isActive?: boolean
}

export function useAdminSubscriptionPlans(params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
  return useQuery<Paginated<SubscriptionPlan>>({
    queryKey: ['admin', 'subscription-plans', params],
    queryFn: () => api.get('/admin/subscription-plans', { params }).then((r) => r.data),
  })
}

export function useCreateSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SubscriptionPlanInput) => api.post('/admin/subscription-plans', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export function useUpdateSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SubscriptionPlanInput> & { id: string }) =>
      api.patch(`/admin/subscription-plans/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export function useDeleteSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subscription-plans/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export interface AdminInvitation {
  id: string
  email?: string | null
  status: 'PENDING' | 'CLAIMED' | 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELED' | string
  familyId: string
  createdAt?: string
}

export function useAdminInvitations(params?: { page?: number; limit?: number; status?: string; familyId?: string }) {
  return useQuery<Paginated<AdminInvitation>>({
    queryKey: ['admin', 'invitations', params],
    queryFn: () => api.get('/admin/invitations', { params }).then((r) => r.data),
  })
}

export function useUpdateAdminInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string }) =>
      api.patch(`/admin/invitations/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invitations'] }),
  })
}

export function useDeleteAdminInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/invitations/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invitations'] }),
  })
}

export function useDeleteAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDeleteAdminFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/families/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'families'] }),
  })
}

export function useDeleteAdminFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/family-members/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-members'] })
      qc.invalidateQueries({ queryKey: ['admin', 'family'] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
    },
  })
}
