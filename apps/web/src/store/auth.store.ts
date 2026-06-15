/**
 * @module auth.store
 * @description Zustand store quản lý trạng thái xác thực toàn cục.
 *
 * Lưu trữ thông tin người dùng đang đăng nhập, access token,
 * và trạng thái loading khi ứng dụng đang khởi tạo phiên.
 * Các hành động `setAuth` và `clearAuth` đồng thời cập nhật cả
 * localStorage (để token tồn tại qua các lần tải trang) lẫn state trong bộ nhớ.
 */

import { create } from 'zustand'

/**
 * Thông tin người dùng trả về từ API `/auth/me`.
 * Bao gồm thông tin thành viên gia đình nếu người dùng đã tham gia gia đình.
 */
interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  /** Vai trò trong hệ thống, ví dụ: `'USER'`, `'SUPER_ADMIN'` */
  role: string
  /** Thông tin thành viên gia đình; `null` nếu chưa tham gia gia đình nào */
  familyMember?: {
    id: string
    familyId: string
    nickname?: string | null
    relationship?: string | null
    birthDate?: string | null
    notes?: string | null
    isOwner?: boolean | null
    family?: { id: string; name: string; plan: string }
  } | null
}

/**
 * Interface mô tả toàn bộ state và actions của auth store.
 * Được export để dùng làm kiểu cho `AuthContext`.
 */
export interface AuthState {
  /** Thông tin người dùng hiện tại; `null` khi chưa đăng nhập */
  user: User | null
  /** JWT access token hiện tại; `null` khi chưa đăng nhập */
  accessToken: string | null
  /** `true` trong khi ứng dụng đang kiểm tra phiên đăng nhập ban đầu */
  isLoading: boolean
  /**
   * Lưu thông tin đăng nhập sau khi xác thực thành công.
   * Ghi token vào localStorage và cập nhật state.
   */
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  /**
   * Xóa toàn bộ thông tin đăng nhập (đăng xuất).
   * Xóa token khỏi localStorage và đặt lại state về null.
   */
  clearAuth: () => void
  /** Cập nhật thông tin người dùng (không thay đổi token) */
  setUser: (user: User) => void
  /** Cập nhật trạng thái loading khi khởi tạo phiên */
  setLoading: (loading: boolean) => void
}

/**
 * Zustand store cho xác thực người dùng.
 * Khởi tạo `isLoading: true` để ngăn render nội dung trước khi phiên được xác minh.
 *
 * @example
 * const { user, clearAuth } = useAuthStore()
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  // Bắt đầu ở trạng thái loading để AuthProvider có thể kiểm tra token trong localStorage
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    // Lưu cả hai token vào localStorage để tồn tại qua các lần tải lại trang
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ user, accessToken, isLoading: false })
  },

  clearAuth: () => {
    // Xóa token khỏi localStorage khi đăng xuất hoặc token hết hạn
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, accessToken: null, isLoading: false })
  },

  setUser: (user) => set({ user }),

  setLoading: (isLoading) => set({ isLoading }),
}))
