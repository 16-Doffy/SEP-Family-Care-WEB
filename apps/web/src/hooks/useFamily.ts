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

/** Danh sách gia đình của người dùng hiện tại. */
export function useMyFamilies() {
  return useQuery<Family[]>({
    queryKey: ['families', 'my'],
    queryFn: () => api.get('/families/my').then((r) => r.data),
  })
}

/**
 * Gia đình đang hoạt động: ưu tiên id đã lưu trong localStorage, nếu không thì lấy phần tử đầu.
 * Trả về cả `familyId` tiện dùng cho các hook finance.
 */
export function useActiveFamily() {
  const query = useMyFamilies()
  const families = query.data ?? []
  const savedId = getActiveFamilyId()
  const active = families.find((f) => f.id === savedId) ?? families[0] ?? null
  return { ...query, families, family: active, familyId: active?.id ?? null }
}
