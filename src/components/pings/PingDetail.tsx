'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Ping } from '@/lib/types'

interface PingDetailProps {
  ping: Ping | null
  currentUserId: string
  onClose: () => void
  onUpdate?: (ping: Ping | null) => void
}

export default function PingDetail({ ping, currentUserId, onClose, onUpdate }: PingDetailProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ping) return null

  const isHost = ping.host_id === currentUserId
  const isAttending = ping.attendees?.some((a) => a.user_id === currentUserId) ?? false
  const eventDate = new Date(ping.event_at)

  const handleJoin = async () => {
    setLoading(true)
    setError(null)
    const { error: insertError } = await supabase.from('ping_attendees').insert({
      ping_id: ping.id,
      user_id: currentUserId,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Re-fetch updated ping
    const { data: updated } = await supabase
      .from('pings')
      .select(`
        *,
        host:profiles!host_id(*),
        attendees:ping_attendees(
          *,
          profile:profiles!user_id(*)
        )
      `)
      .eq('id', ping.id)
      .single()

    setLoading(false)
    if (updated && onUpdate) {
      onUpdate(updated as Ping)
    }
  }

  const handleHide = async () => {
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('pings')
      .update({ hidden: true })
      .eq('id', ping.id)

    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    if (onUpdate) {
      onUpdate({ ...ping, hidden: true })
    } else {
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-20 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-[60px] left-0 right-0 z-30 animate-slide-up">
        <div className="bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="px-5 pb-8">
            {/* Place name */}
            <h2 className="text-xl font-bold text-gray-900 pr-8 leading-tight">
              {ping.place_name}
            </h2>

            {/* Address */}
            {ping.place_address && (
              <p className="text-sm text-gray-500 mt-1 flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {ping.place_address}
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 my-4" />

            {/* Host */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 font-semibold text-sm">
                  {(ping.host?.display_name ?? 'H')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {ping.host?.display_name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">is hosting</p>
              </div>
              {isHost && (
                <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>

            {/* Date / Time */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {format(eventDate, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-500">{format(eventDate, 'h:mm a')}</p>
              </div>
            </div>

            {/* Attendees */}
            {ping.attendees && ping.attendees.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Going ({ping.attendees.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {ping.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-[10px] text-indigo-600 font-semibold">
                          {(attendee.profile?.display_name ?? 'A')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {attendee.profile?.display_name ?? 'Someone'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 mt-4">
              {!isHost && !isAttending && (
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      I want to join
                    </>
                  )}
                </button>
              )}

              {!isHost && isAttending && (
                <div className="w-full py-3 px-4 bg-green-50 border border-green-200 text-green-700 font-semibold text-sm rounded-xl flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  You&apos;re going!
                </div>
              )}

              {isHost && (
                <button
                  onClick={handleHide}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      Hide ping
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
