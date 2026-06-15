/**
 * @module hooks/useFamily
 * @description Lấy danh sách gia đình của người dùng và xác định gia đình "đang chọn".
 *
 * API team scope mọi tài nguyên theo `/families/{familyId}/...`, nên toàn bộ
 * các flow (finance, invitations...) cần một `familyId`. Hook này lấy từ
 * `/families/my` và ghi nhớ lựa chọn vào localStorage.
 */

import { useQuery } from '@tanstack/react-query'
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
