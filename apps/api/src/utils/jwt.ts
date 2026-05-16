/**
 * Các hàm tiện ích để ký và xác minh JSON Web Token (JWT).
 * Hỗ trợ hai loại token: access token (thời gian ngắn) và refresh token (thời gian dài).
 */
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env'

/**
 * Cấu trúc payload được nhúng bên trong JWT.
 * Chứa thông tin định danh cơ bản của người dùng và vai trò trong gia đình.
 */
export interface JwtPayload {
  /** ID duy nhất của người dùng trong hệ thống */
  userId: string
  /** Địa chỉ email của người dùng */
  email: string
  /** Vai trò của người dùng (ví dụ: `admin`, `member`) */
  role: string
  /** ID gia đình mà người dùng đang thuộc về (nếu có) */
  familyId?: string
  /** ID thành viên gia đình tương ứng (nếu có) */
  familyMemberId?: string
}

/**
 * Ký access token chứa đầy đủ thông tin định danh của người dùng.
 * Token này có thời gian sống ngắn (mặc định 15 phút) để giảm thiểu rủi ro bảo mật.
 *
 * @param payload - Dữ liệu định danh sẽ được nhúng vào token
 * @returns Chuỗi JWT đã ký
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Ký refresh token chỉ chứa `userId`.
 * Token này có thời gian sống dài hơn (mặc định 7 ngày) và dùng để cấp mới access token
 * mà không yêu cầu người dùng đăng nhập lại.
 *
 * @param payload - Chỉ cần `userId` để tối thiểu hóa thông tin lưu trong refresh token
 * @returns Chuỗi JWT đã ký
 */
export function signRefreshToken(payload: Pick<JwtPayload, 'userId'> & { jti?: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Xác minh và giải mã access token.
 * Ném lỗi nếu token không hợp lệ hoặc đã hết hạn.
 *
 * @param token - Chuỗi JWT access token cần kiểm tra
 * @returns Payload đã giải mã dạng `JwtPayload`
 * @throws {JsonWebTokenError | TokenExpiredError} Nếu token không hợp lệ hoặc hết hạn
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
}

/**
 * Xác minh và giải mã refresh token.
 * Ném lỗi nếu token không hợp lệ hoặc đã hết hạn.
 *
 * @param token - Chuỗi JWT refresh token cần kiểm tra
 * @returns Payload chỉ chứa `userId`
 * @throws {JsonWebTokenError | TokenExpiredError} Nếu token không hợp lệ hoặc hết hạn
 */
export function verifyRefreshToken(token: string): Pick<JwtPayload, 'userId'> & { jti?: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as Pick<JwtPayload, 'userId'> & { jti?: string }
}
