'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, MapPin, Phone, Clock, XCircle, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface SosAlert {
  id: string
  senderId: string
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  message?: string | null
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM'
  createdAt: string
  resolvedAt?: string | null
  sender: { id: string; displayName: string; avatarUrl?: string | null }
  resolvedBy?: { id: string; displayName: string } | null
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'Đang khẩn cấp', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500 animate-pulse' },
  ACKNOWLEDGED: { label: 'Đang xử lý', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  RESOLVED: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  FALSE_ALARM: { label: 'Báo động giả', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
}

function StatusBadge({ status }: { status: SosAlert['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.color)}>
      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

export default function SOSPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const { data, isLoading } = useQuery<{ alerts: SosAlert[] }>({
    queryKey: ['sos', filter],
    queryFn: () => api.get(filter === 'active' ? '/sos/active' : '/sos').then((r) => r.data),
    enabled: !!user?.familyMember,
    refetchInterval: 15000,
  })
  const alerts = data?.alerts ?? []

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/sos/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos'] })
      toast.success('Đã cập nhật trạng thái')
    },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  if (!user?.familyMember) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar title="SOS Khẩn cấp" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Bạn cần tham gia gia đình để dùng tính năng này</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="SOS Khẩn cấp" />

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {/* Header info */}
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold mb-0.5">Tính năng SOS khẩn cấp</p>
            <p className="text-red-600">Bấm nút SOS đỏ ở góc màn hình khi cần giúp đỡ. Toàn bộ gia đình sẽ nhận cảnh báo ngay lập tức.</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('active')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', filter === 'active' ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}
          >
            Đang khẩn cấp
          </button>
          <button
            onClick={() => setFilter('all')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', filter === 'all' ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}
          >
            Lịch sử
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <CheckCircle className="w-12 h-12 opacity-30 text-green-500" />
            <p className="text-base font-medium">{filter === 'active' ? 'Không có tình huống khẩn cấp' : 'Chưa có lịch sử SOS'}</p>
            <p className="text-sm">Mọi người đều an toàn!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'bg-white rounded-xl border-2 p-5 space-y-4 shadow-sm',
                  alert.status === 'ACTIVE' ? 'border-red-400' : alert.status === 'ACKNOWLEDGED' ? 'border-orange-300' : 'border-gray-200',
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                      alert.status === 'ACTIVE' ? 'bg-red-500' : alert.status === 'ACKNOWLEDGED' ? 'bg-orange-500' : 'bg-gray-400',
                    )}>
                      {alert.sender.displayName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{alert.sender.displayName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={alert.status} />
                </div>

                {/* Message */}
                {alert.message && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">"{alert.message}"</p>
                )}

                {/* Location */}
                {(alert.latitude || alert.address) && (
                  <a
                    href={alert.latitude ? `https://maps.google.com/?q=${alert.latitude},${alert.longitude}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    {alert.address ?? `${alert.latitude?.toFixed(5)}, ${alert.longitude?.toFixed(5)}`}
                  </a>
                )}

                {/* Resolved by */}
                {alert.resolvedBy && (
                  <p className="text-xs text-muted-foreground">
                    Xử lý bởi {alert.resolvedBy.displayName}
                    {alert.resolvedAt && ` lúc ${new Date(alert.resolvedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                )}

                {/* Actions */}
                {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {alert.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => updateMut.mutate({ id: alert.id, status: 'ACKNOWLEDGED' })}
                        disabled={updateMut.isPending}
                      >
                        Tôi đang đến
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateMut.mutate({ id: alert.id, status: 'RESOLVED' })}
                      disabled={updateMut.isPending}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Đã an toàn
                    </Button>
                    {alert.senderId === user.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 text-gray-500"
                        onClick={() => updateMut.mutate({ id: alert.id, status: 'FALSE_ALARM' })}
                        disabled={updateMut.isPending}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Báo động giả
                      </Button>
                    )}
                    <Link href="/chat">
                      <Button size="sm" variant="outline" className="gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat ngay
                      </Button>
                    </Link>
                    {alert.latitude && (
                      <a
                        href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="outline" className="gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Xem bản đồ
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
