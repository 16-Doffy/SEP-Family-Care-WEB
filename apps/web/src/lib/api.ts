/**
 * @module api
 * @description Cấu hình instance Axios dùng chung cho toàn bộ ứng dụng.
 *
 * Backend chung của team (Family Care API) dùng:
 * - Prefix đường dẫn `/api/v1`.
 * - Envelope response thống nhất: `{ success, message, data }`.
 *
 * Instance này:
 * - Tự gắn access token vào header `Authorization` mỗi request.
 * - Tự "bóc" envelope ở response thành công → các nơi gọi chỉ thấy `data` bên trong
 *   (ví dụ `api.get('/auth/me').then(({ data }) => data) === user`).
 * - Tự làm mới access token khi gặp lỗi 401 qua `/auth/refresh`.
 * - Xóa token và điều hướng về `/login` nếu refresh thất bại.
 */

import axios from 'axios'

/**
 * Origin của API. Mặc định để rỗng → gọi **same-origin** `/api/v1`, được Next.js
 * rewrite (xem next.config.js) forward sang API team ở tầng server → tránh mixed
 * content khi deploy HTTPS. Có thể đặt `NEXT_PUBLIC_API_URL` để gọi trực tiếp một
 * origin khác (vd chạy nội bộ HTTP, không qua proxy).
 */
const API_ROOT = process.env.NEXT_PUBLIC_API_URL || ''

/** Tiền tố version của API team. Mọi route đều nằm dưới `/api/v1`. */
const API_PREFIX = '/api/v1'

/** Base URL đầy đủ cho các request (rỗng origin → '/api/v1' same-origin). */
const API_BASE = `${API_ROOT}${API_PREFIX}`

/**
 * Trích thông điệp lỗi từ envelope của API team (`{ success:false, message }`).
 * Dùng trong các khối catch để hiển thị toast thân thiện.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  const data = (err as { response?: { data?: { message?: string | string[]; error?: string } } })?.response?.data
  const msg = data?.message ?? data?.error
  if (Array.isArray(msg)) return msg.join(', ')
  return msg ?? fallback
}

/**
 * Instance Axios được cấu hình sẵn với base URL (đã gồm `/api/v1`) và Content-Type mặc định.
 * Sử dụng instance này cho mọi lời gọi API trong ứng dụng.
 */
export const api = axios.create({
  baseURL: API_BASE,
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

/** Kiểu envelope chuẩn của API team. */
type Envelope<T = unknown> = { success: boolean; message?: string; data: T }

/** Kiểm tra một payload có phải envelope `{ success, data }` của API team không. */
function isEnvelope(body: unknown): body is Envelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Envelope).success === 'boolean' &&
    'data' in body
  )
}

/**
 * Interceptor response:
 * 1. Bóc envelope `{ success, message, data }` → `response.data` trở thành `data` bên trong,
 *    để phần còn lại của ứng dụng dùng dữ liệu trực tiếp mà không cần biết về envelope.
 * 2. Xử lý lỗi 401 (token hết hạn): dùng refresh token lấy cặp token mới từ `/auth/refresh`,
 *    lưu lại và thực hiện lại request gốc. Nếu refresh thất bại thì xóa token và về `/login`.
 *
 * Cờ `_retry` trên config gốc ngăn vòng lặp vô tận khi refresh cũng trả về 401.
 */
api.interceptors.response.use(
  (response) => {
    if (isEnvelope(response.data)) {
      response.data = response.data.data
    }
    return response
  },
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')
        // Gọi trực tiếp axios (không qua instance `api`) để tránh vòng lặp interceptor.
        const { data: body } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const payload = isEnvelope(body) ? body.data : body
        localStorage.setItem('accessToken', payload.accessToken)
        localStorage.setItem('refreshToken', payload.refreshToken)
        original.headers.Authorization = `Bearer ${payload.accessToken}`
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
