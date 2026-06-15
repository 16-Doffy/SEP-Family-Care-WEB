'use client'
/**
 * @module SocketContext
 * @description Context quản lý kết nối Socket.IO theo vòng đời của phiên đăng nhập.
 *
 * `SocketProvider` lắng nghe sự thay đổi của `accessToken`:
 * - Khi người dùng đăng nhập (token tồn tại): tạo hoặc tái sử dụng kết nối WebSocket.
 * - Khi người dùng đăng xuất (token là null): ngắt kết nối và dọn dẹp.
 *
 * Hook `useSocket` cho phép các component con đăng ký/huỷ lắng nghe sự kiện real-time.
 * Trả về `null` khi người dùng chưa đăng nhập.
 */

import { createContext, useContext, ReactNode } from 'react'
import type { Socket } from 'socket.io-client'

/**
 * Context lưu instance Socket.IO hiện tại.
 * Giá trị `null` có nghĩa là người dùng chưa đăng nhập hoặc chưa kết nối.
 */
const SocketContext = createContext<Socket | null>(null)

/**
 * Provider Socket - quản lý vòng đời kết nối WebSocket theo trạng thái đăng nhập.
 *
 * Khi `accessToken` thay đổi:
 * - Nếu token là null (đăng xuất): ngắt kết nối socket và đặt state về null.
 * - Nếu có token mới: khởi tạo kết nối socket mới với token xác thực.
 * Cleanup function của `useEffect` đảm bảo socket được ngắt khi component unmount.
 *
 * @param children - Cây component cần truy cập socket
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  // API team hiện chưa có máy chủ WebSocket (Socket.IO), nên không mở kết nối
  // để tránh lỗi "WebSocket connection failed" lặp lại trên console.
  // Provider vẫn tồn tại và cung cấp `null` để `useSocket()` dùng được ở mọi nơi.
  return <SocketContext.Provider value={null}>{children}</SocketContext.Provider>
}

/**
 * Hook truy cập instance Socket.IO hiện tại.
 * Trả về `null` nếu người dùng chưa đăng nhập hoặc socket chưa được khởi tạo.
 * Các component sử dụng hook này nên kiểm tra `null` trước khi đăng ký sự kiện.
 *
 * @returns Instance `Socket` hoặc `null`
 */
export function useSocket() {
  return useContext(SocketContext)
}
