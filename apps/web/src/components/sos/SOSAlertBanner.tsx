'use client'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { AlertTriangle, MapPin, X, MessageSquare, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import toast from 'react-hot-toast'

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

export function SOSAlertBanner() {
  const { user } = useAuth()
  const socket = useSocket()
  const qc = useQueryClient()
  const [activeAlert, setActiveAlert] = useState<SosAlert | null>(null)

  useEffect(() => {
    if (!socket) return

    const handleSOSNew = ({ alert }: { alert: SosAlert }) => {
      // Don't show banner to the sender
      if (alert.senderId === user?.id) return
      setActiveAlert(alert)
      qc.invalidateQueries({ queryKey: ['sos'] })
      // Play browser notification sound via toast
      toast.error(`🆘 ${alert.sender.displayName} cần giúp đỡ ngay!`, {
        duration: 8000,
        style: { background: '#dc2626', color: 'white', fontWeight: 'bold' },
      })
    }

    const handleSOSUpdate = ({ alert }: { alert: SosAlert }) => {
      qc.invalidateQueries({ queryKey: ['sos'] })
      if (activeAlert?.id === alert.id) {
        if (alert.status === 'RESOLVED' || alert.status === 'FALSE_ALARM') {
          setActiveAlert(null)
        } else {
          setActiveAlert(alert)
        }
      }
    }

    socket.on('sos:new', handleSOSNew)
    socket.on('sos:update', handleSOSUpdate)

    return () => {
      socket.off('sos:new', handleSOSNew)
      socket.off('sos:update', handleSOSUpdate)
    }
  }, [socket, user?.id, activeAlert?.id, qc])

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

  if (!activeAlert) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="bg-red-600 text-white rounded-2xl shadow-2xl shadow-red-500/50 max-w-md w-full overflow-hidden animate-in slide-in-from-top duration-300">
        {/* Pulsing header */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-700">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">SOS KHẨN CẤP</span>
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
          <button onClick={() => setActiveAlert(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="font-bold text-base">{activeAlert.sender.displayName} cần giúp đỡ!</p>
            <p className="text-sm text-red-100">
              {new Date(activeAlert.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {activeAlert.message && (
            <p className="text-sm bg-red-700/50 rounded-lg px-3 py-2">"{activeAlert.message}"</p>
          )}

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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAcknowledge}
              className="flex-1 py-2.5 rounded-xl bg-white text-red-700 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Tôi đang đến
            </button>
            <Link href="/chat" className="flex-1">
              <button className="w-full py-2.5 rounded-xl border border-white/40 text-white font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors">
                <MessageSquare className="w-4 h-4" />
                Chat ngay
              </button>
            </Link>
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
