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

function IconifyIcon({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  return (
    <img
      src={`https://api.iconify.design/iconoir/${name}.svg?color=${encodeURIComponent(color)}`}
      alt=""
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  )
}

// IntelliJ-style two-tone glyphs (per design system spec)
function GlyphProjects() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="0" y="0" width="7" height="7" rx="1.2" fill="#8aabff"/>
      <rect x="9" y="0" width="7" height="7" rx="1.2" fill="#3574f0"/>
      <rect x="0" y="9" width="7" height="7" rx="1.2" fill="#3574f0"/>
      <rect x="9" y="9" width="7" height="7" rx="1.2" fill="#8aabff"/>
    </svg>
  )
}
function GlyphTickets() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="0" y="2" width="16" height="12" rx="2" fill="#334155"/>
      <path d="M3.5 8l2.5 2.5L12 4.5" stroke="#3fb950" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function GlyphWorkload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M9 0L0 10h5l-2 6L14 6H8.5z" fill="#f59e0b"/>
    </svg>
  )
}
function GlyphHealth() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 14s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" fill="#ec4899"/>
    </svg>
  )
}
function GlyphBlocked() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="none" stroke="#ef4444" strokeWidth="1.5"/>
      <path d="M3.5 3.5l9 9" stroke="#ef4444" strokeWidth="1.5"/>
    </svg>
  )
}
function GlyphSkill() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="#1e293b" stroke="#a78bfa" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="2.5" fill="#a78bfa"/>
    </svg>
  )
}
function GlyphMembers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="5" cy="6" r="2.5" fill="#10b981"/>
      <circle cx="11" cy="6" r="2.5" fill="#06b6d4"/>
      <path d="M1 14a4 4 0 014-4h6a4 4 0 014 4" fill="#475569"/>
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
  { label: 'Projects',          path: 'projects',          icon: <GlyphProjects />, pmOnly: false },
  { label: 'My tickets',        path: 'my-tickets',        icon: <GlyphTickets />,  pmOnly: false },
  { label: 'Workload',          path: 'workload',          icon: <GlyphWorkload />, pmOnly: true  },
  { label: 'Team health',       path: 'team-health',       icon: <GlyphHealth />,   pmOnly: true  },
  { label: 'Blocked decisions', path: 'blocked-decisions', icon: <GlyphBlocked />,  pmOnly: true  },
  { label: 'Skill profile',     path: 'skill-profile',     icon: <GlyphSkill />,    pmOnly: false },
  { label: 'Members',           path: 'settings/members',  icon: <GlyphMembers />,  pmOnly: false },
]

// ── Keyboard key badge ────────────────────────────────────────────────────────
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 28, height: 28, padding: '0 7px',
      background: '#f8fafc', border: '1px solid #e2e8f0',
      borderBottom: '2px solid #cbd5e1',
      borderRadius: 6, fontFamily: 'var(--font-geist-mono, monospace)',
      fontSize: 12, fontWeight: 500, color: '#334155', lineHeight: 1,
      whiteSpace: 'nowrap',
    }}>{children}</kbd>
  )
}

// ── Shortcut row ─────────────────────────────────────────────────────────────
function ShortcutRow({ label, keys }: { label: string; keys: React.ReactNode[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{keys}</div>
    </div>
  )
}

// ── Keyboard shortcuts modal ──────────────────────────────────────────────────
function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2, marginTop: 4 }}>{children}</div>
  )

  const nav: { label: string; keys: React.ReactNode[] }[] = [
    { label: 'Open command menu',  keys: [<Key key="cmd">⌘</Key>, <Key key="k">K</Key>] },
    { label: 'Go to Projects',     keys: [<Key key="g">G</Key>, <Key key="p">P</Key>] },
    { label: 'Go to My tickets',   keys: [<Key key="g">G</Key>, <Key key="t">T</Key>] },
    { label: 'Go to Workload',     keys: [<Key key="g">G</Key>, <Key key="w">W</Key>] },
    { label: 'Go to Members',      keys: [<Key key="g">G</Key>, <Key key="m">M</Key>] },
    { label: 'Toggle sidebar',     keys: [<Key key="cmd">⌘</Key>, <Key key="bs">\\</Key>] },
  ]
  const tickets: { label: string; keys: React.ReactNode[] }[] = [
    { label: 'Create ticket',          keys: [<Key key="c">C</Key>] },
    { label: 'Edit ticket',            keys: [<Key key="e">E</Key>] },
    { label: 'Close / reopen ticket',  keys: [<Key key="x">X</Key>] },
    { label: 'Search tickets',         keys: [<Key key="sl">/</Key>] },
    { label: 'Next ticket',            keys: [<Key key="j">J</Key>] },
    { label: 'Previous ticket',        keys: [<Key key="k">K</Key>] },
  ]
  const general: { label: string; keys: React.ReactNode[] }[] = [
    { label: 'Show this panel',  keys: [<Key key="q">?</Key>] },
    { label: 'Submit form',      keys: [<Key key="cmd">⌘</Key>, <Key key="enter">Enter</Key>] },
    { label: 'Close dialog',     keys: [<Key key="esc">Esc</Key>] },
  ]

  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ width: 640, maxWidth: '100%', background: 'white', borderRadius: 16, boxShadow: '0 25px 60px -12px rgba(15,23,42,0.35)', overflow: 'hidden', fontFamily: 'var(--font-geist-sans, system-ui)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          {/* >> icon */}
          <div style={{ display: 'flex', gap: 2, opacity: 0.5 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#3574f0" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" /></svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', flex: 1 }}>Keyboard shortcuts</h2>
          <button onMouseDown={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, lineHeight: 0, color: '#94a3b8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body — 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', padding: '20px 24px 16px' }}>
          {/* Left: Navigation */}
          <div>
            <SectionLabel>Navigation</SectionLabel>
            {nav.map(r => <ShortcutRow key={r.label} label={r.label} keys={r.keys} />)}
          </div>
          {/* Right: Tickets */}
          <div>
            <SectionLabel>Tickets</SectionLabel>
            {tickets.map(r => <ShortcutRow key={r.label} label={r.label} keys={r.keys} />)}
          </div>
        </div>

        {/* General — full width */}
        <div style={{ padding: '0 24px 20px' }}>
          <SectionLabel>General</SectionLabel>
          {general.map(r => <ShortcutRow key={r.label} label={r.label} keys={r.keys} />)}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f8fafc' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Press</span>
          <Key>?</Key>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>anytime to open this panel</span>
        </div>
      </div>
    </div>
  )
}

