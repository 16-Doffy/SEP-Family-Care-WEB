/**
 * @module payments
 * @description Hàm tiện ích để khởi tạo luồng thanh toán (checkout).
 * Hỗ trợ hai chế độ hoạt động:
 * - **Mock mode**: Xác nhận thanh toán ngay lập tức (dùng khi chưa cấu hình Stripe).
 * - **Stripe mode**: Chuyển hướng người dùng đến trang Stripe Checkout.
 */

import { api } from '@/lib/api'

/**
 * Phản hồi từ API khi khởi tạo checkout.
 * @property mode - Chế độ thanh toán: `'mock'` hoặc `'stripe'`
 * @property paymentId - ID bản ghi thanh toán được tạo
 * @property checkoutUrl - URL trang Stripe Checkout (chỉ có trong Stripe mode)
 */
interface CheckoutResponse {
  mode: 'mock' | 'stripe'
  paymentId: string
  checkoutUrl: string | null
}

/**
 * Dữ liệu đầu vào cho hàm `startCheckout`, hỗ trợ hai loại giao dịch:
 * - `SUBSCRIPTION`: Nâng cấp gói thuê bao theo `planId`.
 * - `WALLET_TOPUP`: Nạp tiền vào ví theo `walletId` và `amount`.
 */
type CheckoutInput =
  | { type: 'SUBSCRIPTION'; planId: string }
  | { type: 'WALLET_TOPUP'; amount: number; walletId: string; description?: string }

/**
 * Khởi tạo một phiên thanh toán và xử lý kết quả theo chế độ của backend.
 *
 * - Nếu backend trả về `mode: 'mock'`: gọi thêm API xác nhận mock và trả về `true`
 *   (thanh toán hoàn tất ngay lập tức, không cần redirect).
 * - Nếu backend trả về `checkoutUrl`: chuyển hướng trình duyệt đến trang Stripe
 *   và trả về `false` (kết quả sẽ được xử lý qua webhook sau khi redirect về).
 * - Ném lỗi nếu phản hồi không hợp lệ.
 *
 * @param input - Thông tin giao dịch (loại thanh toán và các tham số liên quan)
 * @returns `true` nếu thanh toán mock thành công ngay lập tức, `false` nếu đã redirect sang Stripe
 * @throws Lỗi nếu chế độ thanh toán không được hỗ trợ
 */
export async function startCheckout(input: CheckoutInput): Promise<boolean> {
  const { data } = await api.post<CheckoutResponse>('/payments/checkout', input)

  if (data.mode === 'mock') {
    // Mock mode: xác nhận thanh toán ngay phía server mà không cần cổng thanh toán thật
    await api.post(`/payments/${data.paymentId}/confirm-mock`)
    return true
  }

  if (data.checkoutUrl) {
    // Stripe mode: chuyển hướng sang trang thanh toán của Stripe
    window.location.href = data.checkoutUrl
    return false
  }

  throw new Error('Unsupported payment mode')
}
