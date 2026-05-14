/**
 * Khởi tạo và cấu hình Socket.IO server cho ứng dụng thời gian thực.
 * Xử lý xác thực JWT qua middleware, quản lý các room theo user/gia đình/cuộc trò chuyện,
 * và phát sự kiện typing indicator cho tính năng chat.
 */
import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifyAccessToken } from '../utils/jwt'
import { env } from './env'
import { prisma } from './database'

/** Instance Socket.IO server dùng chung, được khởi tạo bởi `initSocket` */
let io: Server

/**
 * Khởi tạo Socket.IO server gắn vào HTTP server đã có sẵn.
 *
 * Quy trình:
 * 1. Tạo `Server` với cấu hình CORS cho phép origin từ `WEB_URL`.
 * 2. Đăng ký middleware xác thực JWT — từ chối kết nối nếu token không hợp lệ.
 * 3. Khi client kết nối thành công, tự động join các room:
 *    - `user:<userId>` — room riêng của từng người dùng
 *    - `family:<familyId>` — room gia đình (nếu user thuộc gia đình)
 *    - `conversation:<conversationId>` — tất cả cuộc trò chuyện user đang tham gia
 *
 * @param httpServer - HTTP server Node.js sẽ chia sẻ cổng với Socket.IO
 * @returns Instance `Server` của Socket.IO sau khi đã cấu hình đầy đủ
 */
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.WEB_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  /**
   * Middleware xác thực JWT cho mọi kết nối Socket.IO.
   * Token được truyền qua `socket.handshake.auth.token`.
   * Nếu hợp lệ, thông tin user được lưu vào `socket.data` để dùng ở handler.
   */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('No token provided'))
    try {
      const payload = verifyAccessToken(token)
      // Lưu thông tin định danh từ token vào dữ liệu socket để dùng trong các event handler
      socket.data.userId = payload.userId
      socket.data.familyId = payload.familyId
      socket.data.role = payload.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const { userId, familyId } = socket.data as { userId: string; familyId?: string }

    // Join room cá nhân để server có thể gửi thông báo trực tiếp cho user
    socket.join(`user:${userId}`)
    // Join room gia đình nếu user đang thuộc một gia đình
    if (familyId) socket.join(`family:${familyId}`)

    // Tự động join tất cả các room cuộc trò chuyện mà user đang tham gia
    try {
      const participants = await prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      })
      participants.forEach(({ conversationId }) => {
        socket.join(`conversation:${conversationId}`)
      })
    } catch {
      // Bỏ qua lỗi truy vấn — không chặn kết nối nếu việc auto-join thất bại
    }

    /**
     * Sự kiện `chat:join`: client yêu cầu tham gia một room cuộc trò chuyện cụ thể.
     * Thường được gọi khi người dùng mở màn hình chat.
     */
    socket.on('chat:join', ({ conversationId }: { conversationId: string }) => {
      socket.join(`conversation:${conversationId}`)
    })

    /**
     * Sự kiện `chat:typing`: client thông báo trạng thái đang gõ phím.
     * Phát lại cho tất cả thành viên khác trong cùng cuộc trò chuyện (trừ người gửi).
     */
    socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${conversationId}`).emit('chat:typing', {
        userId,
        conversationId,
        isTyping,
      })
    })

    socket.on('disconnect', () => {
      // Socket.IO tự động dọn dẹp các room khi client ngắt kết nối
    })
  })

  return io
}

/**
 * Lấy instance Socket.IO server đã được khởi tạo.
 * Dùng để phát sự kiện từ bất kỳ nơi nào trong ứng dụng (service, controller, ...).
 *
 * @returns Instance `Server` của Socket.IO
 * @throws {Error} Nếu `initSocket` chưa được gọi trước đó
 */
export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
