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

  return (
    <Marker
      longitude={ping.lng}
      latitude={ping.lat}
      anchor="bottom"
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick() }}
    >
      <div className="flex flex-col items-center cursor-pointer group">
        {/* Pill */}
        <div className="flex items-center gap-1.5 bg-indigo-500 rounded-2xl px-3 py-2 shadow-lg group-hover:bg-indigo-600 transition-colors select-none"
          style={{ whiteSpace: 'nowrap' }}
        >
          <svg className="w-3 h-3 text-indigo-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-white font-semibold text-xs"
            style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {ping.place_name}
          </span>
          <span className="text-indigo-200 text-xs font-medium">{timeStr}</span>
        </div>
        {/* Triangle pointer */}
        <div style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #6366f1',
        }} />
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
      onClick={(evt) => onMapClick?.(evt.lngLat.lat, evt.lngLat.lng)}
    >
      <NavigationControl position="top-right" />
      {pings.map((ping) => (
        <PingMarker key={ping.id} ping={ping} onClick={() => onPingClick(ping)} />
      ))}
    </Map>
  )
}
