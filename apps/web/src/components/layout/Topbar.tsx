'use client'
/**
 * @module Topbar
 * @description Thanh điều hướng trên cùng (header) của ứng dụng.
 *
 * Hiển thị:
 * - Tiêu đề trang hiện tại.
 * - Nút SOS nhanh (chỉ hiện khi người dùng đã tham gia gia đình).
 * - Nút chuông thông báo với badge số lượng chưa đọc.
 * - Dialog danh sách thông báo (tự động đánh dấu đã đọc khi mở).
 *
 * Thông báo mới được nhận real-time qua sự kiện `notification:new` của Socket.IO.
 */

import { Bell, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import toast from 'react-hot-toast'

/**
 * Kiểu dữ liệu thông báo trả về từ API `/notifications`.
 */
interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

/**
 * Component Topbar - thanh điều hướng cố định trên cùng màn hình.
 *
 * @param title - Tiêu đề hiển thị bên trái thanh, mặc định là `'Family Care'`
 */
export function Topbar({ title }: { title?: string }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  /** Trạng thái đang gửi SOS để vô hiệu hoá nút tránh gửi trùng */
  const [sosSending, setSosSending] = useState(false)
  const socket = useSocket()
  const { user } = useAuth()

  /**
   * Lấy danh sách thông báo và số lượng chưa đọc từ API.
   * Chỉ chạy khi người dùng đã đăng nhập.
   */
  const fetchNotifications = async () => {
    if (!user) return
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }

  // Tải thông báo lần đầu khi người dùng đăng nhập
  useEffect(() => {
    fetchNotifications()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Lắng nghe sự kiện thông báo mới từ socket để cập nhật real-time
  useEffect(() => {
    if (!socket) return
    socket.on('notification:new', ({ notification, unreadCount: count }: { notification: Notification; unreadCount: number }) => {
      // Thêm thông báo mới vào đầu danh sách và cập nhật badge
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount(count)
    })
    return () => { socket.off('notification:new') }
  }, [socket])

  /**
   * Mở dialog thông báo và đánh dấu tất cả là đã đọc nếu có thông báo chưa đọc.
   */
  const handleOpen = async () => {
    setOpen(true)
    if (unreadCount > 0) {
      try {
        await api.patch('/notifications/read-all')
        // Cập nhật state cục bộ ngay lập tức mà không cần refetch
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      } catch {}
    }
  }

  /**
   * Gửi tín hiệu SOS khẩn cấp đến tất cả thành viên gia đình.
   * Yêu cầu người dùng xác nhận trước khi gửi.
   */
  const handleSOS = async () => {
    if (!user?.familyMember) {
      toast.error('Bạn cần tham gia gia đình để dùng SOS')
      return
    }
    if (!confirm('Gửi tín hiệu SOS khẩn cấp đến tất cả thành viên gia đình?')) return
    setSosSending(true)
    try {
      await api.post('/sos', {})
      toast.success('Đã gửi SOS đến gia đình!')
    } catch {
      toast.error('Gửi SOS thất bại')
    } finally {
      setSosSending(false)
    }
  }

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-gray-900">{title ?? 'Family Care'}</h1>
      <div className="flex items-center gap-2">
        {/* Nút SOS nhanh - chỉ hiện với thành viên đã tham gia gia đình */}
        {user?.familyMember && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSOS}
            disabled={sosSending}
            title="Gửi SOS khẩn cấp"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Siren className="w-5 h-5" />
          </Button>
        )}
        {/* Nút chuông thông báo với badge số lượng chưa đọc (tối đa hiển thị "9+") */}
        <Button variant="ghost" size="icon" className="relative" onClick={handleOpen}>
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Dialog danh sách thông báo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thông báo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Không có thông báo</p>
            ) : (
              notifications.map((n) => (
                // Thông báo chưa đọc có nền xanh để phân biệt với đã đọc
                <div key={n.id} className={`p-3 rounded-lg border ${n.isRead ? 'bg-white' : 'bg-blue-50 border-blue-200'}`}>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
