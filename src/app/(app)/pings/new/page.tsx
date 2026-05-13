'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Map, { Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@/lib/supabase/client'

const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'

const pingSchema = z.object({
  event_at: z.string().min(1, 'Please pick a date and time'),
})

type PingFormData = z.infer<typeof pingSchema>

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

function PlacesSearch({
  onSelect,
  selected,
}: {
  onSelect: (place: SelectedPlace) => void
  selected: SelectedPlace | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MapboxFeature[]>([])
  const [loading, setLoading] = useState(false)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const search = useCallback(
    async (value: string) => {
      setQuery(value)
      if (!value.trim() || !token) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&limit=5&language=nl,en`
        )
        const data = await res.json()
        setResults(data.features ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const handleSelect = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center
    onSelect({
      place_id: feature.id,
      place_name: feature.text,
      place_address: feature.place_name,
      lat,
      lng,
    })
    setQuery(feature.place_name)
    setResults([])
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Locatie</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Zoek een locatie…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin block" />
          </span>
        )}
      </div>

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((feature) => (
            <li
              key={feature.id}
              onClick={() => handleSelect(feature)}
              className="px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition flex items-start gap-2 border-b border-gray-50 last:border-0"
            >
              <svg className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="font-medium">{feature.text}</div>
                <div className="text-xs text-gray-400 truncate">{feature.place_name}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && results.length === 0 && (
        <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium truncate">{selected.place_name}</span>
        </div>
      )}
    </div>
  )
}

export default function NewPingPage() {
  const router = useRouter()
  const supabase = createClient()
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PingFormData>({
    resolver: zodResolver(pingSchema),
  })

  const onSubmit = async (data: PingFormData) => {
    setServerError(null)

    if (!selectedPlace) {
      setServerError('Kies een locatie.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('pings').insert({
      host_id: user.id,
      place_id: selectedPlace.place_id,
      place_name: selectedPlace.place_name,
      place_address: selectedPlace.place_address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      event_at: new Date(data.event_at).toISOString(),
      hidden: false,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    router.push('/map')
    router.refresh()
  }

  const now = new Date()
  const minDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
          aria-label="Go back"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nieuwe ping</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
          <PlacesSearch onSelect={setSelectedPlace} selected={selectedPlace} />
        </div>

        {selectedPlace && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '200px' }}>
            <Map
              mapboxAccessToken={token}
              initialViewState={{ longitude: selectedPlace.lng, latitude: selectedPlace.lat, zoom: 15 }}
              style={{ width: '100%', height: '100%' }}
              mapStyle={MAP_STYLE}
              interactive={false}
            >
              <Marker longitude={selectedPlace.lng} latitude={selectedPlace.lat}>
                <div className="w-4 h-4 bg-indigo-500 rounded-full border-2 border-white shadow-md" />
              </Marker>
            </Map>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
          <label htmlFor="event_at" className="block text-sm font-medium text-gray-700 mb-1.5">
            Datum &amp; tijd
          </label>
          <input
            id="event_at"
            type="datetime-local"
            min={minDatetime}
            {...register('event_at')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
          />
          {errors.event_at && (
            <p className="mt-1.5 text-xs text-red-500">{errors.event_at.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedPlace}
          className="w-full py-3 px-4 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Ping aanmaken
            </>
          )}
        </button>
      </form>
    </div>
  )
}
