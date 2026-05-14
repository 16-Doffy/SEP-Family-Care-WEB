/**
 * Tập hợp tất cả các Provider toàn cục của ứng dụng vào một component duy nhất.
 * Bao gồm: React Query, Auth, Socket.IO và Toast notification.
 */
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import { Toaster } from 'react-hot-toast'

/**
 * Component bao bọc cây ứng dụng với các Provider cần thiết.
 * Thứ tự lồng nhau quan trọng: AuthProvider phải nằm trước SocketProvider
 * vì SocketContext cần thông tin xác thực để kết nối.
 * @param children - Các component con cần được cung cấp context
 */
export function Providers({ children }: { children: ReactNode }) {
  /**
   * Khởi tạo QueryClient trong useState để đảm bảo mỗi phiên người dùng
   * có một instance riêng biệt, tránh chia sẻ cache giữa các request (SSR safety).
   * staleTime 30s: dữ liệu được coi là mới trong 30 giây trước khi refetch.
   * retry: 1 — chỉ thử lại 1 lần khi request thất bại.
   */
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          {children}
          {/* Toast thông báo hiển thị góc trên bên phải màn hình */}
          <Toaster position="top-right" />
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
