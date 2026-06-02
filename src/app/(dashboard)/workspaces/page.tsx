'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueries } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import { useLang } from '@/lib/i18n'
import type { Workspace, WorkspaceMember } from '@/types'

// ── Accent palette cycling per workspace ─────────────────────────────────────
const ACCENTS = ['#3574f0', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#06b6d4']

// ── Workspace brand mark (graphite + accent bar + lime dot) ──────────────────
function WorkspaceMark({ accent, size = 46 }: { accent: string; size?: number }) {
  const r = Math.round((size / 64) * 14)
  const barX = Math.round((size / 64) * 18)
  const barW = Math.round((size / 64) * 14)
  const barH = Math.round((size / 64) * 34)
  const barY = Math.round((size / 64) * 14)
  const br   = Math.round((size / 64) * 2)
  const cx   = Math.round((size / 64) * 44)
  const cy   = Math.round((size / 64) * 18)
  const cr   = Math.round((size / 64) * 5)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, display: 'block' }}>
      <rect width={size} height={size} rx={r} fill="#0a0a0a" />
      <rect x={barX} y={barY} width={barW} height={barH} rx={br} fill={accent} />
      <circle cx={cx} cy={cy} r={cr} fill="#bef264" />
    </svg>
  )
}

// ── Stacked mini avatars ──────────────────────────────────────────────────────
function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  const COLORS = ['#3574f0','#7c3aed','#10b981','#f59e0b','#ec4899','#ef4444','#06b6d4']
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((n, i) => {
        const bg = COLORS[(n.charCodeAt(0) ?? 0) % COLORS.length]
        return (
          <div key={n + i} style={{
            marginLeft: i === 0 ? 0 : -8,
            width: 26, height: 26, borderRadius: 9999,
            background: bg, color: 'white', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px white', zIndex: shown.length - i,
          }}>
            {(n.split(' ').map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase()}
          </div>
        )
      })}
      {extra > 0 && (
        <div style={{
          marginLeft: -8, width: 26, height: 26, borderRadius: 9999,
          background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 2px white',
        }}>+{extra}</div>
      )}
    </div>
  )
}

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2)  return 'active now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Role pill ─────────────────────────────────────────────────────────────────
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:     { bg: '#eef4ff', color: '#2454d6' },
  PM:        { bg: '#ede9fe', color: '#6d28d9' },
  DEVELOPER: { bg: '#f1f5f9', color: '#475569' },
  Owner:     { bg: '#eef4ff', color: '#2454d6' },
}
function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.DEVELOPER
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
      background: s.bg, color: s.color, lineHeight: 1.5,
    }}>{role}</span>
  )
}

// ── Workspace row card ────────────────────────────────────────────────────────
interface WorkspaceRowProps {
  ws: Workspace
  accent: string
  selected: boolean
  role: string
  members: WorkspaceMember[]
  onSelect: () => void
  onHover: () => void
}

