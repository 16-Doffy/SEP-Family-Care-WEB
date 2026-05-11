'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths (Webpack/Next.js doesn't resolve them correctly)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  isMe?: boolean
  updatedAt?: string
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15)
      return
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [markers, map])
  return null
}

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
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  })
}

const ME_ICON = makeColoredIcon('#2563eb')
const OTHER_ICON = makeColoredIcon('#16a34a')

export function MapView({ markers, center }: { markers: MapMarker[]; center?: [number, number] }) {
  const fallback: [number, number] = center ?? (markers[0] ? [markers[0].lat, markers[0].lng] : [21.0285, 105.8542])

  return (
    <MapContainer center={fallback} zoom={13} className="h-full w-full rounded-lg z-0" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
