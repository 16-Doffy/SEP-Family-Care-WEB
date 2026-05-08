import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family Care – Quản lý gia đình thông minh',
  description: 'Nền tảng SaaS quản lý gia đình: ví tiền, nhiệm vụ, lịch, vị trí và nhiều hơn nữa.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
