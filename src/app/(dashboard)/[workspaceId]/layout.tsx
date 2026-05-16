'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { apiClient } from '@/lib/apiClient'
import type { Workspace, WorkspaceMember } from '@/types'

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
  { label: 'Projects',          path: 'projects',          icon: <IconGrid />,    pmOnly: false },
  { label: 'My tickets',        path: 'my-tickets',        icon: <IconCheck />,   pmOnly: false },
  { label: 'Workload',          path: 'workload',          icon: <IconBolt />,    pmOnly: true  },
  { label: 'Team health',       path: 'team-health',       icon: <IconSparkle />, pmOnly: true  },
  { label: 'Blocked decisions', path: 'blocked-decisions', icon: <IconX />,       pmOnly: true  },
  { label: 'Skill profile',     path: 'skill-profile',     icon: <IconEye />,     pmOnly: false },
  { label: 'Members',           path: 'settings/members',  icon: <IconUsers />,   pmOnly: false },
]

function AppSidebar({ workspaceId }: { workspaceId: string }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const user      = useAuthStore((s) => s.user)
  const [wsOpen, setWsOpen] = useState(false)
  const wsRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: allWorkspaces = [] } = useQuery({
    queryKey: queryKeys.workspaces.all(),
    queryFn: () =>
      apiClient
        .get<{ data: Workspace[] }>('/workspaces')
        .then((r) => r.data.data),
    staleTime: 60_000,
  })

  const workspace = allWorkspaces.find((w) => w.id === workspaceId)

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`)
        .then((r) => r.data.data),
    staleTime: 60_000,
  })

  const myRole = members.find((m) => m.userId === user?.id)?.role
  const isPmOrAdmin = myRole === 'PM' || myRole === 'ADMIN'

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
      {/* Workspace switcher */}
      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        Workspace
      </div>
      <div className="relative mx-2 mb-2" ref={wsRef}>
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition text-sm"
        >
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {workspaceInitials}
          </div>
          <span className="flex-1 truncate text-left">{workspace?.name ?? workspaceId.slice(0, 12)}</span>
          <svg
            width="12" height="12" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
            className={`shrink-0 transition-transform ${wsOpen ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {wsOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Switch workspace
            </div>
            {allWorkspaces.map((ws) => {
              const initials = ws.name.slice(0, 2).toUpperCase()
              const isCurrent = ws.id === workspaceId
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    setWsOpen(false)
                    if (!isCurrent) router.push(`/${ws.id}/projects`)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition ${
                    isCurrent
                      ? 'bg-slate-700 text-white cursor-default'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {initials}
                  </div>
                  <span className="flex-1 truncate text-left">{ws.name}</span>
                  {isCurrent && (
                    <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" className="text-indigo-400 shrink-0">
                      <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z"/>
                    </svg>
                  )}
                </button>
              )
            })}
            <div className="border-t border-slate-700 mt-1">
              <button
                onClick={() => { setWsOpen(false); router.push('/workspaces/new') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <div className="w-6 h-6 rounded-md border border-dashed border-slate-600 flex items-center justify-center shrink-0">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span>New workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="px-4 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        Menu
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.filter((item) => !item.pmOnly || isPmOrAdmin).map((item) => {
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
