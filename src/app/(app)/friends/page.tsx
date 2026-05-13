'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, FriendRequest } from '@/lib/types'
import FriendsList from '@/components/friends/FriendsList'

export default function FriendsPage() {
  const supabase = createClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<Profile[]>([])
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set())

  const [accepting, setAccepting] = useState<string | null>(null)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // Load incoming pending requests (with sender profile)
    const { data: incomingData } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!sender_id(*)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')

    setPendingRequests((incomingData as FriendRequest[]) ?? [])

    // Load accepted friend relationships
    const { data: acceptedData } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (acceptedData) {
      const friendProfiles = acceptedData.map((req) => {
        const r = req as FriendRequest
        return r.sender_id === user.id ? r.receiver! : r.sender!
      })
      setFriends(friendProfiles)
    }

    // Load sent pending requests so we know which buttons to disable
    const { data: sentData } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', user.id)
      .eq('status', 'pending')

    if (sentData) {
      setSentRequestIds(new Set(sentData.map((r) => r.receiver_id as string)))
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || !currentUserId) return

    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', currentUserId)
      .limit(10)

    // Filter out existing friends and pending
    const friendIds = new Set(friends.map((f) => f.id))
    const pendingReceiverIds = new Set(pendingRequests.map((r) => r.sender_id))

    const filtered = (data ?? []).filter(
      (p) => !friendIds.has(p.id) && !pendingReceiverIds.has(p.id)
    )
    setSearchResults(filtered as Profile[])
    setSearching(false)
  }

  const handleSendRequest = async (receiverId: string) => {
    if (!currentUserId) return
    setSendingTo(receiverId)

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
    })

    if (!error) {
      setSentRequestIds((prev) => new Set([...prev, receiverId]))
      setSearchResults((prev) => prev.filter((p) => p.id !== receiverId))
    }

    setSendingTo(null)
  }

  const handleAcceptRequest = async (requestId: string) => {
    setAccepting(requestId)
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)

    await loadData()
    setAccepting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Friends</h1>

      {/* Search section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Find friends
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username…"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {searching ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                'Search'
              )}
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              {searchResults.map((profile) => {
                const sent = sentRequestIds.has(profile.id)
                return (
                  <li key={profile.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-semibold text-sm">
                        {profile.display_name[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{profile.display_name}</p>
                      <p className="text-xs text-gray-400">@{profile.username}</p>
                    </div>
                    <button
                      onClick={() => handleSendRequest(profile.id)}
                      disabled={sent || sendingTo === profile.id}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                        sent
                          ? 'bg-gray-100 text-gray-400 cursor-default'
                          : 'bg-brand hover:bg-brand-dark text-white'
                      }`}
                    >
                      {sent ? 'Sent' : sendingTo === profile.id ? '…' : 'Add'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <p className="text-sm text-gray-400 text-center mt-3">No users found</p>
          )}
        </div>
      </section>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Friend requests ({pendingRequests.length})
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2">
            <ul className="divide-y divide-gray-50">
              {pendingRequests.map((req) => (
                <li key={req.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 font-semibold text-sm">
                      {(req.sender?.display_name ?? 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {req.sender?.display_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">@{req.sender?.username}</p>
                  </div>
                  <button
                    onClick={() => handleAcceptRequest(req.id)}
                    disabled={accepting === req.id}
                    className="text-xs font-semibold px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full transition disabled:opacity-60"
                  >
                    {accepting === req.id ? '…' : 'Accept'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Your friends ({friends.length})
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2">
          <FriendsList friends={friends} />
        </div>
      </section>
    </div>
  )
}
