'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccountData {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  title: string | null
  timezone: string
  bio: string | null
  uiMode: 'CHARACTER' | 'SERIOUS'
  isIncognito: boolean
  hasPassword: boolean
  githubConnected: boolean
  googleConnected: boolean
  createdAt: string
}

type Tab = 'profile' | 'notifications' | 'appearance' | 'security'

// ── IANA timezone list (common) ───────────────────────────────────────────────
const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'UTC',
]

const TZ_LABELS: Record<string, string> = {
  'Asia/Ho_Chi_Minh': 'Asia/Ho_Chi_Minh (GMT+7)',
  'Asia/Bangkok':     'Asia/Bangkok (GMT+7)',
  'Asia/Singapore':   'Asia/Singapore (GMT+8)',
  'Asia/Tokyo':       'Asia/Tokyo (GMT+9)',
  'Asia/Seoul':       'Asia/Seoul (GMT+9)',
  'Asia/Shanghai':    'Asia/Shanghai (GMT+8)',
  'Asia/Kolkata':     'Asia/Kolkata (GMT+5:30)',
  'Asia/Dubai':       'Asia/Dubai (GMT+4)',
  'Europe/London':    'Europe/London (GMT+0/+1)',
  'Europe/Paris':     'Europe/Paris (GMT+1/+2)',
  'Europe/Berlin':    'Europe/Berlin (GMT+1/+2)',
  'America/New_York': 'America/New_York (GMT-5/-4)',
  'America/Chicago':  'America/Chicago (GMT-6/-5)',
  'America/Denver':   'America/Denver (GMT-7/-6)',
  'America/Los_Angeles': 'America/Los_Angeles (GMT-8/-7)',
  'America/Sao_Paulo': 'America/Sao_Paulo (GMT-3)',
  'UTC': 'UTC (GMT+0)',
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}
const AVATAR_COLORS = ['#3574f0','#7c3aed','#10b981','#f59e0b','#ec4899','#ef4444','#06b6d4']
function avatarBg(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

// ── Form input ────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-transparent transition bg-white'

// ── Sidebar tab ───────────────────────────────────────────────────────────────
function SidebarTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${
        active ? 'bg-cobalt-50 text-cobalt-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-cobalt-600' : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccountSettingsPage() {
  const params = useParams<{ workspaceId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [tab, setTab] = useState<Tab>('profile')

  // ── Fetch account data ──────────────────────────────────────────────────────
  const { data: account, isLoading } = useQuery({
    queryKey: ['account', 'me'],
    queryFn: () => apiClient.get<{ data: AccountData }>('/users/me/account').then(r => r.data.data),
  })

  // ── Profile form state ──────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  const [title, setTitle]             = useState('')
  const [timezone, setTimezone]       = useState('Asia/Ho_Chi_Minh')
  const [bio, setBio]                 = useState('')
  const [dirty, setDirty]             = useState(false)

  useEffect(() => {
    if (!account) return
    setDisplayName(account.displayName ?? '')
    setTitle(account.title ?? '')
    setTimezone(account.timezone ?? 'Asia/Ho_Chi_Minh')
    setBio(account.bio ?? '')
    setDirty(false)
  }, [account])

  const markDirty = () => setDirty(true)

  // ── Save profile mutation ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => apiClient.patch<{ data: AccountData }>('/users/me/profile', {
      displayName: displayName.trim() || undefined,
      title:    title.trim() || null,
      timezone: timezone || undefined,
      bio:      bio.trim() || null,
    }).then(r => r.data.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['account', 'me'], updated)
      if (user) setUser({ ...user, displayName: updated.displayName })
      setDirty(false)
      toast.success('Profile saved')
    },
    onError: () => toast.error('Failed to save profile'),
  })

  // ── Remove avatar mutation ──────────────────────────────────────────────────
  const removeAvatarMutation = useMutation({
    mutationFn: () => apiClient.patch('/users/me/avatar', { avatarUrl: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'me'] })
      toast.success('Photo removed')
    },
    onError: () => toast.error('Failed to remove photo'),
  })

  // ── Change password state ───────────────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError]     = useState('')

  const changePwdMutation = useMutation({
    mutationFn: () => apiClient.patch('/users/me/password', {
      currentPassword: currentPwd || undefined,
      newPassword: newPwd,
    }),
    onSuccess: () => {
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdError('')
      toast.success('Password updated')
    },
    onError: (err: any) => {
      setPwdError(err.response?.data?.error ?? 'Failed to update password')
    },
  })

  const handleChangePwd = () => {
    setPwdError('')
    if (newPwd.length < 8) { setPwdError('Password must be at least 8 characters'); return }
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match'); return }
    changePwdMutation.mutate()
  }

  // ── UI mode mutation ────────────────────────────────────────────────────────
  const uiModeMutation = useMutation({
    mutationFn: (mode: 'CHARACTER' | 'SERIOUS') =>
      apiClient.patch('/users/me/preferences', { uiMode: mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'me'] })
      toast.success('Appearance updated')
    },
  })

  // ── Delete account ──────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePwd, setDeletePwd]         = useState('')
  const clearAuth = useAuthStore(s => s.clearAuth)

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete('/users/me', {
      data: { confirmation: deleteConfirm, password: deletePwd || undefined },
    }),
    onSuccess: () => { clearAuth(); window.location.href = '/login' },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to delete account'),
  })

  if (isLoading || !account) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-cobalt-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const username = account.email.split('@')[0]

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="border-b border-gray-100 bg-white px-6 py-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <span className="text-gray-300 text-lg">/</span>
        <span className="text-gray-500 text-base">account</span>
        <span className="ml-1 text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full font-mono">
          @{username}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-6 p-6 max-w-5xl w-full mx-auto">

        {/* Left sidebar */}
        <aside className="w-52 shrink-0">
          <nav className="space-y-0.5">
            <SidebarTab active={tab === 'profile'} onClick={() => setTab('profile')} label="Profile"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
            <SidebarTab active={tab === 'notifications'} onClick={() => setTab('notifications')} label="Notifications"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} />
            <SidebarTab active={tab === 'appearance'} onClick={() => setTab('appearance')} label="Appearance"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>} />
            <SidebarTab active={tab === 'security'} onClick={() => setTab('security')} label="Security"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} />
          </nav>
        </aside>

        {/* Main content card */}
        <div className="flex-1">

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Profile</h2>
                <p className="text-sm text-gray-500 mt-0.5">This information appears on your public portfolio.</p>
              </div>

              <div className="px-6 py-6 space-y-6">
                {/* Avatar row */}
                <div className="flex items-center gap-4">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                      style={{ background: avatarBg(account.displayName) }}>
                      {getInitials(account.displayName)}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button className="text-sm font-medium text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                      Change photo
                    </button>
                    {account.avatarUrl && (
                      <button
                        onClick={() => removeAvatarMutation.mutate()}
                        disabled={removeAvatarMutation.isPending}
                        className="text-sm text-gray-500 hover:text-red-600 transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Name + Email */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Display Name">
                    <input className={inputCls} value={displayName}
                      onChange={e => { setDisplayName(e.target.value); markDirty() }}
                      placeholder="Your name" />
                  </Field>
                  <Field label="Email">
                    <input className={`${inputCls} bg-slate-50 text-gray-500 cursor-not-allowed`}
                      value={account.email} readOnly
                      title="Change email in the Security tab" />
                  </Field>
                </div>

                {/* Title + Timezone */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Title">
                    <input className={inputCls} value={title}
                      onChange={e => { setTitle(e.target.value); markDirty() }}
                      placeholder="e.g. Backend Lead" />
                  </Field>
                  <Field label="Timezone">
                    <select className={`${inputCls} cursor-pointer`} value={timezone}
                      onChange={e => { setTimezone(e.target.value); markDirty() }}>
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{TZ_LABELS[tz] ?? tz}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Bio */}
                <Field label="Bio">
                  <textarea className={`${inputCls} resize-y min-h-[100px]`} value={bio}
                    onChange={e => { setBio(e.target.value); markDirty() }}
                    placeholder="Short bio shown on your public portfolio…" maxLength={500} />
                  <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/500</p>
                </Field>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setDisplayName(account.displayName ?? '')
                    setTitle(account.title ?? '')
                    setTimezone(account.timezone ?? 'Asia/Ho_Chi_Minh')
                    setBio(account.bio ?? '')
                    setDirty(false)
                  }}
                  disabled={!dirty || saveMutation.isPending}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  className="bg-cobalt-600 hover:bg-cobalt-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saveMutation.isPending && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
                <p className="text-sm text-gray-500 mt-0.5">Choose what you want to be notified about.</p>
              </div>
              <div className="px-6 py-6 space-y-4">
                {[
                  { label: 'Ticket assigned to me', sub: 'When someone assigns a ticket to you' },
                  { label: 'Achievement earned', sub: 'When you unlock a new skill achievement' },
                  { label: 'Skill evidence pending', sub: 'When AI generates new evidence to review' },
                  { label: 'Workspace invite accepted', sub: 'When someone joins your workspace' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cobalt-600" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── APPEARANCE TAB ── */}
          {tab === 'appearance' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
                <p className="text-sm text-gray-500 mt-0.5">Customize how unity_skill looks for you.</p>
              </div>
              <div className="px-6 py-6">
                <p className="text-sm font-medium text-gray-700 mb-3">UI Mode</p>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {(['SERIOUS', 'CHARACTER'] as const).map(mode => (
                    <button key={mode}
                      onClick={() => uiModeMutation.mutate(mode)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                        account.uiMode === mode
                          ? 'border-cobalt-500 bg-cobalt-50 text-cobalt-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      <span className="text-xl">{mode === 'SERIOUS' ? '💼' : '🎭'}</span>
                      <span className="text-sm font-semibold capitalize">{mode === 'SERIOUS' ? 'Serious' : 'Character'}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">Character mode adds a playful personality to notifications and UI chrome.</p>
              </div>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && (
            <div className="space-y-4">

              {/* Change password */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">
                    {account.hasPassword ? 'Change password' : 'Set a password'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {account.hasPassword ? 'Update your password. You will stay signed in.' : 'Add a password to sign in with email + password in addition to OAuth.'}
                  </p>
                </div>
                <div className="px-6 py-6 space-y-4">
                  {account.hasPassword && (
                    <Field label="Current password">
                      <input type="password" className={inputCls} value={currentPwd}
                        onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" />
                    </Field>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="New password">
                      <input type="password" className={inputCls} value={newPwd}
                        onChange={e => setNewPwd(e.target.value)} placeholder="Min. 8 characters" />
                    </Field>
                    <Field label="Confirm new password">
                      <input type="password" className={inputCls} value={confirmPwd}
                        onChange={e => setConfirmPwd(e.target.value)} placeholder="Re-enter password" />
                    </Field>
                  </div>
                  {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-end">
                  <button
                    onClick={handleChangePwd}
                    disabled={!newPwd || changePwdMutation.isPending}
                    className="bg-cobalt-600 hover:bg-cobalt-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                  >
                    {changePwdMutation.isPending ? 'Saving…' : account.hasPassword ? 'Update password' : 'Set password'}
                  </button>
                </div>
              </div>

              {/* Connected accounts */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Connected accounts</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Sign in with these providers.</p>
                </div>
                <div className="px-6 py-4 space-y-3">
                  {[
                    { key: 'github', label: 'GitHub', connected: account.githubConnected, icon: (
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                    )},
                    { key: 'google', label: 'Google', connected: account.googleConnected, icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    )},
                  ].map(p => (
                    <div key={p.key} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-700">{p.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{p.label}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        p.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-red-100">
                  <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Permanently delete your account and all data.</p>
                </div>
                <div className="px-6 py-6 space-y-4">
                  <Field label='Type "delete my account" to confirm'>
                    <input className={inputCls} value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      placeholder='delete my account' />
                  </Field>
                  {account.hasPassword && (
                    <Field label="Password">
                      <input type="password" className={inputCls} value={deletePwd}
                        onChange={e => setDeletePwd(e.target.value)} placeholder="••••••••" />
                    </Field>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteConfirm !== 'delete my account' || deleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
