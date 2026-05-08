'use client'
import { Bell, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import toast from 'react-hot-toast'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export function Topbar({ title }: { title?: string }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [sosSending, setSosSending] = useState(false)
  const socket = useSocket()
  const { user } = useAuth()

  const fetchNotifications = async () => {
    if (!user) return
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!socket) return
    socket.on('notification:new', ({ notification, unreadCount: count }: { notification: Notification; unreadCount: number }) => {
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount(count)
    })
    return () => { socket.off('notification:new') }
  }, [socket])

  const handleOpen = async () => {
    setOpen(true)
    if (unreadCount > 0) {
      try {
        await api.patch('/notifications/read-all')
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      } catch {}
    }
  }

  const handleSOS = async () => {
    if (!user?.familyMember) {
      toast.error('Bạn cần tham gia gia đình để dùng SOS')
      return
    }
    if (!confirm('Gửi tín hiệu SOS khẩn cấp đến tất cả thành viên gia đình?')) return
    setSosSending(true)
    try {
      await api.post('/notifications/sos')
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
        <Button variant="ghost" size="icon" className="relative" onClick={handleOpen}>
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

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
