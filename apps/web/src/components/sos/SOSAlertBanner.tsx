'use client'
/**
 * @module SOSAlertBanner
 * @description Banner cảnh báo SOS khẩn cấp hiển thị ở đầu màn hình khi
 * có thành viên gia đình gửi tín hiệu SOS.
 *
 * Lắng nghe hai sự kiện socket:
 * - `sos:new`: Nhận cảnh báo SOS mới. Hiển thị banner và toast thông báo âm thanh.
 *   Bỏ qua nếu người gửi chính là người dùng hiện tại.
 * - `sos:update`: Cập nhật trạng thái SOS. Ẩn banner nếu trạng thái
 *   là `RESOLVED` hoặc `FALSE_ALARM`.
 *
 * Người nhận có thể:
 * - Xác nhận đang đến hỗ trợ (ACKNOWLEDGED).
 * - Mở chat gia đình để liên lạc nhanh.
 * - Xem vị trí SOS trên Google Maps (nếu có toạ độ GPS).
 */

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { AlertTriangle, MapPin, X, MessageSquare, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import toast from 'react-hot-toast'

/**
 * Dữ liệu tín hiệu SOS nhận từ server qua socket.
 * @property senderId - ID người gửi (dùng để loại trừ hiển thị cho chính người gửi)
 * @property latitude/longitude - Toạ độ GPS kèm theo (có thể null)
 * @property address - Địa chỉ được geocode từ toạ độ (có thể null)
 * @property status - Trạng thái hiện tại: `'PENDING'`, `'ACKNOWLEDGED'`, `'RESOLVED'`, `'FALSE_ALARM'`
 */
interface SosAlert {
  id: string
  senderId: string
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  message?: string | null
  status: string
  createdAt: string
  sender: { id: string; displayName: string }
}

/**
 * Component banner cảnh báo SOS - hiển thị ở đỉnh màn hình theo kiểu overlay.
 * Không render gì nếu không có cảnh báo SOS đang hoạt động.
 */
export function SOSAlertBanner() {
  const { user } = useAuth()
  const socket = useSocket()
  const qc = useQueryClient()
  /** Cảnh báo SOS đang được hiển thị; `null` khi không có cảnh báo */
  const [activeAlert, setActiveAlert] = useState<SosAlert | null>(null)

  useEffect(() => {
    if (!socket) return

    /**
     * Xử lý sự kiện SOS mới từ socket.
     * Không hiển thị banner cho người gửi (họ đã biết mình gửi rồi).
     */
    const handleSOSNew = ({ alert }: { alert: SosAlert }) => {
      // Bỏ qua nếu chính người dùng này là người gửi SOS
      if (alert.senderId === user?.id) return
      setActiveAlert(alert)
      qc.invalidateQueries({ queryKey: ['sos'] })
      // Toast đỏ mô phỏng cảnh báo âm thanh trình duyệt
      toast.error(`🆘 ${alert.sender.displayName} cần giúp đỡ ngay!`, {
        duration: 8000,
        style: { background: '#dc2626', color: 'white', fontWeight: 'bold' },
      })
    }

    /**
     * Xử lý sự kiện cập nhật trạng thái SOS.
     * Ẩn banner khi SOS đã được giải quyết hoặc xác nhận là báo động giả.
     */
    const handleSOSUpdate = ({ alert }: { alert: SosAlert }) => {
      qc.invalidateQueries({ queryKey: ['sos'] })
      if (activeAlert?.id === alert.id) {
        if (alert.status === 'RESOLVED' || alert.status === 'FALSE_ALARM') {
          // SOS đã kết thúc: ẩn banner
          setActiveAlert(null)
        } else {
          // Cập nhật thông tin mới nhất của alert đang hiển thị
          setActiveAlert(alert)
        }
      }
    }

    socket.on('sos:new', handleSOSNew)
    socket.on('sos:update', handleSOSUpdate)

    // Cleanup: hủy đăng ký sự kiện khi dependencies thay đổi hoặc component unmount
    return () => {
      socket.off('sos:new', handleSOSNew)
      socket.off('sos:update', handleSOSUpdate)
    }
  }, [socket, user?.id, activeAlert?.id, qc])

  /**
   * Xác nhận đang đến hỗ trợ người gửi SOS.
   * Cập nhật trạng thái SOS thành `ACKNOWLEDGED` trên server.
   */
  const handleAcknowledge = async () => {
    if (!activeAlert) return
    try {
      await api.patch(`/sos/${activeAlert.id}`, { status: 'ACKNOWLEDGED' })
      qc.invalidateQueries({ queryKey: ['sos'] })
      toast.success('Đã xác nhận đang đến hỗ trợ')
    } catch {
      toast.error('Thao tác thất bại')
    }
  }

  // Không render gì nếu không có cảnh báo đang hoạt động
  if (!activeAlert) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="bg-red-600 text-white rounded-2xl shadow-2xl shadow-red-500/50 max-w-md w-full overflow-hidden animate-in slide-in-from-top duration-300">
        {/* Header với hiệu ứng ping để tạo cảm giác khẩn cấp */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-700">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">SOS KHẨN CẤP</span>
            {/* Chấm trắng nhấp nháy biểu thị đang phát sóng */}
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
          {/* Nút đóng - ẩn banner nhưng không giải quyết SOS */}
          <button onClick={() => setActiveAlert(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Thông tin người gửi và thời gian */}
          <div>
            <p className="font-bold text-base">{activeAlert.sender.displayName} cần giúp đỡ!</p>
            <p className="text-sm text-red-100">
              {new Date(activeAlert.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Tin nhắn tuỳ chọn kèm theo SOS */}
          {activeAlert.message && (
            <p className="text-sm bg-red-700/50 rounded-lg px-3 py-2">"{activeAlert.message}"</p>
          )}

          {/* Vị trí GPS: hiển thị địa chỉ (nếu có) hoặc toạ độ số */}
          {(activeAlert.latitude || activeAlert.address) && (
            <a
              href={activeAlert.latitude ? `https://maps.google.com/?q=${activeAlert.latitude},${activeAlert.longitude}` : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-red-100 hover:text-white"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="underline underline-offset-2">
                {activeAlert.address ?? `${activeAlert.latitude?.toFixed(5)}, ${activeAlert.longitude?.toFixed(5)}`}
              </span>
            </a>
          )}

          {/* Các hành động phản hồi */}
          <div className="flex gap-2 pt-1">
            {/* Xác nhận đang đến */}
            <button
              onClick={handleAcknowledge}
              className="flex-1 py-2.5 rounded-xl bg-white text-red-700 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Tôi đang đến
            </button>
            {/* Chuyển sang trang chat gia đình */}
            <Link href="/chat" className="flex-1">
              <button className="w-full py-2.5 rounded-xl border border-white/40 text-white font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors">
                <MessageSquare className="w-4 h-4" />
                Chat ngay
              </button>
            </Link>
            {/* Nút xem bản đồ (chỉ hiện khi có toạ độ) */}
            {activeAlert.latitude && (
              <a
                href={`https://maps.google.com/?q=${activeAlert.latitude},${activeAlert.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl border border-white/40 text-white hover:bg-red-700 transition-colors"
                title="Xem bản đồ"
              >
                <MapPin className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
