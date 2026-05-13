'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@/lib/supabase/client'

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

interface SelectedPlace {
  place_id: string
  place_name: string
  place_address: string
  lat: number
  lng: number
}

interface MapboxFeature {
  id: string
  place_name: string
  text: string
  center: [number, number]
}

export default function NewPingPage() {
  const router = useRouter()
  const supabase = createClient()
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [eventAt, setEventAt] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [viewState, setViewState] = useState({ longitude: 4.35, latitude: 50.85, zoom: 11 })

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewState(v => ({ ...v, longitude: pos.coords.longitude, latitude: pos.coords.latitude, zoom: 13 })),
      () => {}
    )
  }, [])

  const search = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&limit=5&language=nl,en`
        )
        const data = await res.json()
        setSuggestions(data.features ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [token])

  const selectSuggestion = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center
    const place: SelectedPlace = { place_id: feature.id, place_name: feature.text, place_address: feature.place_name, lat, lng }
    setSelectedPlace(place)
    setQuery(feature.place_name)
    setSuggestions([])
    setViewState(v => ({ ...v, longitude: lng, latitude: lat, zoom: 15 }))
  }

  const handleMapClick = useCallback(async (evt: { lngLat: { lat: number; lng: number } }) => {
    const { lat, lng } = evt.lngLat
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=nl,en`
      )
      const data = await res.json()
      const feature = data.features?.[0]
      const place: SelectedPlace = {
        place_id: feature?.id ?? `${lng},${lat}`,
        place_name: feature?.text ?? 'Gekozen locatie',
        place_address: feature?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      }
      setSelectedPlace(place)
      setQuery(place.place_address)
      setSuggestions([])
    } catch {
      setSelectedPlace({ place_id: `${lng},${lat}`, place_name: 'Gekozen locatie', place_address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng })
    }
  }, [token])

  const now = new Date()
  const minDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const handleSubmit = async () => {
    setServerError(null)
    if (!selectedPlace) { setServerError('Kies een locatie op de kaart.'); return }
    if (!eventAt) { setServerError('Kies een datum en tijd.'); return }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('pings').insert({
      host_id: user.id,
      place_id: selectedPlace.place_id,
      place_name: selectedPlace.place_name,
      place_address: selectedPlace.place_address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      event_at: new Date(eventAt).toISOString(),
      hidden: false,
    })
    setSubmitting(false)
    if (error) { setServerError(error.message); return }
    router.push('/map')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      {/* Map — takes most of the screen */}
      <div className="relative flex-1">
        <Map
          mapboxAccessToken={token}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE}
          onClick={handleMapClick}
          cursor="crosshair"
        >
          {selectedPlace && (
            <Marker longitude={selectedPlace.lng} latitude={selectedPlace.lat} anchor="bottom">
              <div className="w-5 h-5 bg-indigo-500 rounded-full border-2 border-white shadow-lg" />
            </Marker>
          )}
        </Map>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition z-10"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Search bar overlay */}
        <div className="absolute top-4 left-16 right-4 z-10">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Zoek een locatie of klik op de kaart…"
              className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-100"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin block" />
              </span>
            )}
            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-20">
                {suggestions.map((f) => (
                  <li
                    key={f.id}
                    onClick={() => selectSuggestion(f)}
                    className="px-4 py-3 text-sm hover:bg-indigo-50 cursor-pointer flex items-start gap-2 border-b border-gray-50 last:border-0"
                  >
                    <svg className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <div className="font-medium text-gray-800">{f.text}</div>
                      <div className="text-xs text-gray-400 truncate">{f.place_name}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Hint */}
        {!selectedPlace && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none whitespace-nowrap">
            Tik op de kaart of zoek een locatie
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-3">
        {selectedPlace && (
          <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium truncate">{selectedPlace.place_name}</span>
          </div>
        )}

        <input
          type="datetime-local"
          min={minDatetime}
          value={eventAt}
          onChange={(e) => setEventAt(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
        />

        {serverError && (
          <p className="text-xs text-red-500">{serverError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedPlace || !eventAt}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Ping aanmaken'}
        </button>
      </div>
    </div>
  )
}
