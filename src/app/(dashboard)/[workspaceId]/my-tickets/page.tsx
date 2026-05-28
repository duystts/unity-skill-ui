'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import type { Ticket, Project } from '@/types'

export default function MyTicketsPage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params

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

  // Group tickets by projectId
  const grouped = tickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const key = ticket.projectId
    if (!acc[key]) acc[key] = []
    acc[key].push(ticket)
    return acc
  }, {})

  const openCount = tickets.filter((t) => !t.closedAt).length
  const doneCount = tickets.filter((t) => !!t.closedAt).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">My Tickets</h1>
        <div className="flex-1" />
        {tickets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-cobalt-50 text-cobalt-700 px-2 py-0.5 rounded-full font-medium">
              {openCount} open
            </span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {doneCount} done
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-200" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
                <div className="space-y-2 pl-10">
                  <div className="h-9 bg-gray-100 rounded" />
                  <div className="h-9 bg-gray-100 rounded" />
                </div>
              </div>
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
          <div className="space-y-5">
            {Object.entries(grouped).map(([projectId, projectTickets]) => {
              const project = projectMap.get(projectId)
              const openInProject = projectTickets.filter((t) => !t.closedAt).length
              const doneInProject = projectTickets.filter((t) => !!t.closedAt).length

              return (
                <div
                  key={projectId}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Project header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-slate-50">
                    <div className="w-7 h-7 rounded-lg bg-cobalt-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-cobalt-600">
                        {(project?.name ?? projectId)[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 flex-1 text-sm">
                      {project?.name ?? projectId.slice(0, 12)}
                    </span>
                    <span className="text-xs text-gray-400">
                      <span className="font-medium text-gray-600">{openInProject}</span> open
                      {doneInProject > 0 && (
                        <>
                          {' '}·{' '}
                          <span className="font-medium text-emerald-600">{doneInProject}</span> done
                        </>
                      )}
                    </span>
                  </div>

                  {/* Ticket list */}
                  <div className="divide-y divide-gray-50">
                    {projectTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition"
                      >
                        {/* Status dot */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            ticket.closedAt ? 'bg-emerald-400' : 'bg-cobalt-400'
                          }`}
                        />

                        {/* Ticket code */}
                        <span className="font-mono text-[11px] font-semibold text-cobalt-500 bg-cobalt-50 px-1.5 py-0.5 rounded shrink-0">
                          {ticket.ticketCode}
                        </span>

                        {/* Title */}
                        <span
                          className={`text-sm flex-1 min-w-0 truncate ${
                            ticket.closedAt
                              ? 'line-through text-gray-400'
                              : 'text-gray-900'
                          }`}
                        >
                          {ticket.title}
                        </span>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ticket.hasPr && (
                            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                              </svg>
                              PR
                            </span>
                          )}
                          {ticket.assignmentMode === 'OPEN_POOL' && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              Open Pool
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              ticket.closedAt
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-cobalt-100 text-cobalt-700'
                            }`}
                          >
                            {ticket.closedAt ? 'Done' : 'Open'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
