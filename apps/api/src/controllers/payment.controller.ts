/**
 * @file payment.controller.ts
 * @module controllers/payment
 *
 * Controller xử lý các HTTP request liên quan đến thanh toán.
 *
 * Các endpoint được expose:
 * - POST /payments/checkout          → Tạo phiên thanh toán mới
 * - POST /payments/:id/confirm-mock  → Xác nhận thanh toán mock
 * - GET  /payments/history           → Xem lịch sử thanh toán của gia đình
 *
 * Tất cả route đều yêu cầu xác thực và người dùng phải thuộc gia đình.
 */

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as paymentService from '../services/payment.service'

/**
 * Schema validate cho body tạo phiên thanh toán.
 *
 * Dùng `discriminatedUnion` theo trường `type` để:
 * - SUBSCRIPTION yêu cầu `planId`
 * - WALLET_TOPUP yêu cầu `amount` + `walletId` (và tùy chọn `description`)
 *
 * Phân biệt rõ ràng hai loại giúp tránh trường hợp client gửi thiếu tham số
 * bắt buộc mà không biết.
 */
const checkoutSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SUBSCRIPTION'),
    planId: z.string(),
  }),
  z.object({
    type: z.literal('WALLET_TOPUP'),
    amount: z.number().positive(),
    walletId: z.string(),
    description: z.string().optional(),
  }),
])

/**
 * Tạo phiên thanh toán mới (checkout session).
 *
 * Validate input rồi chuyển cho service xử lý. Kết quả trả về khác nhau
 * tùy theo chế độ:
 * - Mock mode: `{ mode: 'mock', paymentId, checkoutUrl: null, message }`
 * - Stripe mode (chưa implement): sẽ trả về Stripe Checkout URL
 *
 * @param req - Express Request (body: checkout payload, cần `req.user`)
 * @param res - Express Response trả về `201` kèm kết quả checkout
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws ZodError nếu body không hợp lệ
 * @throws BadRequest nếu thiếu tham số bắt buộc theo loại thanh toán
 * @throws NotFound nếu plan không tồn tại
 */
export async function createCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const body = checkoutSchema.parse(req.body)
    const result = await paymentService.createCheckoutSession({
      userId: req.user.userId,
      familyId: req.user.familyId!,
      ...body,
    })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

/**
 * Xác nhận thanh toán mock để mô phỏng hoàn tất thanh toán.
 *
 * Chỉ hoạt động trong môi trường chưa có Stripe. Sau khi xác nhận,
 * subscription sẽ được kích hoạt (hoặc ví được nạp tiền).
 *
 * @param req - Express Request (params: `id` = paymentId, cần `req.user`)
 * @param res - Express Response trả về `{ payment }` đã finalize
 * @param next - Hàm next để chuyển lỗi cho error handler
 * @throws NotFound nếu payment không tồn tại
 * @throws Forbidden nếu payment không thuộc người dùng hiện tại
 * @throws BadRequest nếu payment đã xử lý hoặc không phải MOCK
 */
export async function confirmMock(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.confirmMockPayment(req.params.id, req.user.userId)
    res.json({ payment })
  } catch (e) { next(e) }
}

/**
 * Lấy lịch sử thanh toán của gia đình người dùng.
 *
 * Trả về tất cả payment (mọi trạng thái) của gia đình, sắp xếp mới nhất trước.
 * Dùng `familyId` thay vì `userId` vì trong gia đình mọi thành viên
 * có thể xem lịch sử thanh toán chung.
 *
 * @param req - Express Request (cần `req.user.familyId`)
 * @param res - Express Response trả về `{ payments }`
 * @param next - Hàm next để chuyển lỗi cho error handler
 */
export async function listMyPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentService.listFamilyPayments(req.user.familyId!)
    res.json({ payments })
  } catch (e) { next(e) }
}

/**
 * Lấy thống kê doanh thu (chỉ dành cho admin).
 *
 * Trả về tổng doanh thu, MRR, ARR và breakdown theo tháng.
 * Route này được bảo vệ ở tầng route (admin middleware).
 *
 * @param _req - Express Request (không cần dùng)
 * @param res - Express Response trả về đối tượng thống kê doanh thu
 * @param next - Hàm next để chuyển lỗi cho error handler
 */
export async function getRevenue(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await paymentService.getRevenueStats()
    res.json(stats)
  } catch (e) { next(e) }
}
