'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function SOSButton() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  const sosMut = useMutation({
    mutationFn: (data: { latitude?: number; longitude?: number; message?: string }) =>
      api.post('/sos', data),
    onSuccess: () => {
      toast.success('🆘 SOS đã gửi đến gia đình!', { duration: 5000 })
      qc.invalidateQueries({ queryKey: ['sos'] })
      setShowConfirm(false)
    },
    onError: () => toast.error('Gửi SOS thất bại, thử lại!'),
  })

  if (!user?.familyMember) return null

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
      // Send SOS without location if geolocation fails
      sosMut.mutate({})
    } finally {
      setIsGettingLocation(false)
    }
  }

  const isLoading = isGettingLocation || sosMut.isPending

  return (
    <>
      {/* Floating SOS button */}
      <button
        onClick={() => setShowConfirm(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg shadow-red-500/40 flex items-center justify-center transition-all"
        style={{ animation: 'sos-pulse 2s ease-in-out infinite' }}
        aria-label="Gửi SOS khẩn cấp"
      >
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        <AlertTriangle className="w-7 h-7 relative z-10" />
      </button>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Red header */}
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
