'use client'

import { useState, useEffect } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { format } from 'date-fns'
import type { Ping } from '@/lib/types'

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

interface MapViewProps {
  pings: Ping[]
  onPingClick: (ping: Ping) => void
  onMapClick?: (lat: number, lng: number) => void
}

function PingMarker({ ping, onClick }: { ping: Ping; onClick: () => void }) {
  const timeStr = format(new Date(ping.event_at), 'HH:mm')
  const hostName = ping.host?.display_name ?? 'Someone'

  return (
    <Marker longitude={ping.lng} latitude={ping.lat} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); onClick() }}>
      <div
        className="flex items-center gap-1.5 bg-white border-2 border-indigo-500 rounded-full px-3 py-1.5 shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all select-none"
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

export default function MapView({ pings, onPingClick, onMapClick }: MapViewProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const [viewState, setViewState] = useState({ longitude: 4.35, latitude: 50.85, zoom: 11 })

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewState(v => ({ ...v, longitude: pos.coords.longitude, latitude: pos.coords.latitude, zoom: 13 })),
      () => {}
    )
  }, [])

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">Stel NEXT_PUBLIC_MAPBOX_TOKEN in</p>
      </div>
    )
  }

  return (
    <Map
      mapboxAccessToken={token}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      cursor={onMapClick ? 'crosshair' : 'grab'}
      onClick={(evt) => onMapClick?.(evt.lngLat.lat, evt.lngLat.lng)}
    >
      <NavigationControl position="top-right" />
      {pings.map((ping) => (
        <PingMarker key={ping.id} ping={ping} onClick={() => onPingClick(ping)} />
      ))}
    </Map>
  )
}
