/**
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng Express.
 * Bắt và chuẩn hóa ba loại lỗi: AppError (lỗi nghiệp vụ), ZodError (lỗi validation), và lỗi không mong đợi.
 */
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { ZodError } from 'zod'

/**
 * Error handler middleware của Express (nhận 4 tham số để Express nhận dạng đây là error handler).
 *
 * Thứ tự xử lý lỗi:
 * 1. **AppError** – Lỗi nghiệp vụ có thể dự đoán: trả về status code và message tương ứng.
 * 2. **ZodError** – Lỗi validation từ schema Zod: trả về 400 kèm danh sách field lỗi chi tiết.
 * 3. **Lỗi không mong đợi** – Ghi log để debug; ở môi trường development trả về message gốc,
 *    ở production trả về thông báo chung để tránh lộ thông tin nội bộ.
 *
 * @param err - Lỗi được ném ra hoặc truyền vào `next(err)`
 * @param _req - Đối tượng request (không dùng trong handler này)
 * @param res - Đối tượng response dùng để gửi phản hồi lỗi
 * @param _next - Hàm next (bắt buộc có để Express nhận dạng đây là error handler 4 tham số)
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Trường hợp 1: Lỗi nghiệp vụ có kiểu dữ liệu rõ ràng — trả về status và message đã định nghĩa sẵn
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  // Trường hợp 2: Lỗi validation từ Zod — trả về 400 kèm danh sách field lỗi để client hiểu rõ
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    })
  }

  // Trường hợp 3: Lỗi không mong đợi — log ra server để debug
  console.error('[500]', err)
  // Ở môi trường development, trả về message gốc giúp debug nhanh hơn;
  // ở production, ẩn chi tiết lỗi để bảo vệ thông tin nội bộ
  const message = process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'Internal server error'
  return res.status(500).json({ error: message })
}
