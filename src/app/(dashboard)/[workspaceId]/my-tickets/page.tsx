'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import type { Ticket, Project } from '@/types'

type FilterTab = 'All' | 'To Do' | 'In Progress' | 'Done'

const TAG_LABELS: Record<string, string> = {
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
  DEVOPS: 'DevOps',
  TESTING: 'Testing',
  BUG_FIX: 'Bug Fix',
  FEATURE: 'Feature',
  ARCHITECTURE: 'Architecture',
  DATABASE: 'Database',
  API: 'API',
  PERFORMANCE: 'Performance',
  SECURITY: 'Security',
  DOCUMENTATION: 'Docs',
  CODE_REVIEW: 'Code Review',
}

const TAG_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  BACKEND:      { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  FRONTEND:     { bg: 'bg-violet-100', text: 'text-violet-700' },
  DEVOPS:       { bg: 'bg-orange-100', text: 'text-orange-700' },
  TESTING:      { bg: 'bg-emerald-100',text: 'text-emerald-700'},
  BUG_FIX:      { bg: 'bg-red-100',    text: 'text-red-700'    },
  FEATURE:      { bg: 'bg-cobalt-100', text: 'text-cobalt-700' },
  ARCHITECTURE: { bg: 'bg-slate-100',  text: 'text-slate-700'  },
  DATABASE:     { bg: 'bg-cyan-100',   text: 'text-cyan-700'   },
  API:          { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  PERFORMANCE:  { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  SECURITY:     { bg: 'bg-rose-100',   text: 'text-rose-700'   },
  DOCUMENTATION:{ bg: 'bg-gray-100',   text: 'text-gray-600'   },
  CODE_REVIEW:  { bg: 'bg-purple-100', text: 'text-purple-700' },
}

const PROJECT_COLORS = [
  '#3574f0', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2',
]

function getProjectColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff
  return PROJECT_COLORS[Math.abs(h) % PROJECT_COLORS.length]
}

function ticketStatus(ticket: Ticket): FilterTab {
  if (ticket.closedAt) return 'Done'
  // If there's a stageId it's in progress
  if ((ticket as any).stageId) return 'In Progress'
  return 'To Do'
}

function ageDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

function StatusDot({ status }: { status: FilterTab }) {
  const color =
    status === 'Done'        ? '#22c55e' :
    status === 'In Progress' ? '#3574f0' : '#60a5fa'
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  )
}

function PriorityPill({ priority }: { priority?: string }) {
  if (!priority) return null
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    HIGH:   { bg: 'bg-red-100',   text: 'text-red-700',   label: 'High'   },
    MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
    LOW:    { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Low'    },
  }
  const s = styles[priority] ?? styles.LOW
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default function MyTicketsPage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const [activeTab, setActiveTab] = useState<FilterTab>('All')

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: queryKeys.tickets.mine(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: Ticket[] }>(`/workspaces/${workspaceId}/my-tickets`)
        .then((r) => r.data.data),
  })

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects`)
        .then((r) => r.data.data),
  })

  const projectMap = new Map(projects.map((p) => [p.id, p]))

  const counts: Record<FilterTab, number> = {
    All:         tickets.length,
    'To Do':     tickets.filter(t => ticketStatus(t) === 'To Do').length,
    'In Progress': tickets.filter(t => ticketStatus(t) === 'In Progress').length,
    Done:        tickets.filter(t => ticketStatus(t) === 'Done').length,
  }

  const filtered = activeTab === 'All' ? tickets : tickets.filter(t => ticketStatus(t) === activeTab)

  const TABS: FilterTab[] = ['All', 'To Do', 'In Progress', 'Done']

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">My Tickets</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-white border border-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-sm">
              <p className="text-gray-700 font-medium mb-2">No tickets assigned to you</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Ask your PM to assign tickets to you, or claim an{' '}
                <span className="text-amber-600 font-medium">Open Pool</span> ticket from a project.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Segmented filter bar */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: 10,
              padding: 3,
              display: 'inline-flex',
              gap: 2,
            }}>
              {TABS.map((tab) => {
                const isActive = tab === activeTab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#0f172a' : '#64748b',
                      background: isActive ? '#fff' : 'transparent',
                      boxShadow: isActive ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: isActive ? '#e2e8f0' : '#e2e8f0',
                      color: isActive ? '#334155' : '#94a3b8',
                    }}>
                      {counts[tab]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Ticket list */}
            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-400">No tickets in this category.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                {filtered.map((ticket, idx) => {
                  const status = ticketStatus(ticket)
                  const isDone = status === 'Done'
                  const project = projectMap.get(ticket.projectId)
                  const projColor = getProjectColor(ticket.projectId)
                  const age = (ticket as any).createdAt ? ageDays((ticket as any).createdAt) : null
                  const tags: string[] = (ticket as any).tags ?? []

                  return (
                    <div
                      key={ticket.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 16px',
                        borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
                        opacity: isDone ? 0.62 : 1,
                      }}
                    >
                      {/* Status dot */}
                      <StatusDot status={status} />

                      {/* Title */}
                      <span style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 500,
                        color: isDone ? '#94a3b8' : '#0f172a',
                        textDecoration: isDone ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}>
                        {ticket.title}
                      </span>

                      {/* Project chip */}
                      {project && (
                        <span style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: projColor + '14',
                          border: `1px solid ${projColor}33`,
                          color: projColor,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>
                          {project.keyPrefix ?? project.name.slice(0, 4).toUpperCase()}
                        </span>
                      )}

                      {/* Tag chips */}
                      {tags.slice(0, 2).map((tag) => {
                        const c = TAG_CHIP_COLORS[tag]
                        if (!c) return null
                        return (
                          <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
                            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {TAG_LABELS[tag] ?? tag}
                          </span>
                        )
                      })}

                      {/* Priority */}
                      <PriorityPill priority={(ticket as any).priority} />

                      {/* Age */}
                      {age !== null && (
                        <span style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 11,
                          color: '#94a3b8',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}>
                          {age}d
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
