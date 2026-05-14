/**
 * @module api
 * @description Cấu hình instance Axios dùng chung cho toàn bộ ứng dụng.
 * Bao gồm:
 * - Tự động gắn access token vào header `Authorization` mỗi request.
 * - Tự động làm mới access token khi nhận lỗi 401 (Unauthorized)
 *   bằng cách gọi endpoint `/auth/refresh` với refresh token hiện tại.
 * - Xóa token và chuyển hướng về trang đăng nhập nếu refresh thất bại.
 */

import axios from 'axios'

/** URL gốc của API backend, đọc từ biến môi trường hoặc dùng localhost làm mặc định */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Instance Axios được cấu hình sẵn với base URL và Content-Type mặc định.
 * Sử dụng instance này cho mọi lời gọi API trong ứng dụng.
 */
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Interceptor request: Tự động gắn JWT access token vào header `Authorization`
 * trước mỗi request. Chỉ chạy trên môi trường trình duyệt (kiểm tra `window`).
 */
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Interceptor response: Xử lý lỗi 401 (token hết hạn) bằng cách:
 * 1. Dùng refresh token để lấy cặp token mới từ `/auth/refresh`.
 * 2. Lưu token mới vào localStorage.
 * 3. Thực hiện lại request ban đầu với token mới.
 * Nếu refresh thất bại (refresh token hết hạn hoặc không tồn tại),
 * xóa toàn bộ token và chuyển người dùng về trang đăng nhập.
 *
 * Cờ `_retry` trên config gốc ngăn vòng lặp vô tận khi refresh cũng trả về 401.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')
        // Gọi trực tiếp axios (không qua instance `api`) để tránh vòng lặp interceptor
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        // Refresh thất bại: xóa token và điều hướng về trang đăng nhập
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        if (typeof window !== 'undefined') window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
