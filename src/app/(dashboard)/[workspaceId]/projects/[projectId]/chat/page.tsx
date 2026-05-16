'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500',  'bg-rose-500',   'bg-cyan-500',   'bg-pink-500',
]
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const color    = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${color} text-white text-xs font-bold shrink-0 select-none`}>
      {initials}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString())       return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const params      = useParams<{ workspaceId: string; projectId: string }>()
  const { workspaceId, projectId } = params
  const router      = useRouter()
  const currentUser = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [draft, setDraft]         = useState('')
  const [sending, setSending]     = useState(false)
  const [connected, setConnected] = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── REST: load history ────────────────────────────────────────────────────
  const { isLoading, data: historyData } = useQuery({
    queryKey: queryKeys.chat.messages(workspaceId, projectId),
    queryFn:  () =>
      apiClient
        .get<{ data: ChatMessage[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/chat?page=0&size=100`
        )
        .then((r) => r.data.data),
  })

  // Sync messages from server whenever data changes (refetch-safe)
  useEffect(() => {
    if (!historyData) return
    // API returns DESC (newest first) → reverse to ASC for display
    setMessages([...historyData].reverse())
  }, [historyData])

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── STOMP: realtime messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders:   { Authorization: `Bearer ${accessToken}` },
      reconnectDelay:   5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(
          `/topic/workspace/${workspaceId}/chat`,
          (frame) => {
            const event = JSON.parse(frame.body)
            if (event.type !== 'NEW_MESSAGE') return
            const p = event.payload as ChatMessage & { projectId: string }
            if (p.projectId !== projectId) return  // different project — ignore
            const incoming: ChatMessage = { id: p.id, content: p.content, senderName: p.senderName, createdAt: p.createdAt }
            // Dedup: skip if already in state (own-send echo or history overlap)
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            )
          }
        )
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    })

    client.activate()
    return () => { client.deactivate() }
  }, [accessToken, workspaceId, projectId])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft('')
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      const res = await apiClient.post<{ data: ChatMessage }>(
        `/workspaces/${workspaceId}/projects/${projectId}/chat`,
        { content }
      )
      const msg = res.data.data
      // Add immediately for instant feedback; WS echo will be deduped
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
    } catch {
      setDraft(content) // restore on error
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [draft, sending, workspaceId, projectId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const myName = currentUser?.displayName ?? ''

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* ── Topbar ── */}
      <div className="h-13 px-4 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-white">
        <button
          onClick={() => router.push(`/${workspaceId}/projects/${projectId}`)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Chat icon */}
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" className="text-indigo-600">
            <path d="M216,48H40A16,16,0,0,0,24,64V224a8,8,0,0,0,13,6.22L72,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216V192H69.33a8,8,0,0,0-5.16,1.88L40,213.26V64Z"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-gray-900 leading-tight">Project Chat</h1>
          <p className="text-[11px] text-gray-400 leading-tight flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            {connected ? 'Live' : 'Connecting…'}
          </p>
        </div>
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" className="text-indigo-300">
                <path d="M216,48H40A16,16,0,0,0,24,64V224a8,8,0,0,0,13,6.22L72,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216V192H69.33a8,8,0,0,0-5.16,1.88L40,213.26V64Z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-400 font-medium">No messages yet</p>
            <p className="text-xs text-gray-300">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe       = msg.senderName === myName
            const prevMsg    = idx > 0 ? messages[idx - 1] : null
            const showDate   = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt)
            const showAvatar = !isMe && (!prevMsg || prevMsg.senderName !== msg.senderName || showDate)
            const showName   = !isMe && showAvatar

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] font-medium text-gray-400 px-2">
                      {formatDateLabel(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                {/* Message row */}
                <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${showDate || showAvatar ? 'mt-3' : 'mt-0.5'}`}>
                  {/* Avatar placeholder / actual avatar */}
                  {!isMe ? (
                    showAvatar ? (
                      <Avatar name={msg.senderName} />
                    ) : (
                      <div className="w-8 shrink-0" />
                    )
                  ) : null}

                  <div className={`flex flex-col max-w-[68%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && (
                      <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-0.5">
                        {msg.senderName}
                      </span>
                    )}
                    <div className="flex items-end gap-1.5">
                      {isMe && (
                        <span className="text-[10px] text-gray-300 mb-0.5 shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {!isMe && (
                        <span className="text-[10px] text-gray-300 mb-0.5 shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none resize-none leading-relaxed py-0.5 max-h-36"
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
          >
            {sending ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
                <path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37l19.57,68.49A8,8,0,0,0,68,112H136a8,8,0,0,1,0,16H68a8,8,0,0,0-7.51,5.29L40.92,201.68a16,16,0,0,0,22.95,19l168-95.89a16,16,0,0,0,0-10.81Z"/>
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 ml-1">
          Enter ↵ to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
