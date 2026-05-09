'use client'

import { useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { Workspace } from '@/types'

// Icons as simple SVGs
function IconGrid() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconBolt() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
function IconSparkle() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l1.5 4.5L11 9l-4.5 1.5L5 15l-1.5-4.5L-1 9l4.5-1.5L5 3zM19 11l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    </svg>
  )
}
function IconX() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconEye() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconChevronRight() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

const NAV_ITEMS = [
  { label: 'Projects', path: 'projects', icon: <IconGrid /> },
  { label: 'My tickets', path: 'my-tickets', icon: <IconCheck /> },
  { label: 'Workload', path: 'workload', icon: <IconBolt /> },
  { label: 'Team health', path: 'team-health', icon: <IconSparkle /> },
  { label: 'Blocked decisions', path: 'blocked-decisions', icon: <IconX /> },
  { label: 'Skill profile', path: 'skill-profile', icon: <IconEye /> },
  { label: 'Members', path: 'settings/members', icon: <IconUsers /> },
]

function AppSidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () =>
      apiClient
        .get<{ data: Workspace }>(`/workspaces/${workspaceId}`)
        .then((r) => r.data.data),
    staleTime: 60_000,
  })

  const workspaceInitials = workspace?.name
    ? workspace.name.slice(0, 2).toUpperCase()
    : workspaceId.slice(0, 2).toUpperCase()

  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  return (
    <aside className="w-52 shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-3 text-sm font-bold text-white tracking-tight">
        unity_skill
      </div>

      {/* Workspace section */}
      <div className="px-4 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        Workspace
      </div>
      <div className="mx-2 mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-sm">
        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          {workspaceInitials}
        </div>
        <span className="flex-1 truncate">{workspace?.name ?? workspaceId.slice(0, 12)}</span>
        <IconChevronRight />
      </div>

      {/* Nav */}
      <div className="px-4 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        Menu
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.map((item) => {
          const href = `/${workspaceId}/${item.path}`
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={item.path}
              href={href}
              className={`mx-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-800 p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {userInitials}
        </div>
        <span className="text-sm text-slate-300 truncate flex-1">
          {user?.displayName ?? 'User'}
        </span>
      </div>
    </aside>
  )
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceId: string }>()
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId)

  useEffect(() => {
    setActiveWorkspaceId(params.workspaceId)
    return () => setActiveWorkspaceId(null)
  }, [params.workspaceId, setActiveWorkspaceId])

  return (
    <div className="flex h-[calc(100vh-48px)]">
      <AppSidebar workspaceId={params.workspaceId} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
