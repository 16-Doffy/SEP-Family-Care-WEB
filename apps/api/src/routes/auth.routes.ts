/**
 * @module auth.routes
 * @description Định nghĩa các route xác thực của ứng dụng.
 *
 * Các endpoint công khai (không cần token):
 *   POST /auth/register  — Đăng ký tài khoản mới
 *   POST /auth/login     — Đăng nhập, nhận cặp token
 *   POST /auth/refresh   — Làm mới access token bằng refresh token
 *   POST /auth/logout    — Đăng xuất, thu hồi refresh token
 *
 * Endpoint yêu cầu xác thực:
 *   GET  /auth/me        — Lấy thông tin người dùng hiện tại
 *
 * Middleware `authenticate` xác minh JWT access token trong header
 * `Authorization: Bearer <token>` và gắn thông tin người dùng vào `req.user`.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth'

const router: ExpressRouter = Router()

/** Đăng ký tài khoản mới (hoặc tham gia gia đình qua invite code) */
router.post('/register', ctrl.register)

/** Đăng nhập bằng email và mật khẩu */
router.post('/login', ctrl.login)

/** Làm mới cặp token — client gửi refresh token, nhận token mới (rotation) */
router.post('/refresh', ctrl.refresh)

/** Đăng xuất — thu hồi refresh token khỏi database */
router.post('/logout', ctrl.logout)

/**
 * Lấy thông tin người dùng đang đăng nhập.
 * Route này yêu cầu access token hợp lệ qua middleware `authenticate`.
 */
router.get('/me', authenticate, ctrl.me)
router.patch('/me', authenticate, ctrl.updateMe)
router.post('/change-password', authenticate, ctrl.changePassword)
router.get('/me/sessions', authenticate, ctrl.sessions)
router.delete('/me/sessions/:id', authenticate, ctrl.revokeSession)
router.get('/me/stats', authenticate, ctrl.stats)

/** Yêu cầu reset mật khẩu — trả về resetToken (MVP: trực tiếp, production: gửi email) */
router.post('/forgot-password', ctrl.forgotPassword)

/** Đặt lại mật khẩu bằng resetToken nhận từ forgot-password */
router.post('/reset-password', ctrl.resetPassword)

export default router
