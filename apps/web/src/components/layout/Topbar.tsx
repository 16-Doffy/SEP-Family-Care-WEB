'use client'
/**
 * @module Topbar
 * @description Thanh điều hướng trên cùng (header) của ứng dụng.
 *
 * Hiển thị tiêu đề trang hiện tại và nút back trên mobile (nếu có `backHref`).
 *
 * Lưu ý: chuông thông báo và SOS đã được gỡ vì API team chưa cung cấp các
 * endpoint tương ứng (`/notifications`, `/sos`) cũng như máy chủ realtime.
 */

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Component Topbar - thanh điều hướng cố định trên cùng màn hình.
 *
 * @param title - Tiêu đề hiển thị bên trái thanh, mặc định là `'Family Care'`
 * @param backHref - Nếu có, hiển thị nút back trên mobile dẫn về route này.
 */
export function Topbar({ title, backHref }: { title?: string; backHref?: string }) {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-2 md:px-6 sticky top-0 z-10 gap-2">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {backHref ? (
          <Link href={backHref} className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Quay lại">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        ) : null}
        <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate px-2 md:px-0">{title ?? 'Family Care'}</h1>
      </div>
    </header>
  )
}
