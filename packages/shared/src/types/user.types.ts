/**
 * Định nghĩa các kiểu dữ liệu liên quan đến người dùng, thành viên gia đình
 * và các DTO xác thực (đăng ký, đăng nhập, phản hồi token).
 */

import type { Role } from '../constants/roles'

/**
 * Đại diện cho một tài khoản người dùng trong hệ thống.
 */
export interface User {
  /** Định danh duy nhất của người dùng (UUID). */
  id: string
  /** Địa chỉ email dùng để đăng nhập. */
  email: string
  /** Tên hiển thị trong ứng dụng. */
  displayName: string
  /** URL ảnh đại diện; có thể rỗng nếu chưa cài đặt. */
  avatarUrl?: string | null
  /** Vai trò của người dùng trong hệ thống (SUPER_ADMIN | PARENT | FAMILY_MEMBER). */
  role: Role
  /** Trạng thái hoạt động; tài khoản bị vô hiệu hoá sẽ không thể đăng nhập. */
  isActive: boolean
  /** Thời điểm tạo tài khoản (ISO 8601). */
  createdAt: string
}

/**
 * Đại diện cho một thành viên thuộc về một gia đình cụ thể.
 * Một người dùng có thể là thành viên của nhiều gia đình (mỗi bản ghi là một liên kết).
 */
export interface FamilyMember {
  /** Định danh duy nhất của bản ghi thành viên (UUID). */
  id: string
  /** ID của tài khoản người dùng được liên kết. */
  userId: string
  /** ID của gia đình mà thành viên này thuộc về. */
  familyId: string
  /** Biệt danh trong gia đình; nếu không có sẽ hiển thị displayName. */
  nickname?: string | null
  /** Thời điểm gia nhập gia đình (ISO 8601). */
  joinedAt: string
  /** Thông tin người dùng được nhúng kèm để tránh truy vấn thêm. */
  user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl' | 'role'>
}

/**
 * Dữ liệu đầu vào khi đăng ký tài khoản mới.
 * Người dùng đầu tiên đăng ký sẽ tự động tạo một gia đình mới.
 */
export interface RegisterDto {
  /** Địa chỉ email dùng để đăng nhập (phải là duy nhất). */
  email: string
  /** Mật khẩu sẽ được băm trước khi lưu. */
  password: string
  /** Tên hiển thị của người dùng. */
  displayName: string
  /** Tên gia đình được tạo cùng lúc với tài khoản. */
  familyName: string
  /**
   * Vai trò ban đầu trong gia đình; mặc định là PARENT nếu không truyền.
   * Lưu ý: SUPER_ADMIN không thể tự đăng ký từ endpoint này.
   */
  role?: 'PARENT' | 'FAMILY_MEMBER'
}

/**
 * Dữ liệu đầu vào khi đăng nhập bằng email và mật khẩu.
 */
export interface LoginDto {
  /** Địa chỉ email đã đăng ký. */
  email: string
  /** Mật khẩu dạng văn bản thường (plain-text). */
  password: string
}

/**
 * Phản hồi trả về sau khi đăng ký hoặc đăng nhập thành công.
 * Client cần lưu accessToken để gửi kèm trong header Authorization.
 */
export interface AuthResponse {
  /** JWT ngắn hạn dùng để xác thực các API request. */
  accessToken: string
  /** JWT dài hạn dùng để làm mới accessToken khi hết hạn. */
  refreshToken: string
  /**
   * Thông tin người dùng hiện tại, kèm thông tin thành viên gia đình nếu có.
   * `familyMember` có thể vắng mặt nếu người dùng chưa thuộc gia đình nào.
   */
  user: User & { familyMember?: FamilyMember }
}
