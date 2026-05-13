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

const now = () => new Date()
const minDatetime = () => {
  const d = now()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const maxDatetime = () => {
  const d = now()
  d.setMonth(d.getMonth() + 1)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function MapPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [pings, setPings] = useState<Ping[]>([])
  const [selectedPing, setSelectedPing] = useState<Ping | null>(null)
  const [loading, setLoading] = useState(true)

  const [draft, setDraft] = useState<DraftPing | null>(null)
  const [pingName, setPingName] = useState('')
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
        const n = now()
        setPings(pingsData.filter((p) => new Date(p.event_at) > n && !p.hidden))
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (selectedPing) return
    setCreateError(null)
    setEventAt('')
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=nl,en`
      )
      const data = await res.json()
      const f = data.features?.[0]
      const name = f?.text ?? 'Mijn ping'
      setDraft({
        lat, lng,
        place_id: f?.id ?? `${lng},${lat}`,
        place_name: name,
        place_address: f?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      })
      setPingName(name)
    } catch {
      const name = 'Mijn ping'
      setDraft({ lat, lng, place_id: `${lng},${lat}`, place_name: name, place_address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
      setPingName(name)
    }
  }, [token, selectedPing])

  const handleCreate = async () => {
    if (!draft || !currentUser) return
    setCreateError(null)

    if (!pingName.trim()) { setCreateError('Geef je ping een naam.'); return }
    if (!eventAt) { setCreateError('Kies een datum en tijd.'); return }

    const selected = new Date(eventAt)
    const n = now()
    const maxD = now(); maxD.setMonth(maxD.getMonth() + 1)
    if (selected <= n) { setCreateError('Datum moet in de toekomst liggen.'); return }
    if (selected > maxD) { setCreateError('Datum mag niet verder dan 1 maand zijn.'); return }

    setCreating(true)
    const { error, data } = await supabase.from('pings').insert({
      host_id: currentUser.id,
      place_id: draft.place_id,
      place_name: pingName.trim(),
      place_address: draft.place_address,
      lat: draft.lat,
      lng: draft.lng,
      event_at: selected.toISOString(),
      hidden: false,
    }).select(`*, host:profiles!host_id(*), attendees:ping_attendees(*, profile:profiles!user_id(*))`).single()

    setCreating(false)
    if (error) { setCreateError(error.message); return }
    if (data) setPings((prev) => [...prev, data as Ping])
    setDraft(null)
    setPingName('')
    setEventAt('')
  }

  const handlePingUpdate = (updatedPing: Ping | null) => {
    if (!updatedPing) { setSelectedPing(null); return }
    setPings((prev) => prev.map((p) => (p.id === updatedPing.id ? updatedPing : p)).filter((p) => !p.hidden))
    setSelectedPing(updatedPing.hidden ? null : updatedPing)
  }

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
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Naam — aanpasbaar */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Naam</label>
                <input
                  value={pingName}
                  onChange={(e) => setPingName(e.target.value)}
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Adres — read-only */}
              <div className="flex items-start gap-1.5 text-xs text-gray-400 mb-4">
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{draft.place_address}</span>
              </div>

              {/* Datum & tijd */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Datum &amp; tijd</label>
                <input
                  type="datetime-local"
                  min={minDatetime()}
                  max={maxDatetime()}
                  value={eventAt}
                  onChange={(e) => setEventAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {createError && <p className="text-xs text-red-500 mb-3">{createError}</p>}

              <button
                onClick={handleCreate}
                disabled={creating || !eventAt || !pingName.trim()}
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
