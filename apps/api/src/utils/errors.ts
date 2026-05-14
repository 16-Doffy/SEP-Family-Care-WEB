/**
 * Định nghĩa lớp lỗi tùy chỉnh và các factory function để tạo lỗi HTTP phổ biến.
 * Giúp chuẩn hóa cách xử lý và trả về lỗi trong toàn bộ ứng dụng.
 */

/**
 * Lớp lỗi tùy chỉnh dùng cho các lỗi HTTP có thể dự đoán trước (4xx, 5xx).
 * Middleware `errorHandler` sẽ bắt instance của class này và trả về response tương ứng.
 */
export class AppError extends Error {
  /**
   * @param statusCode - Mã trạng thái HTTP sẽ được trả về trong response (ví dụ: 400, 401, 404)
   * @param message - Thông điệp lỗi mô tả ngắn gọn nguyên nhân
   */
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
    // Loại bỏ constructor này khỏi stack trace để thông báo lỗi rõ ràng hơn
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Tập hợp các factory function tạo sẵn lỗi HTTP thông dụng.
 * Mỗi hàm trả về một instance `AppError` với status code và message phù hợp.
 *
 * @example
 * throw Errors.NotFound('User')       // 404 – "User not found"
 * throw Errors.BadRequest('Invalid')  // 400 – "Invalid"
 */
export const Errors = {
  /** 401 – Người dùng chưa xác thực hoặc token không hợp lệ */
  Unauthorized: () => new AppError(401, 'Unauthorized'),

  /** 403 – Người dùng đã xác thực nhưng không có quyền truy cập tài nguyên này */
  Forbidden: () => new AppError(403, 'Forbidden'),

  /**
   * 404 – Tài nguyên không tìm thấy
   * @param resource - Tên tài nguyên để hiển thị trong thông báo (mặc định `'Resource'`)
   */
  NotFound: (resource = 'Resource') => new AppError(404, `${resource} not found`),

  /**
   * 409 – Xung đột dữ liệu (ví dụ: email đã tồn tại)
   * @param msg - Thông điệp mô tả xung đột cụ thể
   */
  Conflict: (msg: string) => new AppError(409, msg),

  /**
   * 400 – Dữ liệu đầu vào không hợp lệ
   * @param msg - Thông điệp mô tả lỗi đầu vào
   */
  BadRequest: (msg: string) => new AppError(400, msg),

  /** 400 – Số dư ví không đủ để thực hiện giao dịch */
  InsufficientFunds: () => new AppError(400, 'Insufficient wallet balance'),

  /**
   * 400 – Chuyển đổi trạng thái task không hợp lệ
   * @param from - Trạng thái hiện tại của task
   * @param to - Trạng thái đích muốn chuyển sang
   */
  InvalidTransition: (from: string, to: string) =>
    new AppError(400, `Cannot transition task from ${from} to ${to}`),
}
