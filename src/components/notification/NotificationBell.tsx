'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useState } from 'react'

interface Notification {
  id: string
  type: string
  payload: string
  read: boolean
  createdAt: string
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () =>
      apiClient
        .get<{ data: Notification[]; pagination: unknown }>('/notifications?size=50')
        .then((r) => r.data.data),
  })

  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
  })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-blue-50' : ''}`}
              >
                <p className="text-sm font-medium">{n.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleTimeString()}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
