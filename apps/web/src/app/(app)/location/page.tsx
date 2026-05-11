'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { MapPin, MapPinOff, Loader2, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import toast from 'react-hot-toast'
import type { MapMarker } from '@/components/location/MapView'

const MapView = dynamic(() => import('@/components/location/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface ShareUser { id: string; displayName: string; avatarUrl?: string | null }
interface Share {
  id: string
  userId: string
  familyId: string
  isSharing: boolean
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  updatedAt: string
  user: ShareUser
}

const UPDATE_INTERVAL_MS = 15_000

export default function LocationPage() {
  const { user } = useAuth()
  const socket = useSocket()
  const qc = useQueryClient()
  const [isSharing, setIsSharing] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const { data: shares = [], isLoading } = useQuery<Share[]>({
    queryKey: ['family-locations'],
    queryFn: () => api.get('/location/family').then((r) => r.data.shares),
    enabled: !!user?.familyMember,
    refetchInterval: 30_000,
  })

  const { data: myShare } = useQuery<Share | null>({
    queryKey: ['my-location-share'],
    queryFn: () => api.get('/location/me').then((r) => r.data.share),
    enabled: !!user?.familyMember,
  })

  useEffect(() => {
    if (myShare?.isSharing) setIsSharing(true)
  }, [myShare])

  // Listen to socket for realtime peer updates
  useEffect(() => {
    if (!socket) return
    const handler = ({ share }: { share: Share }) => {
      qc.setQueryData<Share[]>(['family-locations'], (prev) => {
        const list = prev ?? []
        const filtered = list.filter((s) => s.userId !== share.userId)
        return share.isSharing && share.latitude != null && share.longitude != null
          ? [share, ...filtered]
          : filtered
      })
    }
    socket.on('location:update', handler)
    return () => { socket.off('location:update', handler) }
  }, [socket, qc])

  // Geolocation watcher — runs when sharing is ON
  useEffect(() => {
    if (!isSharing) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị')
      return
    }

    let lastSent = 0
    const pushUpdate = async (pos: GeolocationPosition) => {
      const now = Date.now()
      if (now - lastSent < UPDATE_INTERVAL_MS) return
      lastSent = now
      try {
        await api.post('/location/update', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLastUpdate(new Date())
        setGeoError(null)
      } catch {
        toast.error('Không gửi được vị trí')
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      pushUpdate,
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isSharing])

  const handleToggle = async () => {
    const next = !isSharing
    setToggleLoading(true)
    try {
      if (next) {
        // Ask geolocation permission first; user may decline.
        if (!navigator.geolocation) {
          toast.error('Trình duyệt không hỗ trợ định vị')
          return
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000 })
        })
        await api.post('/location/update', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setIsSharing(true)
        setLastUpdate(new Date())
        toast.success('Đã bật chia sẻ vị trí')
      } else {
        await api.patch('/location/toggle', { isSharing: false })
        setIsSharing(false)
        toast.success('Đã tắt chia sẻ vị trí')
      }
      qc.invalidateQueries({ queryKey: ['family-locations'] })
      qc.invalidateQueries({ queryKey: ['my-location-share'] })
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string }
      if (e.code === 1) toast.error('Bạn đã từ chối quyền truy cập vị trí')
      else toast.error(e.message ?? 'Không thể bật chia sẻ vị trí')
    } finally {
      setToggleLoading(false)
    }
  }

  const markers = useMemo<MapMarker[]>(
    () =>
      shares
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          id: s.userId,
          lat: s.latitude!,
          lng: s.longitude!,
          label: s.user.displayName,
          isMe: s.userId === user?.id,
          updatedAt: s.updatedAt,
        })),
    [shares, user?.id],
  )

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Chia sẻ vị trí" />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-white flex flex-col overflow-y-auto">
          <div className="p-4 border-b">
            <Button
              onClick={handleToggle}
              disabled={toggleLoading}
              className={`w-full gap-2 ${isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {toggleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSharing ? (
                <MapPinOff className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              {isSharing ? 'Dừng chia sẻ' : 'Bật chia sẻ vị trí'}
            </Button>
            {isSharing && lastUpdate && (
              <p className="text-xs text-muted-foreground mt-2">
                Lần cuối: {lastUpdate.toLocaleTimeString('vi-VN')}
              </p>
            )}
            {geoError && <p className="text-xs text-red-600 mt-2">{geoError}</p>}
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <Users className="w-4 h-4" />
              Thành viên đang chia sẻ ({markers.length})
            </div>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
            ) : markers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chưa có ai chia sẻ vị trí
              </p>
            ) : (
              <div className="space-y-2">
                {shares
                  .filter((s) => s.latitude != null && s.longitude != null)
                  .map((s) => (
                    <div key={s.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className={s.userId === user?.id ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                          {getInitials(s.user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.user.displayName}
                          {s.userId === user?.id && <span className="text-xs text-blue-600 ml-1">(Bạn)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleTimeString('vi-VN')}
                          {s.accuracy && ` · ±${Math.round(s.accuracy)}m`}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 p-4 bg-gray-50">
          <div className="h-full w-full rounded-lg overflow-hidden border bg-white">
            <MapView markers={markers} />
          </div>
        </div>
      </div>
    </div>
  )
}
