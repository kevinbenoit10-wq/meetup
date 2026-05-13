'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [pingCount, setPingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData as Profile)

      // Count friends
      const { count: fCount } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      setFriendCount(fCount ?? 0)

      // Count pings created by user
      const { count: pCount } = await supabase
        .from('pings')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', user.id)

      setPingCount(pCount ?? 0)

      setLoading(false)
    }

    load()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <p className="text-gray-500 text-sm">Profile not found.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Avatar + name card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-indigo-600">
            {profile.display_name[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{profile.display_name}</h2>
          <p className="text-sm text-gray-400">@{profile.username}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{friendCount}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {friendCount === 1 ? 'Friend' : 'Friends'}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{pingCount}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {pingCount === 1 ? 'Ping created' : 'Pings created'}
          </p>
        </div>
      </div>

      {/* Sign out button */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full py-3 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {signingOut ? (
          <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </>
        )}
      </button>
    </div>
  )
}
