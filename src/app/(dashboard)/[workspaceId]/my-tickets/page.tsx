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
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
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
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-600">
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
                        {/* Status indicator */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            ticket.closedAt ? 'bg-emerald-400' : 'bg-indigo-400'
                          }`}
                        />

                        {/* Title */}
                        <span
                          className={`text-sm flex-1 ${
                            ticket.closedAt
                              ? 'line-through text-gray-400'
                              : 'text-gray-900'
                          }`}
                        >
                          {ticket.title}
                        </span>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ticket.assignmentMode === 'OPEN_POOL' && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              Open Pool
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              ticket.closedAt
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-indigo-100 text-indigo-700'
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