function AppSidebar({ workspaceId, onOpenKb }: { workspaceId: string; onOpenKb: () => void }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [wsOpen, setWsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const wsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    router.replace('/login')
  }

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
          <div className="w-5 h-5 rounded bg-cobalt-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
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
                  <div className="w-6 h-6 rounded-md bg-cobalt-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {initials}
                  </div>
                  <span className="flex-1 truncate text-left">{ws.name}</span>
                  {isCurrent && (
                    <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" className="text-cobalt-400 shrink-0">
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
              className={`mx-2 flex items-center gap-2.5 py-2 rounded-lg text-sm transition cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white font-medium pl-[10px] pr-3 border-l-2 border-cobalt-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 px-3'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-800 p-2 relative" ref={userMenuRef}>
        {/* Popover (opens upward) */}
        {userMenuOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 8,
            zIndex: 50,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 16px 40px -8px rgba(0,0,0,0.45)',
          }}>
            {/* Header */}
            <div style={{ padding: '10px 10px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#3574f0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {userInitials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.displayName ?? 'User'}
                </div>
                <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email ?? ''}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#1e3a5f', margin: '2px 4px 4px' }} />

            {/* Menu items */}
            {[
              { icon: 'user', label: 'Skill profile', action: () => { setUserMenuOpen(false); router.push(`/${workspaceId}/skill-profile`) } },
              { icon: 'data-transfer-both', label: 'Switch workspace', action: () => { setUserMenuOpen(false); router.push('/workspaces') } },
              { icon: 'settings', label: 'Account settings', action: () => { setUserMenuOpen(false); router.push(`/${workspaceId}/settings/account`) } },
              { icon: 'keyframes', label: 'Keyboard shortcuts', hint: '⌘K', action: () => { setUserMenuOpen(false); onOpenKb() } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 8, background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 13, color: '#cbd5e1',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <IconifyIcon name={item.icon} color="#64748b" size={15} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.hint && <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#475569' }}>{item.hint}</span>}
              </button>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: '#1e3a5f', margin: '4px 4px' }} />

            {/* Logout */}
            <button
              onClick={() => { setUserMenuOpen(false); handleLogout() }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 8, background: 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 13, color: '#f87171',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <IconifyIcon name="log-out" color="#f87171" size={15} />
              <span>Log out</span>
            </button>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          <div className="w-7 h-7 rounded-full bg-cobalt-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            {userInitials}
          </div>
          <span className="text-sm text-slate-300 truncate flex-1 text-left">
            {user?.displayName ?? 'User'}
          </span>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-slate-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </aside>
  )
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceId: string }>()
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId)
  const [kbOpen, setKbOpen] = useState(false)

  useEffect(() => {
    setActiveWorkspaceId(params.workspaceId)
    return () => setActiveWorkspaceId(null)
  }, [params.workspaceId, setActiveWorkspaceId])

  // Global keyboard shortcuts: ? or ⌘K opens the panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable
      if (editable) return
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setKbOpen(v => !v) }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setKbOpen(v => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-[calc(100vh-48px)]">
      <AppSidebar workspaceId={params.workspaceId} onOpenKb={() => setKbOpen(true)} />
      <div className="flex-1 overflow-y-auto">{children}</div>
      {kbOpen && <KeyboardShortcutsModal onClose={() => setKbOpen(false)} />}
    </div>
  )
}
