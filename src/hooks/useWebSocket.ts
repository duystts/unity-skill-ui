'use client'

import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { queryKeys } from '@/lib/queryKeys'

export function useWebSocket() {
  const client = useRef<Client | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)
  const mode = useUIStore((s) => s.mode)
  const queryClient = useQueryClient()
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

  useEffect(() => {
    if (!accessToken) return

    const stompClient = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      onConnect: () => {
        stompClient.subscribe('/user/queue/notifications', (message) => {
          const notification = JSON.parse(message.body)
          // Invalidate cache — NotificationBell/Character re-fetches
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })

          if (notification.type === 'ACHIEVEMENT_EARNED') {
            const { iconEmoji, title, tier } = notification.payload ?? {}
            const tierLabel = tier === 'GOLD' ? '🥇' : tier === 'SILVER' ? '🥈' : '🥉'
            toast(`${tierLabel} Achievement Unlocked!`, {
              description: `${iconEmoji ?? ''} ${title}`,
              duration: 6000,
            })
            // Invalidate achievements so skill-profile re-fetches
            queryClient.invalidateQueries({ queryKey: ['achievements', 'me'] })
          } else if (mode === 'serious') {
            toast(notification.type.replace(/_/g, ' '), {
              description: `New notification received`,
            })
          }
        })
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message'])
      },
      reconnectDelay: 5000,
    })

    stompClient.activate()
    client.current = stompClient

    return () => {
      stompClient.deactivate()
    }
  }, [accessToken]) // reconnect when token changes
}
