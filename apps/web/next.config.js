/**
 * Origin của API team (backend đã deploy). Đây là biến phía SERVER (không phải
 * NEXT_PUBLIC), chỉ dùng cho rewrite ở tầng server nên không lộ ra bundle trình duyệt.
 * Mặc định trỏ thẳng tới API team để deploy được ngay mà không cần cấu hình env.
 */
const BACKEND_API_ORIGIN = process.env.BACKEND_API_ORIGIN || 'http://103.110.84.66'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  transpilePackages: ['@family-care/shared'],
  /**
   * Proxy same-origin → API team. Trình duyệt gọi `/api/v1/*` (cùng origin, HTTPS khi
   * deploy), Next forward phía server sang backend HTTP → tránh lỗi mixed content mà
   * không cần backend bật HTTPS. App không có route nội bộ nào dưới /api/v1 nên an toàn.
   */
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${BACKEND_API_ORIGIN}/api/v1/:path*` },
    ]
  },
}

module.exports = nextConfig
