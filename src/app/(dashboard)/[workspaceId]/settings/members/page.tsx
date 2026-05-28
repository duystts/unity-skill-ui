'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import axios from 'axios'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
// Flat shape returned by GET /workspaces/{id}/members
interface MemberItem {
  userId: string
  email: string
  displayName: string | null
  role: string
  joinedAt: string
}

type InviteTab = 'email' | 'link'
type Role = 'DEVELOPER' | 'PM' | 'ADMIN'

const ROLE_LABELS: Record<Role, string> = {
  DEVELOPER: 'Developer',
  PM: 'PM',
  ADMIN: 'Admin',
}

const ROLE_COLORS: Record<Role, string> = {
  DEVELOPER: 'bg-slate-100 text-slate-600',
  PM: 'bg-violet-100 text-violet-700',
  ADMIN: 'bg-cobalt-100 text-cobalt-700',
}

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition ${
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-white border-gray-200 text-gray-600 hover:border-cobalt-300 hover:text-cobalt-600'
      }`}
    >
      {copied ? (
        <>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

function MemberAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-cobalt-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  const cls = size === 'sm'
    ? `w-7 h-7 rounded-full ${color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`
    : `w-9 h-9 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center shrink-0`
  return <div className={cls}>{initials}</div>
}

export default function MembersSettingsPage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)

  // UI state
  const [inviteTab, setInviteTab] = useState<InviteTab>('email')
  const [emailInput, setEmailInput] = useState('')
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null)
  const [generatedEmailInviteUrl, setGeneratedEmailInviteUrl] = useState<{ email: string; url: string } | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)

  // ── Members query ─────────────────────────────────────────
  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: MemberItem[] }>(`/workspaces/${workspaceId}/members`)
        .then(r => r.data.data),
  })

  const currentMember = members.find(m => m.userId === currentUser?.id)
  const isAdmin = currentMember?.role === 'ADMIN'

  // ── Invite by email ───────────────────────────────────────
  const inviteEmailMutation = useMutation({
    mutationFn: (email: string) =>
      apiClient
        .post<{ data: { token: string } }>(
          `/workspaces/${workspaceId}/invitations`,
          { email }
        )
        .then(r => r.data.data),
    onSuccess: (data) => {
      const url = `${FRONTEND_URL}/invite/${data.token}`
      setGeneratedEmailInviteUrl({ email: emailInput, url })
      setEmailInput('')
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error('User is already a member of this workspace')
      } else {
        toast.error('Failed to send invitation')
      }
    },
  })

  // ── Generate invite link ──────────────────────────────────
  const inviteLinkMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<{ data: { inviteUrl: string } }>(
          `/workspaces/${workspaceId}/invite-link`
        )
        .then(r => r.data.data),
    onSuccess: (data) => {
      setGeneratedInviteUrl(data.inviteUrl)
    },
    onError: () => toast.error('Failed to generate invite link'),
  })

  // ── Update role ───────────────────────────────────────────
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      apiClient.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      setEditingRoleId(null)
      toast.success('Role updated')
    },
    onError: () => toast.error('Failed to update role'),
  })

  // ── Remove member ─────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      setConfirmRemoveId(null)
      toast.success('Member removed')
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error("Can't remove the last admin")
      } else {
        toast.error('Failed to remove member')
      }
      setConfirmRemoveId(null)
    },
  })

  const handleInviteByEmail = (e: React.FormEvent) => {
    e.preventDefault()
    const email = emailInput.trim()
    if (!email) return
    inviteEmailMutation.mutate(email)
  }

  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { ADMIN: 0, PM: 1, DEVELOPER: 2 }
    return (order[a.role] ?? 3) - (order[b.role] ?? 3)
  })

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">Members</h1>
      <p className="text-gray-500 text-sm mb-8">
        Manage who has access to this workspace.
      </p>

      {/* ── Invite section (Admin only) ── */}
      {isAdmin && (
        <section className="mb-10 border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 text-sm">Invite people</h2>
            <p className="text-xs text-gray-400 mt-0.5">New members join as Developer by default.</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            {(['email', 'link'] as InviteTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setInviteTab(tab)
                  setGeneratedEmailInviteUrl(null)
                  setGeneratedInviteUrl(null)
                }}
                className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                  inviteTab === tab
                    ? 'border-cobalt-600 text-cobalt-700 bg-white'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'email' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Invite by email
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Invite link
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 bg-white">
            {/* ── Email tab ── */}
            {inviteTab === 'email' && (
              <div>
                <form onSubmit={handleInviteByEmail} className="flex gap-2">
                  <input
                    type="email"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-cobalt-300 focus:ring-1 focus:ring-cobalt-100 placeholder-gray-300"
                    placeholder="colleague@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!emailInput.trim() || inviteEmailMutation.isPending}
                    className="px-4 py-2 bg-cobalt-600 text-white text-sm rounded-lg font-medium hover:bg-cobalt-700 transition disabled:opacity-50"
                  >
                    {inviteEmailMutation.isPending ? 'Generating…' : 'Invite'}
                  </button>
                </form>

                {/* Success state */}
                {generatedEmailInviteUrl && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-800 mb-0.5">
                          Invitation sent!
                        </p>
                        <p className="text-xs text-emerald-600">
                          An email with the invite link has been sent to{' '}
                          <span className="font-semibold">{generatedEmailInviteUrl.email}</span>.
                          It expires in 7 days.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setGeneratedEmailInviteUrl(null)}
                      className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      Invite another →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Link tab ── */}
            {inviteTab === 'link' && (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  Generate a one-time link you can share with anyone. It expires after <span className="font-medium text-gray-700">7 days</span>.
                </p>

                {generatedInviteUrl ? (
                  <div className="p-4 bg-cobalt-50 border border-cobalt-100 rounded-xl">
                    <p className="text-xs font-medium text-cobalt-700 mb-2 flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cobalt-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Invite link ready
                    </p>
                    <div className="flex items-center gap-2 bg-white border border-cobalt-200 rounded-lg px-3 py-2 mb-3">
                      <span className="text-xs text-gray-600 truncate flex-1 font-mono">
                        {generatedInviteUrl}
                      </span>
                      <CopyButton text={generatedInviteUrl} />
                    </div>
                    <button
                      onClick={() => {
                        setGeneratedInviteUrl(null)
                        inviteLinkMutation.mutate()
                      }}
                      className="text-xs text-cobalt-500 hover:text-cobalt-700 font-medium"
                    >
                      Generate new link
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => inviteLinkMutation.mutate()}
                    disabled={inviteLinkMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-cobalt-300 text-cobalt-600 rounded-xl text-sm font-medium hover:bg-cobalt-50 transition disabled:opacity-50 w-full justify-center"
                  >
                    {inviteLinkMutation.isPending ? (
                      'Generating…'
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Generate invite link
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Member list ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-gray-800 text-sm">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedMembers.map(member => {
              const name = member.displayName || member.email || member.userId.slice(0, 8)
              const email = member.email ?? ''
              const isCurrentUser = member.userId === currentUser?.id
              const isConfirmingRemove = confirmRemoveId === member.userId
              const isEditingRole = editingRoleId === member.userId

              return (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition"
                >
                  <MemberAvatar name={name} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                      {isCurrentUser && (
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    {email && (
                      <span className="text-xs text-gray-400 truncate">{email}</span>
                    )}
                  </div>

                  {/* Role */}
                  <div className="shrink-0">
                    {isAdmin && !isCurrentUser && isEditingRole ? (
                      <select
                        className="text-xs border border-cobalt-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-cobalt-200"
                        defaultValue={member.role}
                        autoFocus
                        onChange={e => {
                          updateRoleMutation.mutate({
                            userId: member.userId,
                            role: e.target.value as Role,
                          })
                        }}
                        onBlur={() => setEditingRoleId(null)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <option value="DEVELOPER">Developer</option>
                        <option value="PM">PM</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    ) : (
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[member.role as Role] ?? 'bg-gray-100 text-gray-600'} ${isAdmin && !isCurrentUser ? 'cursor-pointer hover:opacity-80 transition' : 'cursor-default'}`}
                        onClick={() => isAdmin && !isCurrentUser && setEditingRoleId(member.userId)}
                        title={isAdmin && !isCurrentUser ? 'Click to change role' : undefined}
                      >
                        {ROLE_LABELS[member.role as Role] ?? member.role}
                        {isAdmin && !isCurrentUser && (
                          <svg className="inline ml-1 -mt-0.5" width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Remove button (Admin only, not self) */}
                  {isAdmin && !isCurrentUser && (
                    <div className="shrink-0">
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">Remove?</span>
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(member.userId)}
                          >
                            Yes
                          </button>
                          <button
                            className="text-xs text-gray-400 hover:text-gray-600"
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-gray-300 hover:text-red-400 transition p-1 rounded"
                          title="Remove member"
                          onClick={() => setConfirmRemoveId(member.userId)}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
