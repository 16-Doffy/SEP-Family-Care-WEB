/**
 * @module hooks/useFamily
 * @description React Query hooks cho Gia đình và Lời mời theo API team.
 *
 * API team scope mọi tài nguyên theo `/families/{familyId}/...`, nên toàn bộ
 * các flow (finance, invitations...) cần một `familyId`. Hook này lấy từ
 * `/families/my` và ghi nhớ lựa chọn vào localStorage.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Một thành viên trong gia đình (theo contract team). */
export interface FamilyMember {
  id: string
  familyId: string
  userId: string
  displayName: string | null
  familyRole: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship: string | null
  status: string
  user?: { id: string; email: string; fullName: string; avatarUrl?: string | null; userType?: string }
}

/** Một gia đình (theo contract team). */
export interface Family {
  id: string
  name: string
  description: string | null
  avatarUrl: string | null
  status: string
  activationStatus: string
  createdById: string
  members?: FamilyMember[]
}

/** Lời mời tham gia gia đình. */
export interface Invitation {
  token: string
  email: string
  invitedPhone: string | null
  familyRole: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | string
  expiresAt: string
  family?: { id: string; name: string } | null
  invitedBy?: { id: string; fullName: string } | null
}

/** Gói đăng ký dịch vụ. */
export interface SubscriptionPlan {
  id: string
  planCode: string
  name: string
  description: string | null
  monthlyPrice: number | string | null
  annualPrice: number | string | null
  maxMembers: number | null
  storageLimit: number | null
  features: string[]
  isActive: boolean
}

const ACTIVE_FAMILY_KEY = 'activeFamilyId'

/** Đọc id gia đình đang chọn (localStorage). */
export function getActiveFamilyId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_FAMILY_KEY)
}

/** Ghi id gia đình đang chọn. */
export function setActiveFamilyId(id: string) {
  if (typeof window !== 'undefined') localStorage.setItem(ACTIVE_FAMILY_KEY, id)
}

/* =====================================================================
 * Gia đình
 * ===================================================================== */

/**
 * Danh sách gia đình của người dùng hiện tại.
 * Lưu ý: endpoint này trả về members ở dạng rút gọn (không có id/userId/user),
 * chỉ dùng để liệt kê và chọn gia đình. Cần members đầy đủ thì dùng useFamilyDetail.
 */
export function useMyFamilies() {
  return useQuery<Family[]>({
    queryKey: ['families', 'my'],
    queryFn: () => api.get('/families/my').then((r) => r.data),
  })
}

/** Chi tiết một gia đình kèm members đầy đủ (id, userId, user, vai trò...). */
export function useFamilyDetail(familyId: string | null) {
  return useQuery<Family>({
    queryKey: ['families', 'detail', familyId],
    queryFn: () => api.get(`/families/${familyId}`).then((r) => r.data),
    enabled: !!familyId,
  })
}

/**
 * Gia đình đang hoạt động: chọn id (ưu tiên localStorage, nếu không lấy phần tử đầu)
 * từ `/families/my`, rồi lấy chi tiết qua `/families/{id}` để có members đầy đủ.
 */
export function useActiveFamily() {
  const list = useMyFamilies()
  const families = list.data ?? []
  const savedId = getActiveFamilyId()
  const familyId = (families.find((f) => f.id === savedId) ?? families[0])?.id ?? null
  const detail = useFamilyDetail(familyId)
  return {
    families,
    family: detail.data ?? null,
    familyId,
    isLoading: list.isLoading || (!!familyId && detail.isLoading),
    refetch: detail.refetch,
  }
}

/** Tạo gia đình mới (người tạo tự động trở thành FAMILY_MANAGER). */
export function useCreateFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; avatarUrl?: string; relationship?: 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'SISTER' | 'BROTHER' | 'GRANDPARENT' | 'OTHER' }) =>
      api.post('/families', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
}

/** Cập nhật thông tin gia đình (chỉ FAMILY_MANAGER). */
export function useUpdateFamily(familyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; avatarUrl?: string }) =>
      api.patch(`/families/${familyId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
}

/* =====================================================================
 * Thành viên
 * ===================================================================== */

/** Mời thành viên vào gia đình (chỉ FAMILY_MANAGER). Trả về `{ token }`. */
export function useInviteFamily(familyId: string | null) {
  return useMutation({
    mutationFn: (data: { email: string; invitedPhone?: string; familyRole?: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'; relationship?: 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'SISTER' | 'BROTHER' | 'GRANDPARENT' | 'OTHER' }) =>
      api.post(`/families/${familyId}/invitations`, data).then((r) => r.data),
  })
}

/** Xóa thành viên khỏi gia đình (chỉ FAMILY_MANAGER, không thể xóa chính mình). */
export function useRemoveFamilyMember(familyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/families/${familyId}/members/${userId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
}

/* =====================================================================
 * Lời mời (invitations)
 * ===================================================================== */

/** Xem thông tin lời mời theo token (public, không cần đăng nhập). */
export function useInvitationByToken(token: string | null) {
  return useQuery<Invitation>({
    queryKey: ['invitation', token],
    queryFn: () => api.get(`/invitations/${token}`).then((r) => r.data),
    enabled: !!token,
  })
}

/** Chấp nhận lời mời (người dùng đã đăng nhập). */
export function useAcceptInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.post(`/invitations/${token}/accept`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
}

/** Từ chối lời mời. */
export function useRejectInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post(`/invitations/${token}/reject`).then((r) => r.data),
  })
}

/* =====================================================================
 * Gói đăng ký
 * ===================================================================== */

/** Danh sách gói đăng ký đang hoạt động (public). */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscription-plans').then((r) => r.data),
  })
}
