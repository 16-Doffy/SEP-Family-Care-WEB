'use client'
/**
 * Wearable/GPS Device page — bổ sung scope Review 1.
 * Cho phép Family Manager pair thiết bị, ghi nhận vị trí demo, kích hoạt SOS từ wearable,
 * xem lịch sử lộ trình và phân tích thói quen di chuyển.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, Battery, Bluetooth, Clock, Loader2, MapPin, Plus, Radar, Route, ShieldAlert, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FamilyMemberOption {
  id: string
  userId: string
  nickname?: string | null
  user: { id: string; displayName: string; email: string; role: string }
}

interface Device {
  id: string
  name: string
  type: 'MOBILE_APP' | 'SMARTWATCH' | 'GPS_TRACKER' | 'BLE_DEVICE'
  deviceCode: string
  status: 'PAIRED' | 'ACTIVE' | 'LOST' | 'DISABLED'
  batteryLevel?: number | null
  lastLatitude?: number | null
  lastLongitude?: number | null
  lastSeenAt?: string | null
  sosEnabled: boolean
  fallDetectionEnabled: boolean
  locationTrackingEnabled: boolean
  owner?: { id: string; displayName: string; email: string } | null
  _count?: { routePoints: number; sosAlerts: number }
}

interface RoutePoint {
  id: string
  latitude: number
  longitude: number
  accuracy?: number | null
  speed?: number | null
  source: string
  recordedAt: string
}

interface HabitAnalysis {
  days: number
  totalPoints: number
  activeHours: string[]
  firstRecordedAt?: string | null
  lastRecordedAt?: string | null
  summary: string
}

const deviceTypeLabel: Record<Device['type'], string> = {
  MOBILE_APP: 'Mobile App',
  SMARTWATCH: 'Smartwatch',
  GPS_TRACKER: 'GPS Tracker',
  BLE_DEVICE: 'BLE Device',
}

export default function DevicesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isManager = user?.role === 'PARENT' || user?.role === 'SUPER_ADMIN'

  const [name, setName] = useState('Đồng hồ SOS của bé')
  const [type, setType] = useState<Device['type']>('SMARTWATCH')
  const [deviceCode, setDeviceCode] = useState(() => `FC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
  const [ownerUserId, setOwnerUserId] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const { data: familyData } = useQuery<{ members: FamilyMemberOption[] }>({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: deviceData, isLoading } = useQuery<{ devices: Device[] }>({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices').then((r) => r.data),
    enabled: !!user?.familyMember,
  })
  const devices = deviceData?.devices ?? []
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? devices[0]

  const { data: routeData } = useQuery<{ points: RoutePoint[] }>({
    queryKey: ['device-routes', selectedDevice?.id],
    queryFn: () => api.get(`/devices/${selectedDevice!.id}/routes`, { params: { limit: 20 } }).then((r) => r.data),
    enabled: !!selectedDevice?.id,
  })

  const { data: habitData } = useQuery<{ analysis: HabitAnalysis }>({
    queryKey: ['device-habit', selectedDevice?.id],
    queryFn: () => api.get(`/devices/${selectedDevice!.id}/habit-analysis`, { params: { days: 7 } }).then((r) => r.data),
    enabled: !!selectedDevice?.id,
  })

  const pairMut = useMutation({
    mutationFn: () => api.post('/devices', { name, type, deviceCode, ownerUserId: ownerUserId || null }),
    onSuccess: ({ data }) => {
      toast.success('Đã pair thiết bị')
      qc.invalidateQueries({ queryKey: ['devices'] })
      setSelectedDeviceId(data.device.id)
      setDeviceCode(`FC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
    },
    onError: () => toast.error('Pair thiết bị thất bại'),
  })

  const routeMut = useMutation({
    mutationFn: (deviceId: string) => {
      const baseLat = 10.841 + Math.random() * 0.02
      const baseLng = 106.809 + Math.random() * 0.02
      return api.post(`/devices/${deviceId}/location`, {
        latitude: Number(baseLat.toFixed(6)),
        longitude: Number(baseLng.toFixed(6)),
        accuracy: Math.round(8 + Math.random() * 20),
        speed: Number((Math.random() * 2.4).toFixed(1)),
        source: type === 'GPS_TRACKER' ? 'GPS_DEVICE' : 'WEARABLE',
        batteryLevel: Math.round(35 + Math.random() * 60),
      })
    },
    onSuccess: () => {
      toast.success('Đã ghi nhận điểm lộ trình demo')
      qc.invalidateQueries({ queryKey: ['devices'] })
      qc.invalidateQueries({ queryKey: ['device-routes'] })
      qc.invalidateQueries({ queryKey: ['device-habit'] })
    },
    onError: () => toast.error('Không ghi nhận được vị trí'),
  })

  const sosMut = useMutation({
    mutationFn: (deviceId: string) => api.post(`/devices/${deviceId}/sos`, {
      latitude: selectedDevice?.lastLatitude ?? 10.841,
      longitude: selectedDevice?.lastLongitude ?? 106.809,
      fallDetected: true,
      message: 'SOS/Fall detection signal from wearable demo',
    }),
    onSuccess: () => {
      toast.success('Đã kích hoạt SOS từ thiết bị')
      qc.invalidateQueries({ queryKey: ['devices'] })
      qc.invalidateQueries({ queryKey: ['sos'] })
    },
    onError: () => toast.error('Không kích hoạt được SOS'),
  })

  const members = familyData?.members ?? []
  const routePoints = routeData?.points ?? []
  const analysis = habitData?.analysis

  const statusColor = useMemo(() => ({
    PAIRED: 'bg-blue-50 text-blue-700 border-blue-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST: 'bg-amber-50 text-amber-700 border-amber-200',
    DISABLED: 'bg-gray-50 text-gray-700 border-gray-200',
  }), [])

  if (!user?.familyMember) {
    return <div className="flex h-screen flex-col"><Topbar title="Thiết bị & GPS" /><div className="flex-1 flex items-center justify-center text-muted-foreground">Bạn cần tham gia Family Workspace trước.</div></div>
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Topbar title="Wearable / GPS Device" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bluetooth className="w-5 h-5 text-blue-600" />Pair thiết bị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên thiết bị" />
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as Device['type'])}>
                <option value="SMARTWATCH">Smartwatch</option>
                <option value="GPS_TRACKER">GPS Tracker</option>
                <option value="BLE_DEVICE">BLE Device</option>
                <option value="MOBILE_APP">Mobile App</option>
              </select>
              <Input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} placeholder="Device code" />
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
                <option value="">Chưa gán thành viên</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.displayName} · {m.user.email}</option>)}
              </select>
              <Button className="w-full gap-2" disabled={!isManager || pairMut.isPending || !name.trim() || !deviceCode.trim()} onClick={() => pairMut.mutate()}>
                {pairMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Pair Device
              </Button>
              {!isManager && <p className="text-xs text-amber-600">Chỉ Family Manager mới được pair/cấu hình thiết bị.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Radar className="w-5 h-5 text-emerald-600" />Danh sách thiết bị</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : devices.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có thiết bị. Hãy pair smartwatch/GPS tracker để demo SOS và route tracking.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {devices.map((d) => (
                    <button key={d.id} onClick={() => setSelectedDeviceId(d.id)} className={`rounded-xl border bg-white p-4 text-left hover:shadow-sm ${selectedDevice?.id === d.id ? 'ring-2 ring-blue-500' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{deviceTypeLabel[d.type]} · {d.deviceCode}</p>
                        </div>
                        <Badge variant="outline" className={statusColor[d.status]}>{d.status}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" />{d.owner?.displayName ?? 'Chưa gán'}</span>
                        <span className="flex items-center gap-1"><Battery className="w-3 h-3" />{d.batteryLevel ?? '--'}%</span>
                        <span className="flex items-center gap-1"><Route className="w-3 h-3" />{d._count?.routePoints ?? 0} điểm</span>
                        <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{d._count?.sosAlerts ?? 0} SOS</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedDevice && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-red-500" />Lộ trình gần đây: {selectedDevice.name}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => routeMut.mutate(selectedDevice.id)} disabled={routeMut.isPending}>
                      {routeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 mr-1" />}Ghi điểm demo
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => sosMut.mutate(selectedDevice.id)} disabled={sosMut.isPending}>
                      {sosMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-1" />}SOS wearable
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-xl border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-muted-foreground">
                      <tr><th className="p-3 text-left">Thời gian</th><th className="p-3 text-left">Tọa độ</th><th className="p-3 text-left">Nguồn</th><th className="p-3 text-left">Accuracy</th></tr>
                    </thead>
                    <tbody>
                      {routePoints.length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Chưa có lộ trình. Bấm “Ghi điểm demo”.</td></tr>
                      ) : routePoints.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-3"><Clock className="inline w-3 h-3 mr-1 text-muted-foreground" />{new Date(p.recordedAt).toLocaleString('vi-VN')}</td>
                          <td className="p-3 font-mono text-xs">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</td>
                          <td className="p-3">{p.source}</td>
                          <td className="p-3">{p.accuracy ? `±${Math.round(p.accuracy)}m` : '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Phân tích thói quen di chuyển</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-xl bg-blue-50 p-4 text-blue-900">
                  <p className="font-medium mb-1">AI/Habit summary</p>
                  <p className="text-sm">{analysis?.summary ?? 'Chưa có dữ liệu phân tích.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Số điểm</p><p className="text-xl font-bold">{analysis?.totalPoints ?? 0}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Khoảng ngày</p><p className="text-xl font-bold">{analysis?.days ?? 7}</p></div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Khung giờ xuất hiện nhiều</p>
                  <div className="flex flex-wrap gap-2">
                    {(analysis?.activeHours ?? []).length === 0 ? <span className="text-muted-foreground">Chưa đủ dữ liệu</span> : analysis!.activeHours.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Mục này dùng để chứng minh scope: ghi nhận lộ trình, tracking di chuyển, phân tích thói quen từ wearable/GPS.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
