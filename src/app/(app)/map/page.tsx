'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Ping, Profile } from '@/lib/types'
import MapView from '@/components/map/MapView'
import PingDetail from '@/components/pings/PingDetail'

export default function MapPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [pings, setPings] = useState<Ping[]>([])
  const [selectedPing, setSelectedPing] = useState<Ping | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setCurrentUser(profile)

      // Fetch all pings visible to the current user (own pings + friends' pings via RLS)
      // Include own pings and friends' pings
      const { data: pingsData } = await supabase
        .from('pings')
        .select(`
          *,
          host:profiles!host_id(*),
          attendees:ping_attendees(
            *,
            profile:profiles!user_id(*)
          )
        `)
        .order('event_at', { ascending: true })

      if (pingsData) {
        // Client-side filter: only show active pings (not expired, not hidden)
        const now = new Date()
        const activePings = pingsData.filter(
          (p) => new Date(p.event_at) > now && !p.hidden
        )
        setPings(activePings)
      }

      setLoading(false)
    }

    load()
  }, [])

  const handlePingUpdate = (updatedPing: Ping | null) => {
    if (!updatedPing) {
      setSelectedPing(null)
      return
    }
    // Update pings list
    setPings((prev) =>
      prev.map((p) => (p.id === updatedPing.id ? updatedPing : p))
        .filter((p) => !p.hidden)
    )
    setSelectedPing(updatedPing.hidden ? null : updatedPing)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-60px)]">
      <MapView pings={pings} onPingClick={setSelectedPing} />

      {/* FAB - new ping */}
      <button
        onClick={() => router.push('/pings/new')}
        className="absolute bottom-6 right-4 w-14 h-14 bg-brand hover:bg-brand-dark text-white rounded-full shadow-lg flex items-center justify-center transition z-10"
        aria-label="Create new ping"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Ping detail bottom sheet */}
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
