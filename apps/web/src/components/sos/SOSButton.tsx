'use client'
/**
 * @module SOSButton
 * @description Nút SOS khẩn cấp dạng nổi (floating action button) ở góc dưới bên phải màn hình.
 *
 * Luồng hoạt động:
 * 1. Người dùng nhấn nút -> hiện dialog xác nhận.
 * 2. Người dùng xác nhận -> thử lấy vị trí GPS hiện tại (timeout 5 giây).
 * 3. Gửi tín hiệu SOS kèm toạ độ GPS (nếu có) hoặc không có toạ độ (nếu GPS thất bại).
 * 4. Toàn bộ thành viên gia đình nhận thông báo real-time qua socket.
 *
 * Component chỉ render khi người dùng đã tham gia gia đình (`user.familyMember` tồn tại).
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Component nút SOS - chỉ hiển thị với thành viên đã tham gia gia đình.
 * Hiển thị nút tròn nổi với hiệu ứng ping liên tục để thu hút sự chú ý.
 */
export function SOSButton() {
  const { user } = useAuth()
  const qc = useQueryClient()
  /** Trạng thái hiển thị dialog xác nhận trước khi gửi SOS */
  const [showConfirm, setShowConfirm] = useState(false)
  /** Trạng thái đang chờ API định vị GPS trả kết quả */
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  /** Mutation gửi tín hiệu SOS lên server */
  const sosMut = useMutation({
    mutationFn: (data: { latitude?: number; longitude?: number; message?: string }) =>
      api.post('/sos', data),
    onSuccess: () => {
      toast.success('🆘 SOS đã gửi đến gia đình!', { duration: 5000 })
      // Làm mới danh sách SOS để cập nhật giao diện quản lý SOS
      qc.invalidateQueries({ queryKey: ['sos'] })
      setShowConfirm(false)
    },
    onError: () => toast.error('Gửi SOS thất bại, thử lại!'),
  })

  // Không render gì nếu người dùng chưa tham gia gia đình
  if (!user?.familyMember) return null

  /**
   * Xử lý gửi SOS:
   * Cố gắng lấy vị trí GPS trước; nếu thất bại (người dùng từ chối
   * hoặc timeout), vẫn gửi SOS nhưng không kèm toạ độ.
   */
  const handleSOS = async () => {
    setIsGettingLocation(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
      )
      sosMut.mutate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
    } catch {
      // Gửi SOS không có vị trí nếu Geolocation API thất bại
      sosMut.mutate({})
    } finally {
      setIsGettingLocation(false)
    }
  }

  /** `true` khi đang lấy GPS hoặc đang chờ API SOS phản hồi */
  const isLoading = isGettingLocation || sosMut.isPending

  return (
    <>
      {/* Nút SOS nổi - hiệu ứng ping để nổi bật */}
      <button
        onClick={() => setShowConfirm(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg shadow-red-500/40 flex items-center justify-center transition-all"
        style={{ animation: 'sos-pulse 2s ease-in-out infinite' }}
        aria-label="Gửi SOS khẩn cấp"
      >
        {/* Hiệu ứng sóng lan toả quanh nút */}
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        <AlertTriangle className="w-7 h-7 relative z-10" />
      </button>

      {/* Dialog xác nhận trước khi gửi SOS */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header đỏ nổi bật */}
            <div className="bg-red-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <AlertTriangle className="w-5 h-5" />
                  SOS Khẩn cấp
                </div>
                <button onClick={() => setShowConfirm(false)} className="opacity-80 hover:opacity-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-red-100">Xác nhận gửi cảnh báo khẩn cấp cho toàn bộ gia đình?</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Thông tin người dùng cần biết trước khi gửi */}
              <div className="text-sm text-gray-600 space-y-1.5">
                <p>• Tất cả thành viên sẽ nhận thông báo ngay lập tức</p>
                <p>• Vị trí GPS của bạn sẽ được chia sẻ (nếu cho phép)</p>
                <p>• Chỉ dùng khi thực sự cần giúp đỡ khẩn cấp</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                  disabled={isLoading}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSOS}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                  ) : (
                    <><AlertTriangle className="w-4 h-4" /> Gửi SOS ngay</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
