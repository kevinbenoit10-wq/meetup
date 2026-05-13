export type Profile = {
  id: string
  username: string
  display_name: string
  created_at: string
}

export type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted'
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export type Ping = {
  id: string
  host_id: string
  place_id: string
  place_name: string
  place_address: string | null
  lat: number
  lng: number
  event_at: string
  hidden: boolean
  created_at: string
  host?: Profile
  attendees?: PingAttendee[]
}

export type PingAttendee = {
  id: string
  ping_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}
