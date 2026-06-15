'use client'
/**
 * @module AuthContext
 * @description Context xác thực người dùng cho toàn bộ ứng dụng.
 *
 * `AuthProvider` khởi tạo trạng thái đăng nhập khi ứng dụng tải lần đầu
 * bằng cách kiểm tra token trong localStorage và xác minh với API.
 * Tất cả dữ liệu auth được lưu trong Zustand store (`useAuthStore`) và
 * phân phối xuống cây component thông qua React Context.
 *
 * Hook `useAuth` cung cấp lối tắt để truy cập context từ bất kỳ component con nào.
 */

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useAuthStore, mapTeamUser, type AuthState } from '@/store/auth.store'
import { api } from '@/lib/api'

/**
 * Context lưu trữ toàn bộ trạng thái và hành động xác thực.
 * Giá trị ban đầu là `null`; sẽ được gán khi `AuthProvider` mount.
 */
const AuthContext = createContext<AuthState | null>(null)

/**
 * Provider xác thực - bọc cây component và khởi tạo trạng thái đăng nhập.
 *
 * Khi mount, provider kiểm tra access token trong localStorage:
 * - Nếu không có token: tắt trạng thái loading ngay lập tức.
 * - Nếu có token: gọi `/auth/me` để lấy thông tin người dùng hiện tại
 *   và đồng bộ vào store. Nếu API thất bại (token hết hạn), xóa auth.
 *
 * @param children - Cây component cần truy cập context xác thực
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      // Không có token: dừng loading, người dùng chưa đăng nhập
      store.setLoading(false)
      return
    }
    // Xác minh token và lấy thông tin người dùng từ server
    api.get('/auth/me')
      .then(({ data }) => {
        // `data` đã được api.ts bóc khỏi envelope → chính là user của API team.
        const user = mapTeamUser(data)
        store.setAuth(user, token, localStorage.getItem('refreshToken') ?? '')
      })
      .catch(() => {
        // Token không hợp lệ hoặc hết hạn: xóa auth, người dùng phải đăng nhập lại
        store.clearAuth()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Chỉ chạy một lần khi ứng dụng khởi động

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}

/**
 * Hook truy cập context xác thực.
 * Phải được sử dụng bên trong `AuthProvider`, nếu không sẽ ném lỗi.
 *
 * @returns Đối tượng `AuthState` chứa thông tin người dùng và các hành động auth
 * @throws Lỗi nếu hook được gọi ngoài phạm vi `AuthProvider`
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
