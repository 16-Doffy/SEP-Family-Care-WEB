/**
 * Tải và xác thực các biến môi trường cần thiết cho ứng dụng.
 * Ném lỗi ngay khi khởi động nếu thiếu biến môi trường bắt buộc.
 */
import * as dotenv from 'dotenv'

// Nạp biến môi trường từ file .env vào process.env
dotenv.config()

/**
 * Lấy giá trị của biến môi trường bắt buộc.
 * Ném lỗi ngay lập tức nếu biến chưa được định nghĩa,
 * giúp phát hiện thiếu cấu hình trước khi server khởi động hoàn toàn.
 *
 * @param key - Tên biến môi trường cần lấy
 * @returns Giá trị chuỗi của biến môi trường
 * @throws {Error} Nếu biến môi trường chưa được định nghĩa hoặc rỗng
 */
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

/**
 * Đối tượng cấu hình môi trường dùng chung toàn ứng dụng.
 * Tất cả các giá trị đều được đọc một lần khi module được nạp.
 *
 * - `NODE_ENV`: Môi trường chạy (`development` | `production` | `test`)
 * - `API_PORT`: Cổng lắng nghe của HTTP server (mặc định 4000)
 * - `DATABASE_URL`: Chuỗi kết nối Prisma tới cơ sở dữ liệu (bắt buộc)
 * - `JWT_ACCESS_SECRET`: Khóa bí mật ký access token (bắt buộc)
 * - `JWT_REFRESH_SECRET`: Khóa bí mật ký refresh token (bắt buộc)
 * - `JWT_ACCESS_EXPIRES`: Thời gian hết hạn access token (mặc định `15m`)
 * - `JWT_REFRESH_EXPIRES`: Thời gian hết hạn refresh token (mặc định `7d`)
 * - `WEB_URL`: URL gốc của ứng dụng web (dùng cho CORS)
 * - `OPENAI_API_KEY`: API key của OpenAI (tùy chọn)
 * - `OPENAI_MODEL`: Model OpenAI sẽ sử dụng (mặc định `gpt-4o-mini`)
 * - `STRIPE_SECRET_KEY`: Khóa bí mật Stripe (tùy chọn)
 * - `STRIPE_WEBHOOK_SECRET`: Khóa xác thực webhook Stripe (tùy chọn)
 */
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  API_PORT: parseInt(process.env.API_PORT ?? '4000', 10),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:3000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
} as const
