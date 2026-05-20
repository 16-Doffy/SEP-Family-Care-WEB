/**
 * Định nghĩa các vai trò người dùng trong hệ thống gia đình.
 * Module này xuất hằng số ROLES và kiểu Role dùng chung cho cả client và server.
 */

/**
 * Tập hợp các vai trò người dùng được hỗ trợ trong ứng dụng.
 *
 * - `SUPER_ADMIN`:    Quản trị viên hệ thống, có toàn quyền trên nền tảng.
 * - `PARENT`:         Người đại diện / chủ hộ – quản lý tài chính, task, thành viên.
 * - `FAMILY_MEMBER`:  Thành viên trong gia đình (con, ông bà, anh chị em, người thân...).
 *                     Có thể có hoặc không có thu nhập, nhận task được giao,
 *                     xem ví cá nhân, tham gia chi tiêu chung.
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PARENT: 'PARENT',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
} as const

/**
 * Kiểu union đại diện cho một vai trò hợp lệ trong hệ thống.
 * Được suy ra từ các khóa của `ROLES`.
 *
 * @example
 * const role: Role = 'PARENT'
 */
export type Role = keyof typeof ROLES

/**
 * Tập "All Members" — gộp Parent + Family Member.
 * Tiện cho các chức năng dành cho mọi thành viên gia đình.
 */
export const ALL_FAMILY_ROLES = [ROLES.PARENT, ROLES.FAMILY_MEMBER] as const
export type FamilyRole = (typeof ALL_FAMILY_ROLES)[number]
