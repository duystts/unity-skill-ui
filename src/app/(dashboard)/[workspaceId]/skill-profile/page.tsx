'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import type { Ticket, Project } from '@/types'

interface SkillEvidenceItem {
  id: string
  skillCategory: string
  aiSummary: string
  developerNotes: string | null
  reviewedAt: string | null
  createdAt: string
  isPublished: boolean
}

interface SkillCategoryGroup {
  skillCategory: string
  count: number
  items: SkillEvidenceItem[]
}

interface SkillProfileData {
  totalApproved: number
  categories: SkillCategoryGroup[]
}

interface PendingEvidence {
  id: string
  skillCategory: string
  aiSummary: string
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
]

function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return (name ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

const SKILL_COLORS: Record<string, string> = {
  'Backend Development':  'bg-blue-100 text-blue-700',
  'Frontend Development': 'bg-violet-100 text-violet-700',
  'Problem Solving':      'bg-amber-100 text-amber-700',
  'Code Review':          'bg-green-100 text-green-700',
  'Architecture':         'bg-rose-100 text-rose-700',
  'DevOps':               'bg-orange-100 text-orange-700',
  'Testing':              'bg-teal-100 text-teal-700',
}

const FALLBACK_SKILL_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
]

function skillColor(name: string, idx: number) {
  return SKILL_COLORS[name] ?? FALLBACK_SKILL_COLORS[idx % FALLBACK_SKILL_COLORS.length]
}

const PROJECT_BAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
]

