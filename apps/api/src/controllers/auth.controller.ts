/**
 * @module auth.controller
 * @description Controller xử lý các HTTP request liên quan đến xác thực.
 * Lớp này chỉ chịu trách nhiệm:
 *   1. Validate dữ liệu đầu vào bằng Zod schema.
 *   2. Chuyển tiếp sang auth.service để xử lý business logic.
 *   3. Trả về HTTP response phù hợp hoặc chuyển lỗi sang error middleware.
 *
 * Mọi logic nghiệp vụ (hash mật khẩu, phát hành token, v.v.) đều nằm trong
 * auth.service, không được đặt tại đây.
 */

import type { Request, Response, NextFunction } from 'express'
import * as authService from '../services/auth.service'
import { z } from 'zod'

/**
 * Schema kiểm tra dữ liệu đăng ký.
 * - email: định dạng email hợp lệ
 * - password: tối thiểu 6 ký tự
 * - displayName: 1–100 ký tự
 * - familyName: tuỳ chọn, 1–200 ký tự (bắt buộc ở Flow 2 trong service)
 * - role: PARENT hoặc FAMILY_MEMBER (tuỳ chọn, mặc định PARENT ở service)
 * - inviteCode: tuỳ chọn, dùng khi tham gia gia đình có sẵn
 */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
  familyName: z.string().min(1).max(200).optional(),
  role: z.enum(['PARENT', 'FAMILY_MEMBER']).optional(),
  inviteCode: z.string().optional(),
})

/**
 * Schema kiểm tra dữ liệu đăng nhập.
 * - password không yêu cầu độ dài tối thiểu ở đây vì thông báo lỗi
 *   "Invalid email or password" được trả về bởi service (không tiết lộ nguyên nhân cụ thể).
 */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Xử lý yêu cầu đăng ký tài khoản mới.
 *
 * POST /auth/register
 *
 * @param req - Express Request chứa body theo registerSchema
 * @param res - Express Response, trả về HTTP 201 kèm token và thông tin user
 * @param next - Chuyển lỗi validation hoặc business logic sang error middleware
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate và parse body — Zod sẽ ném ZodError nếu không hợp lệ
    const data = registerSchema.parse(req.body)
    const result = await authService.register(data)
    // HTTP 201 Created để phân biệt với các response 200 thông thường
    res.status(201).json(result)
  } catch (e) {
    next(e)
  }
}

/**
 * Xử lý yêu cầu đăng nhập.
 *
 * POST /auth/login
 *
 * @param req - Express Request chứa body theo loginSchema
 * @param res - Express Response, trả về HTTP 200 kèm token và thông tin user
 * @param next - Chuyển lỗi sang error middleware
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await authService.login(email, password)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

/**
 * Xử lý yêu cầu làm mới token (token rotation).
 *
 * POST /auth/refresh
 *
 * Client gửi refresh token hiện tại, nhận về cặp token mới.
 * Refresh token cũ bị thu hồi ngay sau khi cấp token mới.
 *
 * @param req - Express Request với body `{ refreshToken: string }`
 * @param res - Express Response, trả về cặp accessToken và refreshToken mới
 * @param next - Chuyển lỗi (UnauthorizedError nếu token không hợp lệ) sang error middleware
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const tokens = await authService.refreshTokens(refreshToken)
    res.json(tokens)
  } catch (e) {
    next(e)
  }
}

/**
 * Xử lý yêu cầu đăng xuất.
 *
 * POST /auth/logout
 *
 * Thu hồi refresh token được cung cấp. Client cần tự xóa access token
 * phía local vì access token không thể bị thu hồi (stateless JWT).
 *
 * @param req - Express Request với body `{ refreshToken: string }`
 * @param res - Express Response, trả về thông báo thành công
 * @param next - Chuyển lỗi sang error middleware
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    await authService.logout(refreshToken)
    res.json({ message: 'Logged out successfully' })
  } catch (e) {
    next(e)
  }
}

/**
 * Lấy thông tin người dùng đang đăng nhập.
 *
 * GET /auth/me  (yêu cầu xác thực)
 *
 * userId được lấy từ JWT payload đã được middleware `authenticate` gắn vào
 * `req.user`, không nhận từ body hay params để tránh người dùng giả mạo.
 *
 * @param req - Express Request, req.user.userId được gắn bởi authenticate middleware
 * @param res - Express Response, trả về thông tin user kèm gia đình
 * @param next - Chuyển lỗi sang error middleware
 */
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user.userId)
    res.json(user)
  } catch (e) {
    next(e)
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      displayName: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    }).parse(req.body)
    const user = await authService.updateMe(req.user.userId, data)
    res.json(user)
  } catch (e) {
    next(e)
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(req.body)
    await authService.changePassword(req.user.userId, currentPassword, newPassword)
    res.json({ message: 'Password changed successfully' })
  } catch (e) {
    next(e)
  }
}

export async function sessions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getSessions(req.user.userId)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.revokeSession(req.user.userId, req.params.id)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export async function stats(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getMyStats(req.user.userId)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const result = await authService.forgotPassword(email)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = z.object({
      token: z.string(),
      newPassword: z.string().min(6),
    }).parse(req.body)
    await authService.resetPassword(token, newPassword)
    res.json({ message: 'Password reset successfully' })
  } catch (e) {
    next(e)
  }
}
