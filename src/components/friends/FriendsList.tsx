'use client'

import type { Profile } from '@/lib/types'

interface FriendsListProps {
  friends: Profile[]
}

export default function FriendsList({ friends }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No friends yet. Search for friends above!
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {friends.map((friend) => (
        <li key={friend.id} className="flex items-center gap-3 py-2">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 font-semibold text-sm">
              {friend.display_name[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{friend.display_name}</p>
            <p className="text-xs text-gray-400">@{friend.username}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