export default function SkillProfilePage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id

  // ── Data fetching ──────────────────────────────────────────
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.portfolio.private(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: SkillProfileData }>(`/workspaces/${workspaceId}/skill-profile`)
        .then((r) => r.data.data),
  })

  const { data: pendingEvidence = [] } = useQuery({
    queryKey: ['skill-evidences', workspaceId, 'pending'],
    queryFn: () =>
      apiClient
        .get<{ data: PendingEvidence[] }>(`/workspaces/${workspaceId}/skill-evidences?status=PENDING`)
        .then((r) => r.data.data),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ evidenceId, action }: { evidenceId: string; action: string }) =>
      apiClient.patch(`/workspaces/${workspaceId}/skill-evidences/${evidenceId}`, { action }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.private(workspaceId) })
      queryClient.invalidateQueries({ queryKey: ['skill-evidences', workspaceId, 'pending'] })
    },
  })

  // ── Derived data ───────────────────────────────────────────
  const projectMap = new Map(projects.map((p) => [p.id, p]))

  // Group tickets by project
  const byProject = tickets.reduce<Record<string, Ticket[]>>((acc, t) => {
    if (!acc[t.projectId]) acc[t.projectId] = []
    acc[t.projectId].push(t)
    return acc
  }, {})

  const projectStats = Object.entries(byProject).map(([projectId, pts]) => {
    const project = projectMap.get(projectId)
    const done = pts.filter((t) => !!t.closedAt).length
    const total = pts.length
    return { projectId, project, done, total, open: total - done }
  }).sort((a, b) => b.total - a.total)

  const totalDone    = tickets.filter((t) => !!t.closedAt).length
  const totalTickets = tickets.length
  const totalProjects = projectStats.length
  const categories   = profile?.categories ?? []
  const totalApproved = profile?.totalApproved ?? 0

  const displayName = user?.displayName || user?.email || 'You'

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">

      {/* ── Profile header ── */}
      <div className="border-b border-[#30363d] bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start gap-6 flex-wrap">

            {/* Avatar */}
            <div className={`w-20 h-20 rounded-full ${avatarColor(displayName)} flex items-center justify-center text-2xl font-bold text-white shrink-0 ring-4 ring-[#30363d]`}>
              {initials(displayName)}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              {user?.email && (
                <p className="text-[#8b949e] text-sm mt-0.5">{user.email}</p>
              )}

              {/* Summary stats row */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm text-[#8b949e]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
                  </svg>
                  <strong className="text-white">{totalProjects}</strong> projects
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[#8b949e]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                  </svg>
                  <strong className="text-white">{totalDone}</strong> tickets closed
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[#8b949e]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                    <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                  </svg>
                  <strong className="text-white">{totalTickets - totalDone}</strong> open
                </span>
                {totalApproved > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-[#8b949e]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                      <path fillRule="evenodd" d="M9.585.52a2.678 2.678 0 00-3.17 0l-.928.68a1.178 1.178 0 01-.518.215L3.83 1.59a2.678 2.678 0 00-2.24 2.24l-.175 1.14a1.178 1.178 0 01-.215.518l-.68.928a2.678 2.678 0 000 3.17l.68.928c.113.153.186.33.215.518l.175 1.14a2.678 2.678 0 002.24 2.24l1.14.175c.187.029.365.102.518.215l.928.68a2.678 2.678 0 003.17 0l.928-.68a1.18 1.18 0 01.518-.215l1.14-.175a2.678 2.678 0 002.24-2.24l.175-1.14c.029-.187.102-.365.215-.518l.68-.928a2.678 2.678 0 000-3.17l-.68-.928a1.178 1.178 0 01-.215-.518L14.41 3.83a2.678 2.678 0 00-2.24-2.24l-1.14-.175a1.178 1.178 0 01-.518-.215L9.585.52zM7.303 1.728a1.178 1.178 0 011.394 0l.928.68c.348.256.752.423 1.18.489l1.14.175a1.178 1.178 0 01.986.986l.175 1.14c.066.428.233.832.489 1.18l.68.928a1.178 1.178 0 010 1.394l-.68.928a2.678 2.678 0 00-.489 1.18l-.175 1.14a1.178 1.178 0 01-.986.986l-1.14.175a2.678 2.678 0 00-1.18.489l-.928.68a1.178 1.178 0 01-1.394 0l-.928-.68a2.678 2.678 0 00-1.18-.489l-1.14-.175a1.178 1.178 0 01-.986-.986l-.175-1.14a2.678 2.678 0 00-.489-1.18l-.68-.928a1.178 1.178 0 010-1.394l.68-.928c.256-.348.423-.752.489-1.18l.175-1.14a1.178 1.178 0 01.986-.986l1.14-.175a2.678 2.678 0 001.18-.489l.928-.68zM11.28 6.78a.75.75 0 00-1.06-1.06L7 8.94 5.78 7.72a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.75-3.75z"/>
                    </svg>
                    <strong className="text-white">{totalApproved}</strong> skill evidence
                  </span>
                )}
              </div>
            </div>

            {/* Public portfolio link */}
            <a
              href={`/portfolio/${userId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm text-[#c9d1d9] border border-[#30363d] rounded-md px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] transition"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Public portfolio
            </a>
          </div>

          {/* Skill badges */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {categories.map((c, i) => (
                <span key={c.skillCategory} className={`text-xs font-medium px-2.5 py-1 rounded-full ${skillColor(c.skillCategory, i)}`}>
                  {c.skillCategory} · {c.count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Pending review ── */}
        {pendingEvidence.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-[#c9d1d9]">
                Pending Review
                <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold px-2 py-0.5 rounded-full">
                  {pendingEvidence.length}
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {pendingEvidence.map((item) => (
                <div key={item.id} className="flex items-start gap-3 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full mb-1.5">
                      {item.skillCategory}
                    </span>
                    <p className="text-sm text-[#c9d1d9] leading-relaxed">{item.aiSummary}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => reviewMutation.mutate({ evidenceId: item.id, action: 'APPROVE' })}
                      disabled={reviewMutation.isPending}
                      className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ evidenceId: item.id, action: 'REJECT' })}
                      disabled={reviewMutation.isPending}
                      className="text-xs text-[#8b949e] hover:text-red-400 border border-[#30363d] hover:border-red-500/30 px-2.5 py-1 rounded-md transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Project contributions ── */}
        <section>
          <h2 className="text-sm font-semibold text-[#c9d1d9] mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
              <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
            </svg>
            Project Contributions
          </h2>

          {ticketsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-[#21262d] rounded w-1/3 mb-3" />
                  <div className="h-2 bg-[#21262d] rounded w-full" />
                </div>
              ))}
            </div>
          ) : projectStats.length === 0 ? (
            <div className="bg-[#161b22] border border-dashed border-[#30363d] rounded-lg p-10 text-center">
              <p className="text-[#8b949e] text-sm">No tickets assigned yet</p>
              <p className="text-[#8b949e] text-xs mt-1">Ask your PM to assign tickets or claim an Open Pool ticket</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectStats.map(({ projectId, project, done, total, open }, idx) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                const barColor = PROJECT_BAR_COLORS[idx % PROJECT_BAR_COLORS.length]
                return (
                  <div
                    key={projectId}
                    className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#8b949e] transition"
                  >
                    {/* Project name + key */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded">
                            {project?.keyPrefix ?? '??'}
                          </span>
                          <span className="text-sm font-semibold text-[#58a6ff] truncate">
                            {project?.name ?? projectId.slice(0, 12)}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8b949e] shrink-0">
                        {done}/{total}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-[#21262d] rounded-full h-1.5 mb-2.5">
                      <div
                        className={`h-1.5 rounded-full ${barColor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[11px] text-[#8b949e]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {done} closed
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#388bfd] inline-block" />
                        {open} open
                      </span>
                      <span className="ml-auto font-medium text-[#c9d1d9]">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Skill evidence (approved) ── */}
        {(profileLoading || categories.length > 0) && (
          <section>
            <h2 className="text-sm font-semibold text-[#c9d1d9] mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                <path fillRule="evenodd" d="M9.585.52a2.678 2.678 0 00-3.17 0l-.928.68a1.178 1.178 0 01-.518.215L3.83 1.59a2.678 2.678 0 00-2.24 2.24l-.175 1.14a1.178 1.178 0 01-.215.518l-.68.928a2.678 2.678 0 000 3.17l.68.928c.113.153.186.33.215.518l.175 1.14a2.678 2.678 0 002.24 2.24l1.14.175c.187.029.365.102.518.215l.928.68a2.678 2.678 0 003.17 0l.928-.68a1.18 1.18 0 01.518-.215l1.14-.175a2.678 2.678 0 002.24-2.24l.175-1.14c.029-.187.102-.365.215-.518l.68-.928a2.678 2.678 0 000-3.17l-.68-.928a1.178 1.178 0 01-.215-.518L14.41 3.83a2.678 2.678 0 00-2.24-2.24l-1.14-.175a1.178 1.178 0 01-.518-.215L9.585.52zM11.28 6.78a.75.75 0 00-1.06-1.06L7 8.94 5.78 7.72a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.75-3.75z"/>
              </svg>
              Verified Skills
            </h2>

            {profileLoading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 animate-pulse">
                    <div className="h-3 bg-[#21262d] rounded w-1/4 mb-2" />
                    <div className="h-3 bg-[#21262d] rounded w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((group, idx) => (
                  <details
                    key={group.skillCategory}
                    className="bg-[#161b22] border border-[#30363d] rounded-lg group open:border-[#8b949e] transition"
                  >
                    <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-[#21262d] rounded-lg transition">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${skillColor(group.skillCategory, idx)}`}>
                        {group.skillCategory}
                      </span>
                      <span className="text-xs text-[#8b949e]">{group.count} evidence{group.count !== 1 ? 's' : ''}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ml-auto text-[#8b949e] group-open:rotate-180 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <ul className="px-4 pb-3 pt-1 space-y-2 border-t border-[#30363d]">
                      {group.items.map((item) => (
                        <li key={item.id} className="pt-2">
                          <p className="text-sm text-[#c9d1d9] leading-relaxed">
                            {item.developerNotes ?? item.aiSummary}
                          </p>
                          {item.reviewedAt && (
                            <p className="text-[11px] text-[#8b949e] mt-0.5">
                              {new Date(item.reviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {item.isPublished && <span className="ml-2 text-green-500">· public</span>}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Empty state ── */}
        {!ticketsLoading && !profileLoading && projectStats.length === 0 && categories.length === 0 && pendingEvidence.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="text-[#8b949e]">
                <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
              </svg>
            </div>
            <p className="text-[#8b949e] text-sm">No activity yet</p>
            <p className="text-[#8b949e] text-xs mt-1">Get assigned to tickets and connect GitHub to start building your profile</p>
          </div>
        )}

      </div>
    </div>
  )
}
