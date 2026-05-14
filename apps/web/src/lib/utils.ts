/**
 * @module utils
 * @description Các hàm tiện ích dùng chung trong toàn bộ ứng dụng:
 * gộp class CSS, định dạng tiền tệ, ngày giờ theo chuẩn Việt Nam,
 * và tra cứu màu sắc / nhãn cho trạng thái nhiệm vụ.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Gộp và hợp nhất các class Tailwind CSS.
 * Sử dụng `clsx` để xử lý điều kiện, sau đó `twMerge` để loại bỏ
 * các class xung đột (ví dụ: `p-2` và `p-4` không xuất hiện cùng nhau).
 *
 * @param inputs - Danh sách các giá trị class (string, object, array, v.v.)
 * @returns Chuỗi class CSS đã được hợp nhất
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Định dạng số tiền theo chuẩn tiền tệ Việt Nam (VND).
 * Trả về `'0đ'` nếu giá trị là `null` hoặc `undefined`.
 *
 * @param amount - Số tiền cần định dạng (số hoặc chuỗi số)
 * @returns Chuỗi đã được định dạng, ví dụ: `"1.000.000 ₫"`
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0đ'
  // Chuyển chuỗi sang số nếu cần trước khi định dạng
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Định dạng ngày theo chuẩn Việt Nam (dd/mm/yyyy).
 * Trả về chuỗi rỗng nếu giá trị đầu vào falsy.
 *
 * @param date - Ngày cần định dạng (chuỗi ISO hoặc đối tượng Date)
 * @returns Chuỗi ngày, ví dụ: `"14/05/2026"`
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Định dạng ngày và giờ theo chuẩn Việt Nam (dd/mm/yyyy HH:mm).
 * Trả về chuỗi rỗng nếu giá trị đầu vào falsy.
 *
 * @param date - Ngày giờ cần định dạng (chuỗi ISO hoặc đối tượng Date)
 * @returns Chuỗi ngày giờ, ví dụ: `"14/05/2026, 09:30"`
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/**
 * Lấy chữ viết tắt từ tên hiển thị (tối đa 2 ký tự in hoa).
 * Dùng để hiển thị avatar dạng chữ cái khi không có ảnh.
 *
 * @param name - Tên đầy đủ của người dùng
 * @returns Chuỗi viết tắt, ví dụ: `"ND"` từ `"Nguyễn Doffy"`
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Trả về các class Tailwind tương ứng với màu nền và màu chữ
 * của một trạng thái nhiệm vụ.
 *
 * @param status - Mã trạng thái (ví dụ: `"PENDING"`, `"APPROVED"`)
 * @returns Chuỗi class CSS, mặc định là màu xám nếu không tìm thấy
 */
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    SUBMITTED: 'bg-purple-100 text-purple-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-800'
}

/**
 * Trả về nhãn tiếng Việt tương ứng với mã trạng thái nhiệm vụ.
 *
 * @param status - Mã trạng thái (ví dụ: `"PENDING"`, `"APPROVED"`)
 * @returns Nhãn tiếng Việt, ví dụ: `"Chờ làm"`. Trả về chính `status`
 *          nếu không tìm thấy trong bảng tra cứu.
 */
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Chờ làm',
    IN_PROGRESS: 'Đang làm',
    SUBMITTED: 'Chờ duyệt',
    APPROVED: 'Hoàn thành',
    REJECTED: 'Bị từ chối',
    CANCELLED: 'Đã hủy',
  }
  return map[status] ?? status
}
