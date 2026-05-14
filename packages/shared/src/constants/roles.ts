/**
 * Định nghĩa các vai trò người dùng trong hệ thống gia đình.
 * Module này xuất hằng số ROLES và kiểu Role dùng chung cho cả client và server.
 */

/**
 * Tập hợp các vai trò người dùng được hỗ trợ trong ứng dụng.
 *
 * - `SUPER_ADMIN`: Quản trị viên hệ thống, có toàn quyền trên nền tảng.
 * - `PARENT`:      Phụ huynh trong gia đình – có thể tạo nhiệm vụ, phê duyệt,
 *                  quản lý ví và thành viên.
 * - `CHILD`:       Con cái trong gia đình – có thể nhận nhiệm vụ, nộp bằng chứng
 *                  và xem số dư ví cá nhân.
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const

/**
 * Kiểu union đại diện cho một vai trò hợp lệ trong hệ thống.
 * Được suy ra từ các khóa của `ROLES`.
 *
 * @example
 * const role: Role = 'PARENT'
 */
export type Role = keyof typeof ROLES
