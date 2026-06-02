'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import { useLang } from '@/lib/i18n'
import { avatarBg, getInitials } from '@/lib/avatarUtils'
import type { Ticket, Project, UserAchievement, AchievementTier, AchievementSource } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SkillEvidenceItem {
  id: string; skillCategory: string; aiSummary: string
  developerNotes: string | null; reviewedAt: string | null
  createdAt: string; isPublished: boolean
}
interface SkillCategoryGroup { skillCategory: string; count: number; items: SkillEvidenceItem[] }
interface SkillProfileData { totalApproved: number; categories: SkillCategoryGroup[]; streak?: { currentWeeks: number; longestWeeks: number } | null }
interface PendingEvidence { id: string; skillCategory: string; aiSummary: string }

// ── Achievement definitions (icon + skill mapping) ────────────────────────────
const ACH_META: Record<string, { icon: string; skill?: string }> = {
  quick_closer:    { icon: 'flash' },
  consistent:      { icon: 'calendar' },
  sprint_machine:  { icon: 'running' },
  heavy_lifter:    { icon: 'gym' },
  speedrunner:     { icon: 'rocket' },
  task_machine:    { icon: 'settings' },
  backend_dev:     { icon: 'server',        skill: 'Backend Development' },
  bug_slayer:      { icon: 'bug',           skill: 'Problem Solving' },
  frontend_dev:    { icon: 'design-pencil', skill: 'Frontend Development' },
  devops_engineer: { icon: 'git-fork',      skill: 'DevOps' },
  architect:       { icon: 'building',      skill: 'Architecture' },
  qa_champion:     { icon: 'test-tube',     skill: 'Testing' },
  team_voice:      { icon: 'chat-bubble' },
  problem_solver:  { icon: 'light-bulb' },
  mentor:          { icon: 'compass' },
  decision_maker:  { icon: 'check-circle' },
}

const SOURCES: { key: AchievementSource; icon: string; title: string; sub: string }[] = [
  { key: 'TICKET_METRIC', icon: 'timer',     title: 'Productivity & Speed',  sub: 'Earned automatically when tickets close' },
  { key: 'TICKET_TAG',    icon: 'bookmark',  title: 'Expertise',              sub: 'Accumulated from tagged tickets · feeds your skill tags' },
  { key: 'CHAT_AI',       icon: 'community', title: 'Collaboration',          sub: 'AI reviews your chat activity every Sunday' },
]

// ── Tier visual config ────────────────────────────────────────────────────────
const TIERS: Record<AchievementTier, { label: string; accent: string; bg: string; border: string; glow: string }> = {
  BRONZE: { label: 'Bronze', accent: '#e0883e', bg: 'rgba(224,136,62,0.12)',  border: 'rgba(224,136,62,0.38)',  glow: 'rgba(224,136,62,0.22)' },
  SILVER: { label: 'Silver', accent: '#c9d1d9', bg: 'rgba(201,209,217,0.12)', border: 'rgba(201,209,217,0.32)', glow: 'rgba(201,209,217,0.18)' },
  GOLD:   { label: 'Gold',   accent: '#f0b429', bg: 'rgba(240,180,41,0.13)',  border: 'rgba(240,180,41,0.42)',  glow: 'rgba(240,180,41,0.28)' },
}

// ── Skill tag colours (IDE-dark) ──────────────────────────────────────────────
const SKILL_TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  'Backend Development':  { bg: 'rgba(56,139,253,0.15)',  fg: '#58a6ff' },
  'Problem Solving':      { bg: 'rgba(210,153,34,0.15)',  fg: '#e3b341' },
  'Frontend Development': { bg: 'rgba(165,131,250,0.15)', fg: '#bc8cff' },
  'Architecture':         { bg: 'rgba(248,81,73,0.13)',   fg: '#f85149' },
  'DevOps':               { bg: 'rgba(255,123,0,0.13)',   fg: '#e3883e' },
  'Testing':              { bg: 'rgba(45,212,191,0.13)',  fg: '#39c5cf' },
}

