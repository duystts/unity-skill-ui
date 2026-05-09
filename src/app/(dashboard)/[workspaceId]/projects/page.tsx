'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueries } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import type { Project, Ticket } from '@/types'

export default function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId
  const router = useRouter()
  const currentUser = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.projects.all(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects`)
        .then((r) => r.data.data),
  })
  const projects = data ?? []

  // Fetch tickets for every project in parallel
  const ticketQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: queryKeys.tickets.all(workspaceId, project.id),
      queryFn: () =>
        apiClient
          .get<{ data: Ticket[] }>(
            `/workspaces/${workspaceId}/projects/${project.id}/tickets`
          )
          .then((r) => r.data.data),
    })),
  })

  const getStats = (idx: number) => {
    const tickets: Ticket[] = ticketQueries[idx]?.data ?? []
    const open = tickets.filter((t) => !t.closedAt).length
    const closed = tickets.filter((t) => !!t.closedAt).length
    const mine = tickets.filter(
      (t) => t.assigneeId === currentUser?.id && !t.closedAt
    ).length
    const total = tickets.length
    return { open, closed, mine, total }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Projects</h1>
        <div className="flex-1" />
        <button
          onClick={() => router.push(`/${workspaceId}/projects/new`)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          + New Project
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-200" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 w-14 bg-gray-200 rounded-full" />
                </div>
                <div className="h-3 bg-gray-100 rounded mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
                <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                  <div className="flex-1 bg-gray-200" />
                  <div className="flex-1 bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-sm">
              <p className="text-gray-500 mb-4">No projects yet</p>
              <button
                onClick={() => router.push(`/${workspaceId}/projects/new`)}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium hover:underline"
              >
                + New Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {projects.map((project, idx) => {
              const stats = getStats(idx)
              const isStatsLoading = ticketQueries[idx]?.isLoading

              return (
                <div
                  key={project.id}
                  onClick={() =>
                    router.push(`/${workspaceId}/projects/${project.id}`)
                  }
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo-600">
                        {project.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 flex-1 truncate">
                      {project.name}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        project.visibility === 'PUBLIC'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {project.visibility === 'PUBLIC' ? 'Public' : 'Private'}
                    </span>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Stats row */}
                  {isStatsLoading ? (
                    <div className="flex gap-3 mb-3">
                      <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                      <span>
                        <span className="font-semibold text-gray-800">{stats.open}</span> open
                      </span>
                      <span className="text-gray-200">|</span>
                      <span>
                        <span className="font-semibold text-gray-800">{stats.closed}</span> done
                      </span>
                      {stats.mine > 0 && (
                        <>
                          <span className="text-gray-200">|</span>
                          <span className="text-indigo-600 font-medium">
                            {stats.mine} assigned to me
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  {isStatsLoading ? (
                    <div className="h-1.5 rounded-full bg-gray-100 animate-pulse" />
                  ) : stats.total === 0 ? (
                    <div className="h-1.5 rounded-full bg-gray-100" />
                  ) : (
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                      {/* open (indigo) */}
                      {stats.open > 0 && (
                        <div
                          className="bg-indigo-400 h-full"
                          style={{ width: `${(stats.open / stats.total) * 100}%` }}
                        />
                      )}
                      {/* closed (emerald) */}
                      {stats.closed > 0 && (
                        <div
                          className="bg-emerald-400 h-full"
                          style={{ width: `${(stats.closed / stats.total) * 100}%` }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
