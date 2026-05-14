'use client'
/**
 * @module socket
 * @description Quản lý kết nối Socket.IO singleton cho ứng dụng client.
 * Cung cấp hai hàm chính:
 * - `getSocket`: Khởi tạo hoặc tái sử dụng kết nối Socket.IO đã có.
 * - `disconnectSocket`: Ngắt kết nối và giải phóng socket hiện tại.
 *
 * Sử dụng mô hình singleton để đảm bảo chỉ có một kết nối WebSocket
 * tại một thời điểm, tránh lãng phí tài nguyên.
 */

import { io, Socket } from 'socket.io-client'

/** URL của WebSocket server, đọc từ biến môi trường hoặc dùng localhost làm mặc định */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000'

/**
 * Biến module-level lưu trữ socket singleton.
 * `null` khi chưa kết nối hoặc sau khi đã ngắt kết nối.
 */
let socket: Socket | null = null

/**
 * Trả về socket đang kết nối hiện tại, hoặc tạo kết nối mới nếu chưa có.
 * Nếu socket cũ vẫn đang được kết nối, tái sử dụng ngay mà không tạo lại.
 *
 * @param accessToken - JWT access token dùng để xác thực với server qua `auth.token`
 * @returns Instance Socket.IO đã được kết nối (hoặc đang trong quá trình kết nối)
 */
export function getSocket(accessToken: string): Socket {
  // Tái sử dụng socket nếu vẫn còn kết nối, tránh tạo kết nối trùng lặp
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    // Ưu tiên WebSocket, fallback về long-polling nếu WebSocket bị chặn
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  return socket
}

/**
 * Ngắt kết nối socket hiện tại và đặt lại singleton về `null`.
 * Nên gọi khi người dùng đăng xuất hoặc khi component provider bị unmount.
 */
export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
