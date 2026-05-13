'use client'

import Map, { Marker, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { format } from 'date-fns'
import type { Ping } from '@/lib/types'

interface MapViewProps {
  pings: Ping[]
  onPingClick: (ping: Ping) => void
}

const DEFAULT_CENTER = { longitude: 4.35, latitude: 50.85 }
const DEFAULT_ZOOM = 11
const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'

function PingMarker({ ping, onClick }: { ping: Ping; onClick: () => void }) {
  const timeStr = format(new Date(ping.event_at), 'HH:mm')
  const hostName = ping.host?.display_name ?? 'Someone'

  return (
    <Marker longitude={ping.lng} latitude={ping.lat} anchor="bottom" onClick={onClick}>
      <div className="flex items-center gap-1.5 bg-white border-2 border-indigo-500 rounded-full px-3 py-1.5 shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all select-none"
        style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
      >
        <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="font-semibold text-gray-800">{hostName}</span>
        <span className="text-indigo-500 font-medium">{timeStr}</span>
      </div>
    </Marker>
  )
}

export default function MapView({ pings, onPingClick }: MapViewProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center px-6">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">Mapbox token not configured</p>
          <p className="text-xs text-gray-400 mt-1">Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</p>
        </div>
      </div>
    )
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ ...DEFAULT_CENTER, zoom: DEFAULT_ZOOM }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
      <NavigationControl position="top-right" />
      {pings.map((ping) => (
        <PingMarker key={ping.id} ping={ping} onClick={() => onPingClick(ping)} />
      ))}
    </Map>
  )
}
