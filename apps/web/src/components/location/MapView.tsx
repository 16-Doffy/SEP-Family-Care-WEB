'use client'
/**
 * @module MapView
 * @description Component bản đồ tương tác sử dụng Leaflet và OpenStreetMap
 * để hiển thị vị trí của các thành viên trong gia đình.
 *
 * Bao gồm:
 * - `MapView`: Component bản đồ chính nhận danh sách marker và tự động điều chỉnh
 *   góc nhìn để hiển thị tất cả các vị trí.
 * - `FitBounds`: Component con (nội bộ) dùng hook `useMap` để điều khiển camera.
 * - `makeColoredIcon`: Tạo icon SVG tuỳ chỉnh theo màu sắc cho từng loại marker.
 *
 * Lưu ý: Phải được load động (dynamic import với `ssr: false`) do Leaflet
 * yêu cầu môi trường trình duyệt và không tương thích với SSR của Next.js.
 */

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Sửa lỗi icon mặc định của Leaflet trong môi trường Webpack/Next.js.
 * Leaflet dùng `_getIconUrl` để tự động resolve đường dẫn ảnh, nhưng
 * Webpack loại bỏ nó khi bundle. Giải pháp: xóa method này và chỉ định URL tuyệt đối.
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/**
 * Dữ liệu của một marker trên bản đồ.
 * @property id - Định danh duy nhất (thường là userId hoặc memberId)
 * @property lat - Vĩ độ
 * @property lng - Kinh độ
 * @property label - Tên hiển thị trong popup
 * @property isMe - Nếu `true`, marker sẽ hiển thị màu xanh dương thay vì xanh lá
 * @property updatedAt - Thời điểm cập nhật vị trí cuối cùng (ISO string)
 */
export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  isMe?: boolean
  updatedAt?: string
}

/**
 * Component nội bộ dùng hook `useMap` của react-leaflet để điều chỉnh
 * góc nhìn bản đồ sao cho vừa khít với tất cả marker.
 *
 * - 0 marker: không làm gì.
 * - 1 marker: zoom vào vị trí đó ở mức 15.
 * - Nhiều marker: dùng `fitBounds` với padding để tất cả đều hiển thị.
 *
 * @param markers - Danh sách marker hiện tại trên bản đồ
 */
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15)
      return
    }
    // Tính toán vùng bao quanh tất cả marker và điều chỉnh camera
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [markers, map])
  return null
}

/**
 * Tạo icon marker SVG hình giọt nước với màu tuỳ chỉnh.
 * Icon có hình dạng pin bản đồ cổ điển với vòng tròn trắng ở giữa.
 *
 * @param color - Mã màu hex hoặc tên màu CSS (ví dụ: `'#2563eb'`)
 * @returns Đối tượng `L.DivIcon` có thể dùng làm icon cho Leaflet Marker
 */
function makeColoredIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.2 24.8 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: 'custom-pin',
    iconSize: [32, 42],
    /** Điểm neo ở đáy icon (điểm chạm đất) */
    iconAnchor: [16, 42],
    /** Popup xuất hiện phía trên icon */
    popupAnchor: [0, -42],
  })
}

/** Icon màu xanh dương dành cho người dùng hiện tại */
const ME_ICON = makeColoredIcon('#2563eb')
/** Icon màu xanh lá dành cho các thành viên gia đình khác */
const OTHER_ICON = makeColoredIcon('#16a34a')

/**
 * Component bản đồ chính - hiển thị vị trí các thành viên gia đình.
 *
 * @param markers - Danh sách vị trí cần hiển thị trên bản đồ
 * @param center - Toạ độ tâm ban đầu của bản đồ; nếu không cung cấp, dùng
 *                 vị trí marker đầu tiên hoặc Hà Nội làm mặc định
 */
export function MapView({ markers, center }: { markers: MapMarker[]; center?: [number, number] }) {
  // Thứ tự ưu tiên tâm bản đồ: prop center > marker đầu tiên > Hà Nội
  const fallback: [number, number] = center ?? (markers[0] ? [markers[0].lat, markers[0].lng] : [21.0285, 105.8542])

  return (
    <MapContainer center={fallback} zoom={13} className="h-full w-full rounded-lg z-0" scrollWheelZoom>
      {/* Tile layer OpenStreetMap miễn phí */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Tự động điều chỉnh camera để hiển thị tất cả marker */}
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={m.isMe ? ME_ICON : OTHER_ICON}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{m.label}{m.isMe ? ' (Bạn)' : ''}</p>
              {m.updatedAt && (
                <p className="text-xs text-gray-500">Cập nhật: {new Date(m.updatedAt).toLocaleTimeString('vi-VN')}</p>
              )}
              <a
                href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=17/${m.lat}/${m.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline text-xs"
              >
                Xem trên OpenStreetMap
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export default MapView
