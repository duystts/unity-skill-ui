'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { apiClient } from '@/lib/apiClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

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

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface NotifItem {
  id: string
  type: string
  payload: string
  read: boolean
  createdAt: string
  workspaceId: string
}

function notifLabel(n: NotifItem): { icon: string; text: string; sub?: string; href?: string } {
  try {
    const p = JSON.parse(n.payload)
    const ws = n.workspaceId
    switch (n.type) {
      case 'TICKET_ASSIGNED':
        return {
          icon: '🎫',
          text: p.ticketCode ? `${p.ticketCode} — ${p.title ?? 'ticket'}` : (p.title ?? 'You were assigned a ticket'),
          sub: 'Assigned to you',
          href: p.projectId ? `/${ws}/projects/${p.projectId}` : `/${ws}/my-tickets`,
        }
      case 'ACHIEVEMENT_EARNED':
        return {
          icon: '🏅',
          text: `Achievement unlocked: ${p.title ?? p.key ?? ''}`,
          href: `/${ws}/skill-profile`,
        }
      case 'SKILL_EVIDENCE_PENDING':
        return {
          icon: '🔍',
          text: `New skill evidence ready`,
          sub: p.skillCategory ?? '',
          href: `/${ws}/skill-profile`,
        }
      case 'STAGE_CHANGED':
      case 'TICKET_STAGE_CHANGED':
        return {
          icon: '📋',
          text: p.toStageName ? `Ticket moved to ${p.toStageName}` : 'Ticket stage updated',
          href: p.projectId ? `/${ws}/projects/${p.projectId}` : undefined,
        }
      default:
        return { icon: '🔔', text: n.type.replace(/_/g, ' ').toLowerCase() }
    }
  } catch {
    return { icon: '🔔', text: n.type }
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // 'pending'  — chưa biết có session không (F5 vừa xảy ra)
  // 'ok'       — đã có token hợp lệ
  // 'rejected' — refresh thất bại, sẽ redirect login
  const [sessionState, setSessionState] = useState<'pending' | 'ok' | 'rejected'>('pending')

  useWebSocket()

  // ── Notifications ───────────────────────────────────────────────────────────
  const { data: notifData } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => apiClient.get<{ data: NotifItem[]; pagination: { total: number } }>('/notifications?size=20').then(r => r.data),
    refetchInterval: 30_000,
    enabled: !!user,
  })
  const notifications: NotifItem[] = notifData?.data ?? []
  const unreadCount = notifications.filter(n => !n.read).length

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
  })

  // Close bell on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Silent restore: chạy 1 lần duy nhất khi mount ──────────────────────────
  useEffect(() => {
    // Nếu đã có token trong memory (navigate bình thường, không phải F5)
    if (accessToken && user) {
      setSessionState('ok')
      return
    }

    // Không có token (hoặc user chưa load) → thử refresh bằng HttpOnly cookie
    axios
      .post(`${BASE_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then(async (res) => {
        const newToken = res.data?.data?.accessToken
        if (!newToken) {
          clearAuth()
          setSessionState('rejected')
          return
        }
        setAccessToken(newToken)
        // Fetch user nếu chưa có (vd: sau GitHub OAuth redirect)
        if (!user) {
          try {
            const meRes = await axios.get(`${BASE_URL}/api/v1/users/me`, {
              headers: { Authorization: `Bearer ${newToken}` },
            })
            const fetchedUser = meRes.data?.data
            if (fetchedUser) useAuthStore.getState().setUser(fetchedUser)
          } catch {
            // user fetch thất bại — vẫn cho vào, page con sẽ handle
          }
        }
        setSessionState('ok')
      })
      .catch(() => {
        clearAuth()
        setSessionState('rejected')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // chỉ chạy 1 lần khi mount

  // ── Sau khi restore xong, kiểm tra auth + consent ──────────────────────────
  useEffect(() => {
    if (sessionState === 'pending') return

    if (sessionState === 'rejected') {
      router.replace('/login')
      return
    }

    // Kiểm tra consent
    apiClient.get('/users/me/preferences').catch((error: any) => {
      if (
        error.response?.status === 403 &&
        error.response?.data?.error === 'CONSENT_REQUIRED'
      ) {
        router.replace('/consent')
      }
    })
  }, [sessionState, user, router])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore
    }
    clearAuth()
    router.replace('/login')
  }

  // ── Loading screen khi đang restore session ─────────────────────────────────
  if (sessionState === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-cobalt-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Restoring session…</p>
        </div>
      </div>
    )
  }

  // user có thể null vài ms sau khi fetch xong — hiện spinner thay vì crash
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-6 h-6 border-2 border-cobalt-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top nav bar ── */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <Link
          href="/workspaces"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-cobalt-600 hover:bg-cobalt-50 transition group"
        >
          <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" className="shrink-0">
            <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"/>
          </svg>
          <span className="text-xs font-semibold">All workspaces</span>
        </Link>
        <div className="flex items-center gap-1">
        {/* ── Notification bell ── */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => { setBellOpen(v => !v); if (!bellOpen && unreadCount > 0) markAllReadMutation.mutate() }}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50" style={{ boxShadow: '0 16px 40px -8px rgba(0,0,0,0.18)' }}>
              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-cobalt-600 hover:underline font-medium">
                    Mark all read
                  </button>
                )}
              </div>

              {/* list */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">No notifications yet</div>
                ) : notifications.map(n => {
                  const label = notifLabel(n)
                  return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markReadMutation.mutate(n.id)
                      if (label.href) { setBellOpen(false); router.push(label.href) }
                    }}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition border-b border-gray-50 last:border-0 ${!n.read ? 'bg-cobalt-50/50' : ''} ${label.href ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-cobalt-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{label.icon}</span>
                        <p className="text-sm text-slate-700 leading-snug font-medium truncate">{label.text}</p>
                      </div>
                      {label.sub && <p className="text-xs text-slate-400 mt-0.5 ml-6">{label.sub}</p>}
                      <p className="text-xs text-slate-400 mt-0.5 ml-6">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* User menu trigger */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#3574f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {user.displayName
                ? user.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                : '?'}
            </div>
            <span className="text-sm font-medium text-slate-700">{user.displayName}</span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Popover (light, opens downward) */}
          {userMenuOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 8,
              zIndex: 50,
              minWidth: 220,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 6,
              boxShadow: '0 8px 24px -4px rgba(15,23,42,0.12)',
            }}>
              {/* Header */}
              <div style={{ padding: '10px 10px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: '#3574f0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {user.displayName
                    ? user.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                    : '?'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email ?? ''}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#e2e8f0', margin: '2px 4px 4px' }} />

              {/* Menu items */}
              {[
                { icon: 'user', label: 'Skill profile', action: () => { setUserMenuOpen(false); router.push('/workspaces') } },
                { icon: 'data-transfer-both', label: 'Switch workspace', action: () => { setUserMenuOpen(false); router.push('/workspaces') } },
                { icon: 'settings', label: 'Account settings', action: () => setUserMenuOpen(false) },
                { icon: 'keyframes', label: 'Keyboard shortcuts', hint: '⌘K', action: () => setUserMenuOpen(false) },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, background: 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <IconifyIcon name={item.icon} color="#64748b" size={15} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.hint && <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#94a3b8' }}>{item.hint}</span>}
                </button>
              ))}

              {/* Divider */}
              <div style={{ height: 1, background: '#e2e8f0', margin: '4px 4px' }} />

              {/* Logout */}
              <button
                onClick={() => { setUserMenuOpen(false); handleLogout() }}
                disabled={loggingOut}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 8, background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444',
                  textAlign: 'left', opacity: loggingOut ? 0.5 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <IconifyIcon name="log-out" color="#ef4444" size={15} />
                <span>{loggingOut ? 'Logging out…' : 'Log out'}</span>
              </button>
            </div>
          )}
        </div>
        </div>{/* end flex items-center gap-1 */}
      </header>

      {/* ── Page content ── */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