function WorkspaceRow({ ws, accent, selected, role, members, onSelect, onHover }: WorkspaceRowProps) {
  const active = relativeTime(ws.updatedAt)
  const isNow  = active === 'active now'
  const names  = members.map(m => m.displayName || m.email || '?')

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, width: '100%',
        textAlign: 'left', font: 'inherit', cursor: 'pointer',
        background: 'white',
        border: `1px solid ${selected ? '#3574f0' : '#e2e8f0'}`,
        borderRadius: 14, padding: '14px 16px',
        boxShadow: selected
          ? '0 0 0 3px rgba(53,116,240,0.15), 0 8px 18px -8px rgba(15,23,42,0.18)'
          : '0 1px 2px rgba(15,23,42,0.05)',
        transform: selected ? 'translateY(-1px)' : 'none',
        transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <WorkspaceMark accent={accent} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {ws.name}
          </span>
          <RolePill role={role} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#94a3b8',
        }}>
          {ws.slug && <span>{ws.slug}</span>}
          {ws.slug && <span style={{ width: 3, height: 3, borderRadius: 9999, background: '#cbd5e1', flexShrink: 0 }} />}
          {members.length > 0 && <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>}
          {members.length > 0 && <span style={{ width: 3, height: 3, borderRadius: 9999, background: '#cbd5e1', flexShrink: 0 }} />}
          <span style={{ color: isNow ? '#16a34a' : '#94a3b8' }}>{active}</span>
        </div>
      </div>

      {names.length > 0 && <AvatarStack names={names} />}

      {/* chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        style={{ color: selected ? '#2454d6' : '#cbd5e1', flexShrink: 0,
          transform: selected ? 'translateX(2px)' : 'none',
          transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function WorkspacesPage() {
  const router      = useRouter()
  const user        = useAuthStore((s) => s.user)
  const { t }       = useLang()
  const [sel, setSel] = useState(0)

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: queryKeys.workspaces.all(),
    queryFn: () => apiClient.get<{ data: Workspace[] }>('/workspaces').then(r => r.data.data),
  })

  // Auto-redirect when only 0 or 1 workspace
  useEffect(() => {
    if (isLoading || workspaces === undefined) return
    if (workspaces.length === 0) router.replace('/workspaces/new')
    else if (workspaces.length === 1) router.replace(`/${workspaces[0].id}`)
  }, [workspaces, isLoading, router])

  // Fetch members for each workspace in parallel
  const memberQueries = useQueries({
    queries: workspaces.map(ws => ({
      queryKey: queryKeys.workspaces.members(ws.id),
      queryFn: () => apiClient
        .get<{ data: WorkspaceMember[] }>(`/workspaces/${ws.id}/members`)
        .then(r => r.data.data),
      staleTime: 60_000,
    })),
  })

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, workspaces.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); if (workspaces[sel]) router.push(`/${workspaces[sel].id}`) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sel, workspaces, router])

  if (isLoading || workspaces.length <= 1) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-2 border-cobalt-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cobalt radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(at 50% -10%, rgba(53,116,240,0.10), transparent 55%)',
      }} />

      {/* Top bar */}
      <header style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '20px 28px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <WorkspaceMark accent="#3574f0" size={28} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            unity_skill
          </span>
        </div>
        {/* User */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                {user.displayName || user.email}
              </div>
              <button
                onClick={() => router.push('/login')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#94a3b8' }}
              >
                sign out
              </button>
            </div>
            {(() => {
              const name = user.displayName || user.email || '?'
              const COLORS = ['#3574f0','#7c3aed','#10b981','#f59e0b','#ec4899','#ef4444']
              const bg = COLORS[(name.charCodeAt(0) ?? 0) % COLORS.length]
              return (
                <div style={{ width: 34, height: 34, borderRadius: 9999, background: bg,
                  color: 'white', fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || '?').toUpperCase()}
                </div>
              )
            })()}
          </div>
        )}
      </header>

      {/* Main content */}
      <main style={{ position: 'relative', maxWidth: 620, margin: '0 auto', padding: '36px 24px 64px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.15em', color: '#2454d6', marginBottom: 10,
          }}>
            {t('ws.welcome')}
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: '#0f172a',
            letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {t('ws.choosetitle')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, color: '#64748b', lineHeight: 1.5 }}>
            {t('ws.belongs')} {workspaces.length} {t('ws.workspaces')}. {t('ws.pickone')}
          </p>
        </div>

        {/* Workspace list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {workspaces.map((ws, i) => {
            const members  = memberQueries[i]?.data ?? []
            const accent   = ACCENTS[i % ACCENTS.length]
            const myMember = members.find(m => m.userId === user?.id)
            const role     = ws.createdBy === user?.id
              ? 'Owner'
              : (myMember?.role ?? 'Member')

            return (
              <WorkspaceRow
                key={ws.id}
                ws={ws}
                accent={accent}
                selected={sel === i}
                role={role}
                members={members}
                onSelect={() => router.push(`/${ws.id}`)}
                onHover={() => setSel(i)}
              />
            )
          })}
        </div>

        {/* Create new */}
        <button
          onClick={() => router.push('/workspaces/new')}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3574f0'
            e.currentTarget.style.background  = '#f8faff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.background  = 'transparent'
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            marginTop: 14, background: 'transparent', cursor: 'pointer', font: 'inherit',
            border: '1px dashed #cbd5e1', borderRadius: 14, padding: '14px 16px',
            color: '#475569', transition: 'all 160ms ease-out',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            border: '1px dashed #cbd5e1', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{t('ws.createnew')}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {t('ws.createsub')}
            </div>
          </div>
        </button>

        {/* Keyboard hint */}
        <p style={{
          marginTop: 20, textAlign: 'center',
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: 11, color: '#94a3b8',
        }}>
          <kbd style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4,
            padding: '1px 5px', fontSize: 10 }}>↑</kbd>
          {' '}<kbd style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4,
            padding: '1px 5px', fontSize: 10 }}>↓</kbd>
          {' navigate · '}
          <kbd style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4,
            padding: '1px 5px', fontSize: 10 }}>↵</kbd>
          {' open'}
        </p>
      </main>
    </div>
  )
}
