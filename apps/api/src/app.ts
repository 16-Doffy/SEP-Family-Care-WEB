/**
 * Cấu hình và khởi tạo ứng dụng Express cùng HTTP server.
 * Đăng ký middleware bảo mật, CORS, rate limiting, static files, routes API và error handler.
 */
import express from 'express'
import type { Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { createServer, type Server } from 'http'
import { initSocket } from './config/socket'
import { errorHandler } from './middleware/errorHandler'
import { apiRouter } from './routes'
import { env } from './config/env'
import { setIOGetter } from './services/notification.service'

function isAllowedCorsOrigin(origin?: string) {
  if (!origin) return true
  if (origin === env.WEB_URL) return true
  if (env.NODE_ENV === 'production') return false

  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1'].includes(url.hostname)
  } catch {
    return false
  }
}

/**
 * Tạo và cấu hình đầy đủ ứng dụng Express kèm HTTP server.
 *
 * Thứ tự đăng ký middleware:
 * 1. **Helmet** – Thiết lập các HTTP security headers (cho phép cross-origin resource để phục vụ ảnh upload).
 * 2. **CORS** – Chỉ cho phép request từ `WEB_URL` với cookie credentials.
 * 3. **Body parsers** – Hỗ trợ JSON và URL-encoded form data.
 * 4. **Rate limiting** – Giới hạn 30 req/15 phút cho `/api/auth`, 500 req/15 phút cho toàn bộ `/api`.
 * 5. **Static files** – Phục vụ file upload tại đường dẫn `/uploads`.
 * 6. **Health check** – Endpoint `/health` để kiểm tra server còn sống.
 * 7. **API routes** – Toàn bộ route nghiệp vụ được mount tại `/api`.
 * 8. **Error handler** – Xử lý lỗi tập trung (phải đăng ký cuối cùng).
 *
 * @returns Đối tượng chứa `app` (Express application) và `httpServer` (Node.js HTTP server)
 */
export function createApp(): { app: Express; httpServer: Server } {
  const app = express()
  // Tạo HTTP server bọc ngoài Express app để Socket.IO có thể chia sẻ cùng cổng
  const httpServer = createServer(app)

  // Khởi tạo Socket.IO và đăng ký getter cho notification service
  const io = initSocket(httpServer)
  setIOGetter(() => io)

  // Bảo mật HTTP headers; cho phép cross-origin resource để ảnh upload có thể hiển thị trên web
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

  // Chỉ chấp nhận request từ frontend URL được cấu hình, kèm cookie credentials
  app.use(cors({
    origin: (origin, cb) => cb(null, isAllowedCorsOrigin(origin)),
    credentials: true,
  }))

  // Parse body dạng JSON và URL-encoded (form submit truyền thống)
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Rate limiting chặt cho route xác thực — giảm thiểu tấn công brute-force.
  // Trong development thì nới hẳn limit để dev không bị 429 khi reload nhiều.
  const isDev = env.NODE_ENV !== 'production'
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // Cửa sổ 15 phút
    limit: isDev ? 300 : 30,   // Prod: 30 / 15 phút; Dev: 300 / 15 phút
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // Rate limiting tổng thể cho toàn bộ API — phòng chống lạm dụng
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isDev ? 5000 : 500, // Prod: 500 / 15 phút; Dev: 5000 / 15 phút
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // Phục vụ file tĩnh từ thư mục uploads (ảnh, tài liệu do người dùng tải lên)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  // Endpoint kiểm tra trạng thái server — dùng cho load balancer hoặc monitoring
  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // Mount toàn bộ route nghiệp vụ tại prefix /api
  app.use('/api', apiRouter)

  // Error handler phải đăng ký cuối cùng để bắt lỗi từ tất cả route phía trên
  app.use(errorHandler)

  return { app, httpServer }
}