// ── Iconify icon (Iconoir set) ────────────────────────────────────────────────
function AchIcon({ name, color = '#8b949e', size = 16 }: { name: string; color?: string; size?: number }) {
  const url = `https://api.iconify.design/iconoir/${name}.svg?color=${encodeURIComponent(color)}`
  return <img src={url} alt="" width={size} height={size} style={{ display: 'block', width: size, height: size, flexShrink: 0 }} />
}

// ── Tier badge (diamond + label) ──────────────────────────────────────────────
function TierBadge({ tier, earned }: { tier: AchievementTier; earned: boolean }) {
  const t = TIERS[tier]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700,
      color: earned ? t.accent : '#6e7681',
      background: earned ? t.bg : 'transparent',
      border: `1px solid ${earned ? t.border : '#21262d'}`,
      padding: '3px 9px 3px 8px', borderRadius: 9999,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 1.5, transform: 'rotate(45deg)', background: earned ? t.accent : '#3a4048', flexShrink: 0 }} />
      {t.label}
    </span>
  )
}

// ── Achievement tile ──────────────────────────────────────────────────────────
function AchievementTile({ a }: { a: UserAchievement }) {
  const t = TIERS[a.tier]
  const meta = ACH_META[a.key] ?? { icon: 'medal' }
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: '#161b22', border: `1px solid ${t.border}`,
      borderRadius: 12, padding: 16, overflow: 'hidden',
      boxShadow: `0 0 0 1px ${t.glow}, 0 8px 22px -14px ${t.glow}`,
      transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Tier badge */}
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <TierBadge tier={a.tier} earned={true} />
      </div>

      {/* Medallion */}
      <div style={{
        width: 52, height: 52, borderRadius: 9999, marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(closest-side, ${t.bg}, #161b22)`,
        border: `2px solid ${t.accent}`,
      }}>
        <AchIcon name={meta.icon} color={t.accent} size={26} />
      </div>

      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.01em', paddingRight: 70 }}>
        {a.title}
      </h3>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#8b949e', flex: 1 }}>
        {a.description}
      </p>

      {/* Earned footer */}
      <div style={{ marginTop: 12 }}>
        <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#3fb950', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          earned · {new Date(a.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

// ── Locked achievement tile ───────────────────────────────────────────────────
function LockedTile({ title, description, icon, tier }: { title: string; description: string; icon: string; tier: AchievementTier }) {
  const t = TIERS[tier]
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: '#0e1217', border: '1px solid #21262d',
      borderRadius: 12, padding: 16, opacity: 0.85,
      transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <TierBadge tier={tier} earned={false} />
      </div>
      <div style={{ width: 52, height: 52, borderRadius: 9999, marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#161b22', border: '2px solid #30363d', opacity: 0.6,
      }}>
        <AchIcon name={icon} color="#6e7681" size={26} />
      </div>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#8b949e', letterSpacing: '-0.01em', paddingRight: 70 }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#6e7681', flex: 1 }}>
        {description}
      </p>
      <div style={{ marginTop: 12 }}>
        <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#6e7681', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AchIcon name="lock" color="#6e7681" size={12} /> locked
        </span>
      </div>
    </div>
  )
}

// ── Section header with Iconify icon ─────────────────────────────────────────
function SectionHead({ icon, title, sub, right }: { icon: string; title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: '#161b22', border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AchIcon name={icon} color="#58a6ff" size={16} />
        </span>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.01em' }}>{title}</h2>
          <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#6e7681' }}>{sub}</p>
        </div>
      </div>
      {right}
    </div>
  )
}

