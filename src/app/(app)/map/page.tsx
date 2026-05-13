'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Ping, Profile } from '@/lib/types'
import MapView from '@/components/map/MapView'
import PingDetail from '@/components/pings/PingDetail'

interface DraftPing {
  lat: number
  lng: number
  place_name: string
  place_address: string
  place_id: string
}

export default function MapPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [pings, setPings] = useState<Ping[]>([])
  const [selectedPing, setSelectedPing] = useState<Ping | null>(null)
  const [loading, setLoading] = useState(true)

  // Create-ping flow
  const [draft, setDraft] = useState<DraftPing | null>(null)
  const [eventAt, setEventAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUser(profile)

      const { data: pingsData } = await supabase
        .from('pings')
        .select(`*, host:profiles!host_id(*), attendees:ping_attendees(*, profile:profiles!user_id(*))`)
        .order('event_at', { ascending: true })

      if (pingsData) {
        const now = new Date()
        setPings(pingsData.filter((p) => new Date(p.event_at) > now && !p.hidden))
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (selectedPing) return // don't open draft while detail is open
    setCreateError(null)
    setEventAt('')
    // Reverse geocode
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=nl,en`
      )
      const data = await res.json()
      const f = data.features?.[0]
      setDraft({
        lat, lng,
        place_id: f?.id ?? `${lng},${lat}`,
        place_name: f?.text ?? 'Gekozen locatie',
        place_address: f?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      })
    } catch {
      setDraft({ lat, lng, place_id: `${lng},${lat}`, place_name: 'Gekozen locatie', place_address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
    }
  }, [token, selectedPing])

  const handleCreate = async () => {
    if (!draft || !eventAt || !currentUser) return
    setCreating(true)
    setCreateError(null)
    const { error, data } = await supabase.from('pings').insert({
      host_id: currentUser.id,
      place_id: draft.place_id,
      place_name: draft.place_name,
      place_address: draft.place_address,
      lat: draft.lat,
      lng: draft.lng,
      event_at: new Date(eventAt).toISOString(),
      hidden: false,
    }).select(`*, host:profiles!host_id(*), attendees:ping_attendees(*, profile:profiles!user_id(*))`).single()
    setCreating(false)
    if (error) { setCreateError(error.message); return }
    if (data) setPings((prev) => [...prev, data as Ping])
    setDraft(null)
    setEventAt('')
  }

  const handlePingUpdate = (updatedPing: Ping | null) => {
    if (!updatedPing) { setSelectedPing(null); return }
    setPings((prev) => prev.map((p) => (p.id === updatedPing.id ? updatedPing : p)).filter((p) => !p.hidden))
    setSelectedPing(updatedPing.hidden ? null : updatedPing)
  }

  const now = new Date()
  const minDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-60px)]">
      <MapView pings={pings} onPingClick={setSelectedPing} onMapClick={handleMapClick} />

      {/* Hint */}
      {!draft && !selectedPing && pings.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none whitespace-nowrap">
          Tik op de kaart om een ping aan te maken
        </div>
      )}

      {/* Create-ping bottom sheet */}
      {draft && !selectedPing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setDraft(null)} />
          <div className="fixed bottom-[60px] left-0 right-0 z-30 animate-slide-up">
            <div className="bg-white rounded-t-3xl shadow-2xl px-5 pt-4 pb-8">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{draft.place_name}</h2>
                  {draft.place_address && (
                    <p className="text-xs text-gray-500 mt-0.5">{draft.place_address}</p>
                  )}
                </div>
                <button onClick={() => setDraft(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-3 flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1.5">Datum &amp; tijd</label>
              <input
                type="datetime-local"
                min={minDatetime}
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              />

              {createError && <p className="text-xs text-red-500 mb-3">{createError}</p>}

              <button
                onClick={handleCreate}
                disabled={creating || !eventAt}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Ping aanmaken'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Ping detail */}
      {currentUser && (
        <PingDetail
          ping={selectedPing}
          currentUserId={currentUser.id}
          onClose={() => setSelectedPing(null)}
          onUpdate={handlePingUpdate}
        />
      )}
    </div>
  )
}
