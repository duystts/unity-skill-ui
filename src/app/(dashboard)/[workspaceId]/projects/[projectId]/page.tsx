'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { toast } from 'sonner'
import axios from 'axios'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import type { Ticket, TicketActivity, TicketAttachment, StorageStats, WorkflowStage, WorkspaceMember, AiChatTurn } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ActivityRow({ activity, isLast }: { activity: TicketActivity; isLast: boolean }) {
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const actor = activity.actorName ?? 'Unknown'
  const initials = actor.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isAuto = !activity.actorId

  let icon: React.ReactNode
  let description: React.ReactNode

  if (activity.type === 'TICKET_CREATED') {
    icon = <span className="text-emerald-500">✦</span>
    description = (
      <>created <span className="font-mono text-cobalt-600 text-[10px]">{activity.ticketCode}</span> <span className="text-gray-700">{activity.ticketTitle}</span></>
    )
  } else if (activity.type === 'STAGE_CHANGED') {
    icon = <span className="text-blue-400">→</span>
    description = (
      <>moved <span className="font-mono text-cobalt-600 text-[10px]">{activity.ticketCode}</span>{' '}
        <span className="text-gray-500 line-through text-[10px]">{activity.fromStageName ?? '?'}</span>
        {' → '}
        <span className="text-gray-800 font-medium text-[11px]">{activity.toStageName ?? '?'}</span>
      </>
    )
  } else if (activity.type === 'PR_LINKED') {
    icon = <span className="text-violet-500">⎇</span>
    description = <>linked PR to <span className="font-mono text-cobalt-600 text-[10px]">{activity.ticketCode}</span></>
  } else {
    icon = <span className="text-gray-400">·</span>
    description = <>{activity.type.toLowerCase().replace('_', ' ')}</>
  }

  return (
    <div className="flex gap-3 pb-4 relative">
      {/* Avatar / dot */}
      <div className="shrink-0 z-10">
        {isAuto ? (
          <div className="w-[30px] h-[30px] rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm">
            {icon}
          </div>
        ) : (
          <div className="w-[30px] h-[30px] rounded-full bg-cobalt-500 flex items-center justify-center text-white text-[10px] font-bold">
            {initials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-800">{actor}</span>{' '}
          {description}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(activity.createdAt)}</p>
      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  )
}

function groupTicketsByStage(tickets: Ticket[]): Record<string, Ticket[]> {
  return tickets.reduce((acc, t) => {
    const key = t.stageId ?? 'unassigned'
    acc[key] = [...(acc[key] ?? []), t]
    return acc
  }, {} as Record<string, Ticket[]>)
}

const AVATAR_COLORS = [
  'bg-cobalt-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
]

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const cls =
    size === 'xs'
      ? `inline-flex items-center justify-center w-5 h-5 rounded-full ${color} text-white text-[9px] font-bold shrink-0`
      : `inline-flex items-center justify-center w-6 h-6 rounded-full ${color} text-white text-[10px] font-bold shrink-0`
  return <span className={cls}>{initials}</span>
}

export default function KanbanBoardPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>()
  const { workspaceId, projectId } = params
  const router = useRouter()
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const currentUser = useAuthStore((s) => s.user)

  // Board state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [addingInStage, setAddingInStage] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Detail panel state
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescValue, setEditDescValue] = useState('')
  const [editingPrUrl, setEditingPrUrl] = useState(false)
  const [editPrUrlValue, setEditPrUrlValue] = useState('')
  const [moveStageValue, setMoveStageValue] = useState('')
  const [assigneeValue, setAssigneeValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI assistant chat state
  const [showAiChat, setShowAiChat] = useState(false)
  const [aiMessages, setAiMessages] = useState<AiChatTurn[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)

  const newTitleRef = useRef<HTMLInputElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)
  const stompRef = useRef<Client | null>(null)

  // ── Queries ────────────────────────────────────────────────
  const { data: stages = [] } = useQuery({
    queryKey: queryKeys.projects.stages(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: WorkflowStage[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/stages`
        )
        .then((r) => r.data.data),
  })

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: queryKeys.tickets.all(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: Ticket[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/tickets`
        )
        .then((r) => r.data.data),
  })

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`)
        .then((r) => r.data.data),
  })

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: queryKeys.tickets.attachments(workspaceId, selectedTicket?.id ?? ''),
    queryFn: () =>
      apiClient
        .get<{ data: TicketAttachment[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/tickets/${selectedTicket!.id}/attachments`
        )
        .then(r => r.data.data),
    enabled: !!selectedTicket,
  })

  const { data: storageStats } = useQuery({
    queryKey: queryKeys.storage.stats(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: StorageStats }>(`/workspaces/${workspaceId}/storage/stats`)
        .then(r => r.data.data),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ ticketId, attachmentId }: { ticketId: string; attachmentId: string }) =>
      apiClient.delete(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets/${ticketId}/attachments/${attachmentId}`
      ),
    onSuccess: () => {
      refetchAttachments()
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.stats(workspaceId) })
    },
    onError: () => toast.error('Failed to delete attachment'),
  })

  const handleFileUpload = async (file: File) => {
    if (!selectedTicket) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets/${selectedTicket.id}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      refetchAttachments()
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.stats(workspaceId) })
      toast.success('File uploaded')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Auto-scroll AI chat to bottom
  useEffect(() => {
    if (showAiChat) aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, showAiChat])

  const handleAiSend = async () => {
    const text = aiInput.trim()
    if (!text || aiLoading) return

    const userTurn: AiChatTurn = { role: 'user', content: text }
    const nextMessages = [...aiMessages, userTurn]
    setAiMessages(nextMessages)
    setAiInput('')
    setAiLoading(true)

    try {
      const res = await apiClient.post<{ data: { reply: string } }>(
        `/workspaces/${workspaceId}/projects/${projectId}/ai/chat`,
        { message: text, history: aiMessages }
      )
      setAiMessages([...nextMessages, { role: 'assistant', content: res.data.data.reply }])
    } catch {
      setAiMessages([...nextMessages, { role: 'assistant', content: '⚠️ Không thể kết nối AI. Vui lòng thử lại.' }])
    } finally {
      setAiLoading(false)
    }
  }

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: queryKeys.tickets.activities(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: TicketActivity[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/activities`
        )
        .then((r) => r.data.data),
    enabled: showActivity,
    refetchOnWindowFocus: false,
  })

  const currentMember = members.find((m) => m.userId === currentUser?.id)
  const isPmOrAdmin =
    currentMember?.role === 'PM' || currentMember?.role === 'ADMIN'

  // Keep selected ticket in sync with latest query data
  useEffect(() => {
    if (!selectedTicket) return
    const updated = tickets.find((t) => t.id === selectedTicket.id)
    if (updated) setSelectedTicket(updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets])

  // Auto-focus quick-add input
  useEffect(() => {
    if (addingInStage) setTimeout(() => newTitleRef.current?.focus(), 40)
  }, [addingInStage])

  // Auto-focus title edit
  useEffect(() => {
    if (editingTitle) setTimeout(() => editTitleRef.current?.focus(), 40)
  }, [editingTitle])

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return
    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      onConnect: () => {
        client.subscribe(`/topic/workspace/${workspaceId}/tickets`, () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.tickets.all(workspaceId, projectId),
          })
        })
      },
      reconnectDelay: 5000,
    })
    client.activate()
    stompRef.current = client
    return () => { client.deactivate() }
  }, [accessToken, workspaceId, projectId, queryClient])

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: ({
      title,
      description,
      stageId,
    }: {
      title: string
      description: string
      stageId: string
    }) =>
      apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets`,
        { title, description: description || undefined, stageId }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.all(workspaceId, projectId),
      })
      setAddingInStage(null)
      setNewTitle('')
      setNewDescription('')
    },
    onError: () => toast.error('Failed to create ticket'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      ticketId,
      body,
    }: {
      ticketId: string
      body: Record<string, unknown>
    }) =>
      apiClient.patch(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets/${ticketId}`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.all(workspaceId, projectId),
      })
    },
    onError: () => toast.error('Failed to update ticket'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ ticketId }: { ticketId: string }) =>
      apiClient.delete(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets/${ticketId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.all(workspaceId, projectId),
      })
      setSelectedTicket(null)
      setConfirmDelete(false)
      toast.success('Ticket deleted')
    },
    onError: () => toast.error('Failed to delete ticket'),
  })

  const claimMutation = useMutation({
    mutationFn: ({ ticketId }: { ticketId: string }) =>
      apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/tickets/${ticketId}/claim`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.all(workspaceId, projectId),
      })
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error('Ticket already claimed')
      } else {
        toast.error('Failed to claim ticket')
      }
    },
  })

  // ── Helpers ────────────────────────────────────────────────
  const grouped = groupTicketsByStage(tickets)
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)

  const memberName = (memberId: string | null) => {
    if (!memberId) return null
    const m = members.find((m) => m.userId === memberId)
    return m
      ? m.displayName || m.email || m.user?.displayName || m.user?.email || memberId.slice(0, 8)
      : memberId.slice(0, 8)
  }

  const openDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setMoveStageValue(ticket.stageId ?? '')
    setAssigneeValue(ticket.assigneeId ?? '')
    setEditingTitle(false)
    setEditingDescription(false)
    setEditingPrUrl(false)
    setConfirmDelete(false)
  }

  const closeDetail = () => {
    setSelectedTicket(null)
    setEditingTitle(false)
    setEditingDescription(false)
    setEditingPrUrl(false)
    setConfirmDelete(false)
  }

  const handleCreate = (stageId: string) => {
    const title = newTitle.trim()
    if (!title) return
    createMutation.mutate({ title, description: newDescription.trim(), stageId })
  }

  const handleSaveTitle = (ticket: Ticket) => {
    const v = editTitleValue.trim()
    setEditingTitle(false)
    if (!v || v === ticket.title) return
    updateMutation.mutate({ ticketId: ticket.id, body: { title: v } })
  }

  const handleSaveDescription = (ticket: Ticket) => {
    updateMutation.mutate({
      ticketId: ticket.id,
      body: { description: editDescValue || null },
    })
    setEditingDescription(false)
  }

  const handleSavePrUrl = (ticket: Ticket) => {
    updateMutation.mutate({
      ticketId: ticket.id,
      body: { githubPrUrl: editPrUrlValue || null },
    })
    setEditingPrUrl(false)
  }

  const handleMoveStage = (ticket: Ticket) => {
    if (!moveStageValue || moveStageValue === ticket.stageId) return
    updateMutation.mutate({
      ticketId: ticket.id,
      body: { stageId: moveStageValue },
    })
  }

  const handleAssign = (ticket: Ticket) => {
    if (!assigneeValue) return
    updateMutation.mutate({
      ticketId: ticket.id,
      body: { assigneeId: assigneeValue, assignmentMode: 'ASSIGNED' },
    })
    setAssigneeValue('')
  }

  // ── Stats ─────────────────────────────────────────────────
  const totalTickets   = tickets.length
  const openTickets    = tickets.filter(t => !t.closedAt).length
  const closedTickets  = tickets.filter(t => !!t.closedAt).length
  const withPr         = tickets.filter(t => t.hasPr).length
  const openPool       = tickets.filter(t => t.assignmentMode === 'OPEN_POOL' && !t.assigneeId).length
  const completionRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0

  // Per-member ticket counts (open only)
  const ticketsByMember = members
    .map(m => ({
      member: m,
      open:   tickets.filter(t => t.assigneeId === m.userId && !t.closedAt).length,
      closed: tickets.filter(t => t.assigneeId === m.userId && !!t.closedAt).length,
    }))
    .filter(x => x.open + x.closed > 0)
    .sort((a, b) => b.open - a.open)

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push(`/${workspaceId}/projects`)}
          className="text-gray-400 hover:text-gray-600 transition"
          title="Back to projects"
        >
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="text-base font-bold text-gray-900">Kanban Board</h1>
        <div className="flex-1" />

        {/* Chat button */}
        <Link
          href={`/${workspaceId}/projects/${projectId}/chat`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
        >
          <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
            <path d="M216,48H40A16,16,0,0,0,24,64V224a8,8,0,0,0,13,6.22L72,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216V192H69.33a8,8,0,0,0-5.16,1.88L40,213.26V64Z"/>
          </svg>
          Chat
        </Link>

        {/* Meetings button */}
        <Link
          href={`/${workspaceId}/projects/${projectId}/meetings`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
        >
          <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
            <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24ZM80,112a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,112Zm0,40a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,152Z"/>
          </svg>
          Meetings
        </Link>

        <button
          onClick={() => setShowActivity(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition ${
            showActivity
              ? 'bg-cobalt-50 text-cobalt-700 border-cobalt-300'
              : 'text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity
        </button>

        {isPmOrAdmin && (
          <Link
            href={`/${workspaceId}/projects/${projectId}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
          >
            <svg
              width="13"
              height="13"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </Link>
        )}
      </div>

      {/* ── Stats bar ── */}
      {!isLoading && totalTickets > 0 && (
        <div className="px-6 py-2.5 border-b border-gray-100 bg-gray-50/60 shrink-0">
          {/* Row 1: overview counts */}
          <div className="flex items-center gap-6 overflow-x-auto">
            <StatChip label="Total" value={totalTickets} color="text-gray-700" />
            <StatChip label="Open" value={openTickets} color="text-cobalt-600" />
            <StatChip label="Closed" value={closedTickets} color="text-emerald-600" />
            <StatChip label="With PR" value={withPr} color="text-violet-600" />
            {openPool > 0 && <StatChip label="Open Pool" value={openPool} color="text-orange-500" />}

            {/* Storage stats */}
            {storageStats && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 shrink-0">
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        storageStats.usedBytes / storageStats.limitBytes > 0.9
                          ? 'bg-red-400'
                          : storageStats.usedBytes / storageStats.limitBytes > 0.7
                          ? 'bg-amber-400'
                          : 'bg-cobalt-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(storageStats.usedBytes * 100 / storageStats.limitBytes))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {formatBytes(storageStats.usedBytes)} / {formatBytes(storageStats.limitBytes)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="text-[11px] text-gray-400">Completion</span>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 w-8">{completionRate}%</span>
            </div>
          </div>

          {/* Row 2: per-member breakdown */}
          {ticketsByMember.length > 0 && (
            <div className="flex items-center gap-3 mt-2 overflow-x-auto">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest shrink-0">By member</span>
              {ticketsByMember.map(({ member, open, closed }) => {
                const name = member.displayName || member.email || member.user?.displayName || member.user?.email || member.userId.slice(0, 8)
                const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                const colorIdx = name.charCodeAt(0) % AVATAR_COLORS.length
                return (
                  <div key={member.userId} className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${AVATAR_COLORS[colorIdx]} text-white text-[9px] font-bold`}>
                      {initials}
                    </span>
                    <span className="text-[11px] text-gray-600 max-w-[80px] truncate">{name}</span>
                    <span className="text-[11px] font-semibold text-cobalt-600">{open}</span>
                    {closed > 0 && (
                      <span className="text-[10px] text-gray-400">+{closed}✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Board + side panel ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* ── Board columns ── */}
        <div className="flex-1 overflow-hidden p-5">
          {isLoading ? (
            <div className="flex gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="min-w-[272px] bg-gray-50 rounded-xl border border-gray-200 animate-pulse h-48"
                />
              ))}
            </div>
          ) : sortedStages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 text-sm mb-2">
                No stages configured yet.
              </p>
              {isPmOrAdmin ? (
                <Link
                  href={`/${workspaceId}/projects/${projectId}/settings`}
                  className="text-sm text-cobalt-600 hover:underline font-medium"
                >
                  Go to Settings to add stages →
                </Link>
              ) : (
                <p className="text-gray-400 text-xs">
                  Ask your PM to set up workflow stages.
                </p>
              )}
            </div>
          ) : (
            <div className="flex gap-4 h-full overflow-x-auto pb-2">
              {sortedStages.map((stage) => {
                const stageTickets = grouped[stage.id] ?? []
                const isAdding = addingInStage === stage.id

                return (
                  <div
                    key={stage.id}
                    className="min-w-[272px] max-w-[272px] flex flex-col rounded-xl bg-gray-50/70 border border-gray-200"
                  >
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          stage.isClosedState
                            ? 'bg-emerald-400'
                            : 'bg-cobalt-400'
                        }`}
                      />
                      <span className="font-semibold text-sm text-gray-800 flex-1 truncate">
                        {stage.name}
                      </span>
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5 font-medium">
                        {stageTickets.length}
                      </span>
                    </div>

                    {/* Ticket list */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                      {stageTickets.map((ticket) => {
                        const assigneeName = memberName(ticket.assigneeId)
                        const isSelected = selectedTicket?.id === ticket.id
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => openDetail(ticket)}
                            className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-cobalt-300 hover:shadow-sm transition ${
                              isSelected
                                ? 'border-cobalt-400 ring-1 ring-cobalt-200 shadow-sm'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Top row: ticket code + status badges */}
                            <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-semibold text-cobalt-500 bg-cobalt-50 px-1.5 py-0.5 rounded">
                                {ticket.ticketCode}
                              </span>
                              {ticket.hasPr && (
                                <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                  <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                                  </svg>
                                  PR
                                </span>
                              )}
                              {ticket.assignmentMode === 'OPEN_POOL' && !ticket.assigneeId && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                  Open Pool
                                </span>
                              )}
                              {ticket.closedAt && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                  Closed
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <p
                              className={`text-sm font-medium leading-snug ${
                                ticket.closedAt
                                  ? 'text-gray-400 line-through'
                                  : 'text-gray-800'
                              }`}
                            >
                              {ticket.title}
                            </p>

                            {/* Description preview */}
                            {ticket.description && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                {ticket.description}
                              </p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between gap-2 mt-2.5">
                              {assigneeName ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Avatar name={assigneeName} size="xs" />
                                  <span className="text-[11px] text-gray-500 truncate">
                                    {assigneeName}
                                  </span>
                                </div>
                              ) : (
                                <span />
                              )}

                              {ticket.assignmentMode === 'OPEN_POOL' &&
                                !ticket.assigneeId && (
                                  <button
                                    className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded-full font-medium transition shrink-0"
                                    disabled={claimMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      claimMutation.mutate({
                                        ticketId: ticket.id,
                                      })
                                    }}
                                  >
                                    Claim
                                  </button>
                                )}
                            </div>
                          </div>
                        )
                      })}

                      {/* Quick-add card */}
                      {isAdding && (
                        <div className="bg-white rounded-lg border border-cobalt-300 ring-1 ring-cobalt-200 p-3 shadow-sm">
                          <input
                            ref={newTitleRef}
                            className="w-full text-sm font-medium text-gray-800 outline-none placeholder-gray-300 mb-2"
                            placeholder="Ticket title..."
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleCreate(stage.id)
                              }
                              if (e.key === 'Escape') {
                                setAddingInStage(null)
                                setNewTitle('')
                                setNewDescription('')
                              }
                            }}
                          />
                          <textarea
                            className="w-full text-xs text-gray-600 outline-none placeholder-gray-300 resize-none leading-relaxed"
                            placeholder="Description (optional)..."
                            rows={2}
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setAddingInStage(null)
                                setNewTitle('')
                                setNewDescription('')
                              }
                            }}
                          />
                          <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
                            <button
                              className="px-3 py-1 bg-cobalt-600 text-white text-xs rounded-md font-medium disabled:opacity-50 hover:bg-cobalt-700 transition"
                              disabled={
                                !newTitle.trim() || createMutation.isPending
                              }
                              onClick={() => handleCreate(stage.id)}
                            >
                              {createMutation.isPending
                                ? 'Creating...'
                                : 'Create'}
                            </button>
                            <button
                              className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition"
                              onClick={() => {
                                setAddingInStage(null)
                                setNewTitle('')
                                setNewDescription('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Add ticket button */}
                    {!isAdding && (
                      <div className="p-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setAddingInStage(stage.id)
                            setNewTitle('')
                            setNewDescription('')
                          }}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-cobalt-600 hover:bg-cobalt-50 rounded-lg transition font-medium"
                        >
                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Add ticket
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Activity feed panel ── */}
        {showActivity && (
          <div className="w-[320px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-cobalt-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Activity</span>
              <span className="text-xs text-gray-400 ml-1">{activities.length} events</span>
              <button onClick={() => setShowActivity(false)} className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              {activitiesLoading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="w-5 h-5 border-2 border-cobalt-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-6">No activity yet.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-100" />
                  <div className="space-y-0">
                    {activities.map((a, idx) => (
                      <ActivityRow key={a.id} activity={a} isLast={idx === activities.length - 1} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Ticket detail side panel ── */}
        {selectedTicket && (
          <div className="w-[380px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {/* Ticket code — copy on click */}
                <button
                  className="font-mono text-xs font-bold text-cobalt-600 bg-cobalt-50 hover:bg-cobalt-100 px-2 py-0.5 rounded transition"
                  title="Click to copy ticket code"
                  onClick={() => navigator.clipboard.writeText(selectedTicket.ticketCode).then(() => toast.success('Copied!'))}
                >
                  {selectedTicket.ticketCode}
                </button>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    selectedTicket.closedAt
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-cobalt-100 text-cobalt-700'
                  }`}
                >
                  {selectedTicket.closedAt ? 'Closed' : 'Open'}
                </span>
                {selectedTicket.hasPr && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                    </svg>
                    PR linked
                  </span>
                )}
                <div className="flex-1" />
                <button
                  onClick={closeDetail}
                  className="text-gray-400 hover:text-gray-600 transition p-1 rounded hover:bg-gray-100"
                  title="Close"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* PR naming hint */}
              {!selectedTicket.hasPr && (
                <p className="mt-1.5 text-[10px] text-gray-400">
                  Name your PR:{' '}
                  <span className="font-mono text-gray-500 bg-gray-100 px-1 rounded">
                    [{selectedTicket.ticketCode}] description
                  </span>
                </p>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
              {/* ── Title ── */}
              <div>
                {editingTitle ? (
                  <input
                    ref={editTitleRef}
                    className="w-full text-base font-semibold text-gray-900 border border-cobalt-300 rounded-lg px-3 py-2 outline-none ring-1 ring-cobalt-100"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={() => handleSaveTitle(selectedTicket)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(selectedTicket)
                      if (e.key === 'Escape') setEditingTitle(false)
                    }}
                  />
                ) : (
                  <h2
                    className="text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 -mx-3 transition leading-snug"
                    onClick={() => {
                      setEditTitleValue(selectedTicket.title)
                      setEditingTitle(true)
                    }}
                    title="Click to edit"
                  >
                    {selectedTicket.title}
                  </h2>
                )}
              </div>

              {/* ── Description ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  Description
                </label>
                {editingDescription ? (
                  <div className="mt-1.5">
                    <textarea
                      className="w-full text-sm text-gray-700 border border-cobalt-300 rounded-lg px-3 py-2 outline-none resize-none ring-1 ring-cobalt-100 leading-relaxed"
                      rows={5}
                      value={editDescValue}
                      onChange={(e) => setEditDescValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingDescription(false)
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleSaveDescription(selectedTicket)}
                        disabled={updateMutation.isPending}
                        className="text-xs px-3 py-1 bg-cobalt-600 text-white rounded-md hover:bg-cobalt-700 transition disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDescription(false)}
                        className="text-xs px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-md transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-1.5 min-h-[52px] text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 -mx-3 transition"
                    onClick={() => {
                      setEditDescValue(selectedTicket.description ?? '')
                      setEditingDescription(true)
                    }}
                    title="Click to edit"
                  >
                    {selectedTicket.description ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </p>
                    ) : (
                      <span className="text-gray-300 text-xs italic">
                        Add a description...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Stage ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  Stage
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-cobalt-300 focus:ring-1 focus:ring-cobalt-200"
                    value={moveStageValue}
                    onChange={(e) => setMoveStageValue(e.target.value)}
                  >
                    <option value="">No stage</option>
                    {sortedStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="px-3 py-1.5 text-xs bg-cobalt-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-cobalt-700 transition"
                    onClick={() => handleMoveStage(selectedTicket)}
                    disabled={
                      !moveStageValue ||
                      moveStageValue === selectedTicket.stageId ||
                      updateMutation.isPending
                    }
                  >
                    Move
                  </button>
                </div>
              </div>

              {/* ── Assignee ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  Assignee
                </label>
                <div className="mt-1.5">
                  {selectedTicket.assigneeId ? (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                      <Avatar
                        name={memberName(selectedTicket.assigneeId) ?? 'U'}
                      />
                      <span className="text-sm text-gray-700 flex-1 truncate">
                        {memberName(selectedTicket.assigneeId)}
                      </span>
                      {isPmOrAdmin && (
                        <button
                          className="text-gray-300 hover:text-gray-500 transition text-base leading-none"
                          title="Set to Open Pool"
                          onClick={() =>
                            updateMutation.mutate({
                              ticketId: selectedTicket.id,
                              body: { assignmentMode: 'OPEN_POOL' },
                            })
                          }
                          disabled={updateMutation.isPending}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {isPmOrAdmin ? (
                        <div className="flex gap-2">
                          <select
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-cobalt-300"
                            value={assigneeValue}
                            onChange={(e) => setAssigneeValue(e.target.value)}
                          >
                            <option value="">Select member...</option>
                            {members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.displayName || m.email ||
                                  m.user?.displayName || m.user?.email ||
                                  m.userId.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="px-3 py-1.5 text-xs bg-cobalt-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-cobalt-700 transition"
                            onClick={() => handleAssign(selectedTicket)}
                            disabled={
                              !assigneeValue || updateMutation.isPending
                            }
                          >
                            Assign
                          </button>
                        </div>
                      ) : (
                        <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-400 italic">
                          Unassigned
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Open Pool (PM/Admin) ── */}
              {isPmOrAdmin && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                    Open Pool
                  </label>
                  <div className="mt-1.5">
                    {selectedTicket.assignmentMode === 'OPEN_POOL' ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          className="text-amber-500 shrink-0"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                          />
                        </svg>
                        <span className="text-xs font-medium text-amber-700 flex-1">
                          Open for anyone to claim
                        </span>
                        <button
                          className="text-xs text-amber-500 hover:text-amber-700 font-medium transition"
                          onClick={() =>
                            updateMutation.mutate({
                              ticketId: selectedTicket.id,
                              body: { assignmentMode: 'NONE' },
                            })
                          }
                          disabled={updateMutation.isPending}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        className="w-full px-3 py-2.5 border border-amber-200 text-amber-700 text-sm rounded-lg hover:bg-amber-50 font-medium transition flex items-center justify-center gap-2"
                        onClick={() =>
                          updateMutation.mutate({
                            ticketId: selectedTicket.id,
                            body: { assignmentMode: 'OPEN_POOL' },
                          })
                        }
                        disabled={updateMutation.isPending}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                          />
                        </svg>
                        Set as Open Pool
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Attachments ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  Attachments
                </label>

                {/* Uploaded files */}
                {attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {attachments.map(att => (
                      <div key={att.id} className="group flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50">
                        {att.resourceType === 'image' ? (
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <img src={att.url} alt={att.fileName} className="w-10 h-10 object-cover rounded" />
                          </a>
                        ) : (
                          <div className="w-10 h-10 rounded bg-violet-100 flex items-center justify-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-violet-600">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a href={att.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-medium text-gray-700 hover:text-cobalt-600 truncate block leading-tight">
                            {att.fileName}
                          </a>
                          <p className="text-[10px] text-gray-400">{formatBytes(att.bytes)}</p>
                        </div>
                        <button
                          onClick={() => deleteAttachmentMutation.mutate({ ticketId: selectedTicket.id, attachmentId: att.id })}
                          disabled={deleteAttachmentMutation.isPending}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1 shrink-0"
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-cobalt-600 hover:border-cobalt-300 hover:bg-cobalt-50 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <><div className="w-3 h-3 border border-cobalt-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg> Add image / video</>
                  )}
                </button>
              </div>

              {/* ── GitHub PR ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  GitHub PR
                </label>
                {editingPrUrl ? (
                  <div className="mt-1.5">
                    <input
                      className="w-full text-sm border border-cobalt-300 rounded-lg px-3 py-2 outline-none ring-1 ring-cobalt-100"
                      placeholder="https://github.com/..."
                      value={editPrUrlValue}
                      onChange={(e) => setEditPrUrlValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePrUrl(selectedTicket)
                        if (e.key === 'Escape') setEditingPrUrl(false)
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleSavePrUrl(selectedTicket)}
                        disabled={updateMutation.isPending}
                        className="text-xs px-3 py-1 bg-cobalt-600 text-white rounded-md hover:bg-cobalt-700 transition disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPrUrl(false)}
                        className="text-xs px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-md transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-1.5 min-h-[40px] cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 -mx-3 transition"
                    onClick={() => {
                      setEditPrUrlValue(selectedTicket.githubPrUrl ?? '')
                      setEditingPrUrl(true)
                    }}
                    title="Click to edit"
                  >
                    {selectedTicket.githubPrUrl ? (
                      <a
                        href={selectedTicket.githubPrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cobalt-600 hover:underline break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedTicket.githubPrUrl}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs italic">
                        Add GitHub PR link...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Metadata ── */}
              <div className="text-[11px] text-gray-400 space-y-0.5 pt-1">
                <p>
                  Created{' '}
                  {new Date(selectedTicket.createdAt).toLocaleDateString(
                    'en-US',
                    { year: 'numeric', month: 'short', day: 'numeric' }
                  )}
                </p>
                {selectedTicket.updatedAt !== selectedTicket.createdAt && (
                  <p>
                    Updated{' '}
                    {new Date(selectedTicket.updatedAt).toLocaleDateString(
                      'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* ── Panel footer (delete) ── */}
            {isPmOrAdmin && (
              <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-1">
                      Delete this ticket?
                    </span>
                    <button
                      className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 transition"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        deleteMutation.mutate({ ticketId: selectedTicket.id })
                      }
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition font-medium"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete ticket
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── AI Assistant floating widget ────────────────────────────────────── */}
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {showAiChat && (
        <div className="w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-cobalt-600 flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight">AI Assistant</p>
              <p className="text-cobalt-200 text-[10px]">Hỏi về project của bạn</p>
            </div>
            <div className="flex items-center gap-1">
              {aiMessages.length > 0 && (
                <button
                  onClick={() => setAiMessages([])}
                  className="text-cobalt-200 hover:text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 transition"
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowAiChat(false)}
                className="text-cobalt-200 hover:text-white p-1 rounded hover:bg-white/10 transition"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {aiMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-cobalt-50 flex items-center justify-center mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3574f0" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Xin chào! Tôi là AI Assistant</p>
                <p className="text-xs text-gray-400 leading-relaxed">Hỏi tôi bất cứ điều gì về project này — tiến độ, tickets, stages, hay cần gợi ý gì đó.</p>
                <div className="mt-4 space-y-1.5 w-full">
                  {[
                    'Hiện tại project có bao nhiêu ticket?',
                    'Stage nào đang có nhiều ticket nhất?',
                    'Tóm tắt tình trạng project cho tôi',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setAiInput(q)}
                      className="w-full text-left text-xs text-cobalt-600 bg-cobalt-50 hover:bg-cobalt-100 px-3 py-2 rounded-lg transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {aiMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      msg.role === 'user' ? 'bg-cobalt-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {msg.role === 'user' ? (currentUser?.displayName?.[0] ?? 'U').toUpperCase() : '✦'}
                    </div>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-cobalt-600 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] shrink-0">✦</div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={aiMessagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 shrink-0">
            <div className="flex gap-2 items-end bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-cobalt-300 focus-within:bg-white transition">
              <textarea
                className="flex-1 text-xs resize-none bg-transparent outline-none text-gray-800 placeholder-gray-400 max-h-[80px]"
                placeholder="Nhắn tin với AI..."
                rows={1}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAiSend()
                  }
                }}
              />
              <button
                onClick={handleAiSend}
                disabled={!aiInput.trim() || aiLoading}
                className="shrink-0 w-7 h-7 rounded-lg bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-gray-300 text-center mt-1.5">Enter để gửi · Shift+Enter xuống dòng</p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setShowAiChat((v) => !v)}
        style={{ width: 52, height: 52 }}
        className={`rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
          showAiChat ? 'bg-gray-700 hover:bg-gray-800' : 'bg-cobalt-600 hover:bg-cobalt-700'
        }`}
        title="AI Assistant"
      >
        {showAiChat ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </button>
    </div>
    </>
  )
}
