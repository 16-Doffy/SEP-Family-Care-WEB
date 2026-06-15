/**
 * Root layout của toàn bộ ứng dụng Next.js.
 * Bao bọc mọi trang bằng font Inter, metadata SEO và các Provider toàn cục.
 */
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

/** Sử dụng font Inter với subset Latin để tối ưu tốc độ tải trang */
const inter = Inter({ subsets: ['latin'] })

/** Metadata mặc định dùng cho SEO và tab trình duyệt */
export const metadata: Metadata = {
  title: 'Family Care – Quản lý gia đình thông minh',
  description: 'Nền tảng SaaS quản lý gia đình: sổ quỹ nội bộ, nhiệm vụ, lịch, vị trí và nhiều hơn nữa.',
}

/**
 * Layout gốc bao bọc toàn bộ cây component.
 * @param children - Nội dung trang được render bên trong
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        {/* Providers cung cấp React Query, Auth, Socket và Toast cho toàn app */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