// ── Pinned project card ───────────────────────────────────────────────────────
const BAR_COLORS = ['#3574f0','#8b5cf6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444']
function PinnedCard({ name, keyPrefix, done, total, color }: { name: string; keyPrefix: string; done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 10, color: '#8b949e', background: '#21262d', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
          {keyPrefix}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#58a6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </div>
      <div style={{ width: '100%', background: '#21262d', borderRadius: 9999, height: 5, marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#8b949e' }}>
        <span>{done}/{total} closed</span>
        <span style={{ fontWeight: 600, color: '#f0f6fc' }}>{pct}%</span>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#f0f6fc', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#8b949e', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── ALL achievement definitions (for locked tiles) ────────────────────────────
const ALL_DEFS = [
  { key: 'quick_closer',    source: 'TICKET_METRIC' as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'Quick Closer',    description: 'Close 3 tickets within 24h of creation' },
  { key: 'consistent',      source: 'TICKET_METRIC' as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'Consistent',      description: 'Close ≥1 ticket per week for 4 consecutive weeks' },
  { key: 'sprint_machine',  source: 'TICKET_METRIC' as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Sprint Machine',  description: 'Close 10 tickets in a single month' },
  { key: 'heavy_lifter',    source: 'TICKET_METRIC' as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Heavy Lifter',    description: 'Close 5 tickets in the same calendar week' },
  { key: 'speedrunner',     source: 'TICKET_METRIC' as AchievementSource, tier: 'GOLD'   as AchievementTier, title: 'Speedrunner',     description: 'Avg close time < 48h across 5+ tickets' },
  { key: 'task_machine',    source: 'TICKET_METRIC' as AchievementSource, tier: 'GOLD'   as AchievementTier, title: 'Task Machine',    description: 'Close 50 tickets in total' },
  { key: 'backend_dev',     source: 'TICKET_TAG'    as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'Backend Dev',     description: 'Close 5 tickets tagged Backend' },
  { key: 'bug_slayer',      source: 'TICKET_TAG'    as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Bug Slayer',      description: 'Close 10 tickets tagged Bug Fix' },
  { key: 'frontend_dev',    source: 'TICKET_TAG'    as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'Frontend Dev',    description: 'Close 5 tickets tagged Frontend' },
  { key: 'devops_engineer', source: 'TICKET_TAG'    as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'DevOps Engineer', description: 'Close 5 tickets tagged DevOps' },
  { key: 'architect',       source: 'TICKET_TAG'    as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Architect',       description: 'Close 3 tickets tagged Architecture' },
  { key: 'qa_champion',     source: 'TICKET_TAG'    as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'QA Champion',     description: 'Close 8 tickets tagged Testing' },
  { key: 'team_voice',      source: 'CHAT_AI'       as AchievementSource, tier: 'BRONZE' as AchievementTier, title: 'Team Voice',      description: '≥15 substantive technical messages (AI-classified)' },
  { key: 'problem_solver',  source: 'CHAT_AI'       as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Problem Solver',  description: 'AI detects ≥3 technical solutions proposed in chat' },
  { key: 'mentor',          source: 'CHAT_AI'       as AchievementSource, tier: 'GOLD'   as AchievementTier, title: 'Mentor',          description: 'AI detects a pattern of guiding teammates in chat' },
  { key: 'decision_maker',  source: 'CHAT_AI'       as AchievementSource, tier: 'SILVER' as AchievementTier, title: 'Decision Maker',  description: 'AI detects ≥5 clear technical decisions in chat' },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SkillProfilePage() {
  const params      = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const router      = useRouter()
  const queryClient = useQueryClient()
  const user        = useAuthStore((s) => s.user)
  const userId      = user?.id
  const { t }       = useLang()

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', 'me', 'global'],
    queryFn: () => apiClient.get<{ data: Ticket[] }>('/users/me/tickets').then(r => r.data.data),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'me', 'global'],
    queryFn: () => apiClient.get<{ data: Project[] }>('/users/me/projects').then(r => r.data.data),
  })

  const { data: profile } = useQuery({
    queryKey: queryKeys.portfolio.me(),
    queryFn: () => apiClient.get<{ data: SkillProfileData }>('/users/me/skill-profile').then(r => r.data.data),
  })

  const { data: pendingEvidence = [] } = useQuery({
    queryKey: ['skill-evidences', workspaceId, 'pending'],
    queryFn: () => apiClient.get<{ data: PendingEvidence[] }>(`/workspaces/${workspaceId}/skill-evidences?status=PENDING`).then(r => r.data.data),
  })

  const { data: earnedAchievements = [], isLoading: achLoading } = useQuery({
    queryKey: ['achievements', 'me'],
    queryFn: () => apiClient.get<{ data: UserAchievement[] }>('/users/me/achievements').then(r => r.data.data),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ evidenceId, action }: { evidenceId: string; action: string }) =>
      apiClient.patch(`/workspaces/${workspaceId}/skill-evidences/${evidenceId}`, { action }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.me() })
      queryClient.invalidateQueries({ queryKey: ['skill-evidences', workspaceId, 'pending'] })
    },
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const projectMap   = new Map(projects.map(p => [p.id, p]))
  const closedTickets = tickets.filter(t => !!t.closedAt)
  const totalDone    = closedTickets.length

  const avgCloseHours = (() => {
    if (closedTickets.length === 0) return null
    const hours = closedTickets.map(t => (new Date(t.closedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000)
    return Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
  })()

  const byProject = tickets.reduce<Record<string, Ticket[]>>((acc, t) => {
    if (!acc[t.projectId]) acc[t.projectId] = []
    acc[t.projectId].push(t)
    return acc
  }, {})

  const projectStats = Object.entries(byProject)
    .map(([pid, pts]) => {
      const p    = projectMap.get(pid)
      const done = pts.filter(t => !!t.closedAt).length
      return { pid, p, done, total: pts.length }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  const earnedKeys = new Set(earnedAchievements.map(a => a.key))

  // Skill tags: earned from tag-based achievements
  const earnedSkillTags = earnedAchievements
    .map(a => ACH_META[a.key]?.skill)
    .filter((s): s is string => !!s)

  const lockedSkillTags = ALL_DEFS
    .filter(d => d.source === 'TICKET_TAG' && !earnedKeys.has(d.key))
    .map(d => ACH_META[d.key]?.skill)
    .filter((s): s is string => !!s)

  const displayName = user?.displayName || user?.email || 'You'

  // ── Generate standalone HTML portfolio ────────────────────────────────────
  const generatePortfolioHTML = () => {
    const skillTagsHTML = earnedSkillTags.map(name => {
      const c = SKILL_TAG_STYLE[name] ?? { bg: 'rgba(139,148,158,0.15)', fg: '#8b949e' }
      return `<span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:6px 13px;border-radius:9999px;background:${c.bg};color:${c.fg};border:1px solid ${c.fg}33">
        <span style="width:6px;height:6px;border-radius:9999px;background:${c.fg}"></span>${name}</span>`
    }).join('\n')

    const projectsHTML = projectStats.map(({ p, done, total }, i) => {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      const colors = ['#3574f0','#8b5cf6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444']
      const color = colors[i % colors.length]
      return `<div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
          <span style="font-family:monospace;font-size:10px;color:#8b949e;background:#21262d;padding:2px 6px;border-radius:4px">${p?.keyPrefix ?? 'PROJ'}</span>
          <span style="font-size:13px;font-weight:600;color:#58a6ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p?.name ?? 'Project'}</span>
        </div>
        <div style="width:100%;background:#21262d;border-radius:9999px;height:5px;margin-bottom:8px">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:9999px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:11px;color:#8b949e">
          <span>${done}/${total} closed</span><span style="font-weight:600;color:#f0f6fc">${pct}%</span>
        </div>
      </div>`
    }).join('\n')

    const achievementsHTML = earnedAchievements.map(a => {
      const tierColors: Record<string, string> = { BRONZE: '#e0883e', SILVER: '#c9d1d9', GOLD: '#f0b429' }
      const color = tierColors[a.tier] ?? '#8b949e'
      return `<div style="background:#161b22;border:1px solid ${color}66;border-radius:12px;padding:16px;position:relative">
        <div style="position:absolute;top:12px;right:12px;font-size:11px;font-weight:700;color:${color};background:${color}22;border:1px solid ${color}66;padding:3px 9px;border-radius:9999px">
          ${a.tier.charAt(0) + a.tier.slice(1).toLowerCase()}</div>
        <div style="font-size:26px;margin-bottom:10px">${a.iconEmoji}</div>
        <h3 style="margin:0 0 4px;font-size:14px;font-weight:700;color:#f0f6fc">${a.title}</h3>
        <p style="margin:0;font-size:12px;color:#8b949e;line-height:1.5">${a.description}</p>
        <div style="margin-top:10px;font-size:11px;color:#3fb950;font-family:monospace">
          ✓ earned · ${new Date(a.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>`
    }).join('\n')

    const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    const bgColors = ['#3574f0','#7c3aed','#10b981','#f59e0b','#ec4899','#ef4444','#06b6d4']
    const avatarBgColor = bgColors[(displayName.charCodeAt(0) ?? 0) % bgColors.length]
    const avatarEl = user?.avatarUrl
      ? `<img src="${user.avatarUrl}" alt="${displayName}" style="width:80px;height:80px;border-radius:9999px;object-fit:cover;border:4px solid #30363d;flex-shrink:0">`
      : `<div style="width:80px;height:80px;border-radius:9999px;background:${avatarBgColor};color:white;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:4px solid #30363d">${initials}</div>`

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${displayName} — unity_skill Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0d1117;color:#c9d1d9;font-family:'Geist',system-ui,sans-serif;min-height:100vh;padding:0}
  .container{max-width:900px;margin:0 auto;padding:40px 24px}
  h1,h2,h3,h4{letter-spacing:-0.02em}
  .mono{font-family:'Geist Mono',monospace}
  .section{margin-bottom:32px}
  .section-title{font-size:15px;font-weight:700;color:#f0f6fc;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .stat-card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px 16px}
  .stat-value{font-size:24px;font-weight:800;color:#f0f6fc}
  .stat-label{font-family:'Geist Mono',monospace;font-size:11px;color:#8b949e;margin-top:2px}
  .badge{display:inline-flex;align-items:center;gap:6px;background:#161b22;border:1px solid #30363d;color:#c9d1d9;padding:6px 12px;border-radius:8px;font-size:13px;text-decoration:none}
  @media(max-width:640px){.grid-4,.grid-3{grid-template-columns:repeat(2,1fr)}.grid-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;padding-bottom:32px;border-bottom:1px solid #30363d;margin-bottom:32px">
    ${avatarEl}
    <div style="flex:1;min-width:200px">
      <h1 style="font-size:28px;font-weight:700;color:#f0f6fc">${displayName}</h1>
      ${user?.email ? `<p style="margin:4px 0 0;font-size:14px;color:#8b949e">${user.email}</p>` : ''}
      <p style="margin:8px 0 0;font-family:'Geist Mono',monospace;font-size:12px;color:#6e7681">// Generated by unity_skill · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
    </div>
  </div>

  <!-- Stats -->
  <div class="section">
    <div class="grid-4">
      <div class="stat-card"><div class="stat-value">${totalDone}</div><div class="stat-label">tickets closed</div></div>
      <div class="stat-card"><div class="stat-value">${avgCloseHours != null ? `${avgCloseHours}h` : '—'}</div><div class="stat-label">avg close time</div></div>
      <div class="stat-card"><div class="stat-value">${profile?.streak ? `${profile.streak.currentWeeks} wks` : '—'}</div><div class="stat-label">current streak</div></div>
      <div class="stat-card"><div class="stat-value">${earnedAchievements.length}/${ALL_DEFS.length}</div><div class="stat-label">achievements</div></div>
    </div>
  </div>

  ${projectStats.length > 0 ? `
  <!-- Projects -->
  <div class="section">
    <div class="section-title">📁 Project Contributions</div>
    <div class="grid-2">${projectsHTML}</div>
  </div>` : ''}

  ${earnedSkillTags.length > 0 ? `
  <!-- Skill Tags -->
  <div class="section">
    <div class="section-title">🏷️ Skill Tags</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${skillTagsHTML}</div>
  </div>` : ''}

  ${earnedAchievements.length > 0 ? `
  <!-- Achievements -->
  <div class="section">
    <div class="section-title">🏆 Achievements (${earnedAchievements.length} earned)</div>
    <div class="grid-3">${achievementsHTML}</div>
  </div>` : ''}

  <div style="text-align:center;padding-top:32px;border-top:1px solid #30363d;font-family:'Geist Mono',monospace;font-size:11px;color:#6e7681">
    Generated by <strong style="color:#3574f0">unity_skill</strong> · Proof of Work Platform
  </div>
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${displayName.replace(/\s+/g, '_')}_portfolio.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statCards = [
    { value: String(totalDone), label: t('skillprofile.ticketsclosed') },
    { value: avgCloseHours != null ? `${avgCloseHours}h` : '—', label: t('skillprofile.avgclosetime') },
    { value: profile?.streak ? `${profile.streak.currentWeeks} wks` : '—', label: t('skillprofile.currentstreak') },
    { value: `${earnedAchievements.length}/${ALL_DEFS.length}`, label: t('skillprofile.achievements') },
  ]

  return (
    <div style={{ minHeight: '100%', background: '#0d1117', color: 'white', fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* ── Breadcrumb bar ── */}
      <div style={{ borderBottom: '1px solid #30363d', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d1117' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#8b949e', fontFamily: 'inherit', padding: 0 }}>{t('skillprofile.back')}</button>
          <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#8b949e' }}>/ skill-profile</span>
        </div>
        <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#3fb950', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#3fb950', boxShadow: '0 0 0 3px rgba(63,185,80,0.18)', flexShrink: 0 }} />
          {t('skillprofile.live')} · {t('skillprofile.synced')}
        </span>
      </div>

      {/* ── Profile header ── */}
      <div style={{ padding: '32px 28px 24px', maxWidth: 1024, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar — shows uploaded photo if available, else consistent initials */}
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName}
              style={{ width: 80, height: 80, borderRadius: 9999, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 4px #30363d' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 9999, background: avatarBg(displayName), color: 'white', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 0 4px #30363d' }}>
              {getInitials(displayName)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em' }}>{displayName}</h1>
            {user?.email && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#8b949e' }}>{user.email}</p>}
          </div>

          <button onClick={generatePortfolioHTML}
            style={{ background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', padding: '8px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
            {/* Download icon */}
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {t('skillprofile.publicportfolio')}
          </button>
        </div>

        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24 }}>
          {statCards.map(s => <StatCard key={s.label} value={s.value} label={s.label} />)}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 28px 48px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Pending review */}
        {pendingEvidence.length > 0 && (
          <section>
            <SectionHead icon="bell" title={t('skillprofile.pendingreview')} sub="AI-generated skill evidence — approve or reject" right={
              <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#e3b341' }}>
                <strong style={{ color: '#f0f6fc' }}>{pendingEvidence.length}</strong> {t('skillprofile.waiting')}
              </span>
            } />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingEvidence.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: '1px solid rgba(56,139,253,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {item.skillCategory}
                  </span>
                  <p style={{ flex: 1, margin: 0, fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 }}>{item.aiSummary}</p>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => reviewMutation.mutate({ evidenceId: item.id, action: 'APPROVE' })} disabled={reviewMutation.isPending}
                      style={{ fontSize: 12, fontWeight: 600, background: '#238636', border: 'none', color: 'white', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      {t('skillprofile.approve')}
                    </button>
                    <button onClick={() => reviewMutation.mutate({ evidenceId: item.id, action: 'REJECT' })} disabled={reviewMutation.isPending}
                      style={{ fontSize: 12, background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      {t('skillprofile.reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pinned projects */}
        {projectStats.length > 0 && (
          <section>
            <SectionHead icon="pin" title={t('skillprofile.pinnedprojects')}
              sub="Top projects by ticket count · cross-workspace"
              right={<span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#8b949e' }}><strong style={{ color: '#f0f6fc' }}>{projectStats.length}</strong> projects</span>} />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(projectStats.length, 4)}, 1fr)`, gap: 12 }}>
              {projectStats.map(({ pid, p, done, total }, i) => (
                <PinnedCard
                  key={pid}
                  name={p?.name ?? pid.slice(0, 12)}
                  keyPrefix={p?.keyPrefix ?? 'PROJ'}
                  done={done}
                  total={total}
                  color={BAR_COLORS[i % BAR_COLORS.length]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Skill tags */}
        {(earnedSkillTags.length > 0 || lockedSkillTags.length > 0) && (
          <section>
            <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.01em' }}>{t('skillprofile.skilltags')}</h2>
            <p style={{ margin: '0 0 14px', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#6e7681' }}>
              {t('skillprofile.unlockedbytags')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {earnedSkillTags.map(name => {
                const c = SKILL_TAG_STYLE[name] ?? { bg: 'rgba(139,148,158,0.15)', fg: '#8b949e' }
                return (
                  <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '6px 13px', borderRadius: 9999, background: c.bg, color: c.fg, border: `1px solid ${c.fg}33` }}>
                    <span style={{ width: 6, height: 6, borderRadius: 9999, background: c.fg, flexShrink: 0 }} />
                    {name}
                  </span>
                )
              })}
              {lockedSkillTags.map(name => (
                <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, padding: '6px 13px', borderRadius: 9999, background: 'transparent', color: '#6e7681', border: '1px dashed #30363d' }}>
                  {name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Achievement sections by source */}
        {SOURCES.map(src => {
          const srcDefs   = ALL_DEFS.filter(d => d.source === src.key)
          const srcEarned = earnedAchievements.filter(a => srcDefs.some(d => d.key === a.key))
          const srcLocked = srcDefs.filter(d => !earnedKeys.has(d.key))

          return (
            <section key={src.key}>
              <SectionHead
                icon={src.icon}
                title={src.title}
                sub={src.sub}
                right={
                  <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#8b949e' }}>
                    <strong style={{ color: '#f0f6fc' }}>{srcEarned.length}</strong> / {srcDefs.length} earned
                  </span>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {/* Earned tiles */}
                {srcEarned.map(a => (
                  <AchievementTile key={a.key} a={a} />
                ))}
                {/* Locked tiles */}
                {srcLocked.map(d => (
                  <LockedTile
                    key={d.key}
                    title={d.title}
                    description={d.description}
                    icon={ACH_META[d.key]?.icon ?? 'medal'}
                    tier={d.tier}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* Empty state */}
        {!ticketsLoading && !achLoading && projectStats.length === 0 && earnedAchievements.length === 0 && pendingEvidence.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 9999, background: '#161b22', border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AchIcon name="circle" color="#8b949e" size={24} />
            </div>
            <p style={{ margin: 0, color: '#8b949e', fontSize: 14 }}>{t('skillprofile.noactivity')}</p>
            <p style={{ margin: '4px 0 0', color: '#6e7681', fontSize: 12 }}>{t('skillprofile.noactivity.sub')}</p>
          </div>
        )}

      </div>
    </div>
  )
}
