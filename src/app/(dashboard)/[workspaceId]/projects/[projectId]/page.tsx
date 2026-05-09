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
import type { Ticket, WorkflowStage, WorkspaceMember } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

function groupTicketsByStage(tickets: Ticket[]): Record<string, Ticket[]> {
  return tickets.reduce((acc, t) => {
    const key = t.stageId ?? 'unassigned'
    acc[key] = [...(acc[key] ?? []), t]
    return acc
  }, {} as Record<string, Ticket[]>)
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
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

  // ── Render ─────────────────────────────────────────────────
  return (
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
                  className="text-sm text-indigo-600 hover:underline font-medium"
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
                            : 'bg-indigo-400'
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
                            className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition ${
                              isSelected
                                ? 'border-indigo-400 ring-1 ring-indigo-200 shadow-sm'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Top badges */}
                            {(ticket.assignmentMode === 'OPEN_POOL' ||
                              ticket.closedAt) && (
                              <div className="flex gap-1 mb-2 flex-wrap">
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
                            )}

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
                        <div className="bg-white rounded-lg border border-indigo-300 ring-1 ring-indigo-200 p-3 shadow-sm">
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
                              className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-md font-medium disabled:opacity-50 hover:bg-indigo-700 transition"
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
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition font-medium"
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

        {/* ── Ticket detail side panel ── */}
        {selectedTicket && (
          <div className="w-[380px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedTicket.closedAt
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {selectedTicket.closedAt ? 'Closed' : 'Open'}
              </span>
              <div className="flex-1" />
              <button
                onClick={closeDetail}
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded hover:bg-gray-100"
                title="Close"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
              {/* ── Title ── */}
              <div>
                {editingTitle ? (
                  <input
                    ref={editTitleRef}
                    className="w-full text-base font-semibold text-gray-900 border border-indigo-300 rounded-lg px-3 py-2 outline-none ring-1 ring-indigo-100"
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
                      className="w-full text-sm text-gray-700 border border-indigo-300 rounded-lg px-3 py-2 outline-none resize-none ring-1 ring-indigo-100 leading-relaxed"
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
                        className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
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
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
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
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-indigo-700 transition"
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
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-indigo-300"
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
                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-indigo-700 transition"
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

              {/* ── GitHub PR ── */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  GitHub PR
                </label>
                {editingPrUrl ? (
                  <div className="mt-1.5">
                    <input
                      className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-2 outline-none ring-1 ring-indigo-100"
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
                        className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
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
                        className="text-sm text-indigo-600 hover:underline break-all"
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
  )
}
