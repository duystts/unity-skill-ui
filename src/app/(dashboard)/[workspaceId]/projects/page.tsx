'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import type { Project, Ticket } from '@/types'

type Tab = 'active' | 'archived'

function ProjectSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-200" />
        <div className="h-4 bg-gray-200 rounded flex-1" />
        <div className="h-4 w-14 bg-gray-200 rounded-full" />
      </div>
      <div className="h-3 bg-gray-100 rounded mb-1.5" />
      <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
      <div className="h-1.5 rounded-full bg-gray-200" />
    </div>
  )
}

export default function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId
  const router = useRouter()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const [tab, setTab] = useState<Tab>('active')

  // ── Active projects ────────────────────────────────────────
  const { data: activeData, isLoading: isLoadingActive } = useQuery({
    queryKey: queryKeys.projects.all(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects`)
        .then((r) => r.data.data),
  })
  const activeProjects = activeData ?? []

  // ── Archived projects ──────────────────────────────────────
  const { data: archivedData, isLoading: isLoadingArchived } = useQuery({
    queryKey: queryKeys.projects.archived(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects?archived=true`)
        .then((r) => r.data.data),
    enabled: tab === 'archived',
  })
  const archivedProjects = archivedData ?? []

  // ── Ticket stats for active projects ───────────────────────
  const ticketQueries = useQueries({
    queries: activeProjects.map((project) => ({
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
    return { open, closed, mine, total: tickets.length }
  }

  // ── Unarchive mutation ─────────────────────────────────────
  const unarchiveMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiClient.patch(`/workspaces/${workspaceId}/projects/${projectId}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.archived(workspaceId) })
      toast.success('Project restored')
    },
    onError: () => toast.error('Failed to restore project'),
  })

  const projects = tab === 'active' ? activeProjects : archivedProjects
  const isLoading = tab === 'active' ? isLoadingActive : isLoadingArchived

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── TopBar ── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Projects</h1>
        <div className="flex-1" />
        <button
          onClick={() => router.push(`/${workspaceId}/projects/new`)}
          className="px-3 py-1.5 text-sm bg-cobalt-600 text-white rounded-lg hover:bg-cobalt-700 transition font-medium"
        >
          + New Project
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-6 pt-4 pb-0 bg-slate-50 shrink-0">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
            tab === 'active'
              ? 'border-cobalt-600 text-cobalt-700 bg-white'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Active
          {activeProjects.length > 0 && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === 'active' ? 'bg-cobalt-100 text-cobalt-700' : 'bg-gray-100 text-gray-500'}`}>
              {activeProjects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
            tab === 'archived'
              ? 'border-gray-400 text-gray-700 bg-white'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archived
          {archivedData && archivedData.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
              {archivedData.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProjectSkeleton />
            <ProjectSkeleton />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-sm">
              {tab === 'active' ? (
                <>
                  <p className="text-gray-500 mb-4">No active projects yet</p>
                  <button
                    onClick={() => router.push(`/${workspaceId}/projects/new`)}
                    className="text-cobalt-600 hover:text-cobalt-700 text-sm font-medium hover:underline"
                  >
                    + New Project
                  </button>
                </>
              ) : (
                <p className="text-gray-400 text-sm">No archived projects</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {projects.map((project, idx) => {
              const isArchived = tab === 'archived'
              const stats = !isArchived ? getStats(idx) : null
              const isStatsLoading = !isArchived && ticketQueries[idx]?.isLoading

              return (
                <div
                  key={project.id}
                  onClick={() =>
                    !isArchived && router.push(`/${workspaceId}/projects/${project.id}`)
                  }
                  className={`bg-white border rounded-xl p-4 transition ${
                    isArchived
                      ? 'border-gray-200 opacity-75 cursor-default'
                      : 'border-gray-200 cursor-pointer hover:border-cobalt-300 hover:shadow-sm'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isArchived ? 'bg-gray-100' : 'bg-cobalt-50'}`}>
                      <span className={`text-sm font-bold ${isArchived ? 'text-gray-400' : 'text-cobalt-600'}`}>
                        {project.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className={`font-semibold flex-1 truncate ${isArchived ? 'text-gray-500' : 'text-gray-900'}`}>
                      {project.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isArchived && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 flex items-center gap-1">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Archived
                        </span>
                      )}
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
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Stats (active only) */}
                  {!isArchived && (
                    <>
                      {isStatsLoading ? (
                        <div className="flex gap-3 mb-3">
                          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                          <span>
                            <span className="font-semibold text-gray-800">{stats!.open}</span> open
                          </span>
                          <span className="text-gray-200">|</span>
                          <span>
                            <span className="font-semibold text-gray-800">{stats!.closed}</span> done
                          </span>
                          {stats!.mine > 0 && (
                            <>
                              <span className="text-gray-200">|</span>
                              <span className="text-cobalt-600 font-medium">
                                {stats!.mine} assigned to me
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {isStatsLoading ? (
                        <div className="h-1.5 rounded-full bg-gray-100 animate-pulse" />
                      ) : stats!.total === 0 ? (
                        <div className="h-1.5 rounded-full bg-gray-100" />
                      ) : (
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                          {stats!.open > 0 && (
                            <div className="bg-cobalt-400 h-full" style={{ width: `${(stats!.open / stats!.total) * 100}%` }} />
                          )}
                          {stats!.closed > 0 && (
                            <div className="bg-emerald-400 h-full" style={{ width: `${(stats!.closed / stats!.total) * 100}%` }} />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Archived: restore button + archived date */}
                  {isArchived && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">
                        Archived {new Date(project.archivedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <button
                        className="text-xs text-cobalt-600 hover:text-cobalt-800 font-medium px-2.5 py-1 rounded-lg hover:bg-cobalt-50 transition disabled:opacity-50"
                        disabled={unarchiveMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          unarchiveMutation.mutate(project.id)
                        }}
                      >
                        Restore
                      </button>
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
