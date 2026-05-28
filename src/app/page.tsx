'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/lib/apiClient'

// ── Icons ────────────────────────────────────────────────────────────────────
function GithubIcon() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}
function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-bold text-gray-900 text-base tracking-tight">unity_skill</span>
        <nav className="hidden md:flex items-center gap-7 text-sm text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition">Features</a>
          <a href="#pricing" className="hover:text-gray-900 transition">Pricing</a>
          <a href="#integrations" className="hover:text-gray-900 transition">Integrations</a>
        </nav>
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <Link href="/workspaces" className="bg-cobalt-600 hover:bg-cobalt-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
                Go to dashboard →
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-sm text-gray-500 hover:text-red-600 transition disabled:opacity-50"
              >
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition">Sign in</Link>
              <Link href="/register" className="bg-cobalt-600 hover:bg-cobalt-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
                <GithubIcon /> Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="pt-20 pb-12 text-center relative overflow-hidden">
      {/* glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ top: 220, width: 800, height: 300, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(53,116,240,0.28), transparent)', filter: 'blur(48px)', zIndex: 0 }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        {/* eyebrow */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cobalt-600 bg-cobalt-50 border border-cobalt-100 px-3 py-1 rounded-full mb-5">
          <span className="w-1.5 h-1.5 bg-cobalt-500 rounded-full animate-pulse" />
          Now in public beta
        </span>

        {/* headline */}
        <h1 className="text-6xl font-extrabold text-gray-900 leading-[1.05] mb-4 tracking-tight">
          Your work,<br />
          <span className="text-cobalt-600">automatically documented.</span>
        </h1>

        {/* squiggle */}
        <svg width="240" height="10" viewBox="0 0 240 10" className="mx-auto mb-5 opacity-60">
          <path d="M2 6 Q30 2 60 6 Q90 10 120 6 Q150 2 180 6 Q210 10 238 6" fill="none" stroke="#3574f0" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
          unity_skill watches your real GitHub, chat, and meeting activity, then turns it into a verified skill portfolio reviewers can trust.
        </p>

        <div className="flex items-center justify-center gap-3 mb-4">
          {loggedIn ? (
            <Link href="/workspaces" className="inline-flex items-center gap-2 bg-cobalt-600 hover:bg-cobalt-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition shadow-sm shadow-cobalt-200">
              Go to dashboard <ArrowIcon />
            </Link>
          ) : (
            <>
              <Link href="/register" className="inline-flex items-center gap-2 bg-cobalt-600 hover:bg-cobalt-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition shadow-sm shadow-cobalt-200">
                <GithubIcon /> Connect GitHub
              </Link>
              <Link href="/register" className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-gray-300 px-6 py-3 rounded-xl font-semibold text-sm transition bg-white">
                See a portfolio <ArrowIcon />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><CheckIcon size={12} /> No credit card</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="flex items-center gap-1"><CheckIcon size={12} /> SOC 2 Type II</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="flex items-center gap-1"><CheckIcon size={12} /> Self-host available</span>
        </div>
      </div>

      {/* product mockup — kanban board */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mt-12">
        <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-cobalt-100/50 overflow-hidden bg-white">
          {/* window chrome */}
          <div className="bg-gray-100 border-b border-gray-200 flex items-center gap-1.5 px-4 py-2.5">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-gray-400 font-mono">unity-skill.dev / workspace / kanban</span>
          </div>

          <div className="grid grid-cols-[180px_1fr] h-[400px]">
            {/* sidebar — dark, matches real app */}
            <div className="bg-slate-900 flex flex-col h-full">
              <div className="px-3 pt-3 pb-1 text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Workspace</div>
              <div className="mx-2 mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800">
                <div className="w-5 h-5 rounded bg-cobalt-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">US</div>
                <span className="text-xs text-slate-300 truncate">unity_skill</span>
              </div>
              <div className="px-3 py-1 text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Menu</div>
              {[
                { label: 'Projects', active: true },
                { label: 'My tickets', active: false },
                { label: 'Skill profile', active: false },
                { label: 'Members', active: false },
              ].map((item) => (
                <div key={item.label} className={`mx-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${item.active ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                  {item.label}
                </div>
              ))}
              <div className="mt-auto border-t border-slate-800 p-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cobalt-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">M</div>
                <span className="text-xs text-slate-300 truncate">Minh Nguyen</span>
              </div>
            </div>

            {/* main — kanban */}
            <div className="flex flex-col bg-white overflow-hidden">
              {/* topbar */}
              <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">←</span>
                  <span className="text-sm font-semibold text-gray-900">Kanban Board</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="border border-gray-200 px-2.5 py-1 rounded-lg">Chat</span>
                  <span className="border border-gray-200 px-2.5 py-1 rounded-lg">Meetings</span>
                  <span className="border border-gray-200 px-2.5 py-1 rounded-lg">Settings</span>
                </div>
              </div>

              {/* columns */}
              <div className="flex gap-3 p-4 overflow-x-auto flex-1">
                {/* To Do */}
                <div className="flex flex-col gap-2 min-w-[170px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-semibold text-gray-700">To Do</span>
                    <span className="ml-auto text-xs text-gray-400">2</span>
                  </div>
                  {['Setup CI/CD pipeline', 'Write unit tests for Auth'].map((t) => (
                    <div key={t} className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xs text-gray-700 leading-snug">{t}</p>
                    </div>
                  ))}
                </div>

                {/* In Progress */}
                <div className="flex flex-col gap-2 min-w-[170px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-semibold text-gray-700">In Progress</span>
                    <span className="ml-auto text-xs text-gray-400">3</span>
                  </div>
                  {[
                    { title: 'GitHub webhook for PR tracking', avatar: 'M', color: 'bg-cobalt-500' },
                    { title: 'Skill auto-extraction from commits', avatar: 'A', color: 'bg-pink-500' },
                    { title: 'Refactor workspace settings', avatar: 'H', color: 'bg-amber-500' },
                  ].map((t) => (
                    <div key={t.title} className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xs text-gray-700 leading-snug mb-2">{t.title}</p>
                      <div className={`w-5 h-5 rounded-full ${t.color} flex items-center justify-center text-[9px] font-bold text-white`}>{t.avatar}</div>
                    </div>
                  ))}
                </div>

                {/* Done */}
                <div className="flex flex-col gap-2 min-w-[170px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold text-gray-700">Done</span>
                    <span className="ml-auto text-xs text-gray-400">3</span>
                  </div>
                  {[
                    { title: 'JWT refresh token rotation', avatar: 'M', color: 'bg-cobalt-500' },
                    { title: 'Kanban drag-and-drop board', avatar: 'A', color: 'bg-pink-500' },
                    { title: 'Meeting transcript upload', avatar: 'H', color: 'bg-amber-500' },
                  ].map((t) => (
                    <div key={t.title} className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm opacity-70">
                      <p className="text-xs text-gray-500 leading-snug mb-2 line-through decoration-gray-300">{t.title}</p>
                      <div className={`w-5 h-5 rounded-full ${t.color} flex items-center justify-center text-[9px] font-bold text-white`}>{t.avatar}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    num: '01',
    title: 'Auto-track contributions',
    body: 'Every PR, review, design doc, and meeting thread is captured as it happens — no manual logging.',
    mockup: (
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-100 border-b border-gray-200 flex items-center gap-1.5 px-3 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-gray-400 font-mono">github · verified timeline</span>
        </div>
        <div className="bg-white p-3 space-y-2">
          {[
            ['#fix race condition in batcher', '+22 / -18', 'Go', 'merged'],
            ['#refactor outbox publisher', '+186 / -240', 'Postgres', 'merged'],
            ['#review pr/4810 — approved', '', 'review', 'review'],
            ['#feat add idempotency-key middleware', '+92 / -3', 'Go', 'merged'],
          ].map(([title, meta, skill, status], i) => (
            <div key={i} className="flex items-center gap-2 p-2 border border-dashed border-gray-200 rounded-lg">
              <GithubIcon />
              <span className="flex-1 font-mono text-xs text-gray-700 truncate">{title}</span>
              {meta && <span className="text-xs text-gray-400 shrink-0">{meta}</span>}
              <span className="text-xs bg-cobalt-50 text-cobalt-700 px-2 py-0.5 rounded-full shrink-0">{skill}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${status === 'merged' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'Spot overload before it burns out',
    body: 'Real-time workload bars show capacity vs. actual throughput. Blocked tickets surface to PMs before they cascade.',
    mockup: (
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-100 border-b border-gray-200 flex items-center gap-1.5 px-3 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-gray-400 font-mono">team · workload</span>
        </div>
        <div className="bg-white p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">This sprint</p>
          <div className="space-y-3 mb-3">
            {[['Minh', 0.85], ['Anh', 1.05], ['Huy', 0.40], ['Linh', 0.70]].map(([name, load]) => (
              <div key={name as string} className="grid grid-cols-[56px_1fr_80px] items-center gap-3">
                <span className="text-xs font-medium text-gray-700">{name}</span>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min((load as number), 1) * 100}%`, background: (load as number) > 1 ? '#ef4444' : '#3574f0' }}
                  />
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {(load as number) > 1 && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full">overloaded</span>}
                  <span className="text-xs text-gray-400">{Math.round((load as number) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <span className="text-amber-600">⚡</span>
            <p className="text-xs text-amber-800 flex-1">Anh blocked on infra ticket #IF-220 (3d)</p>
            <button className="text-xs border border-amber-200 px-2 py-1 rounded text-amber-700 bg-white">Resolve</button>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: '03',
    title: 'Publish a verified portfolio',
    body: 'One click makes your private skill profile public. Every listed skill links directly to the evidence that backs it.',
    mockup: (
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-100 border-b border-gray-200 flex items-center gap-1.5 px-3 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-gray-400 font-mono">unity-skill.dev/u/minh</span>
        </div>
        <div className="bg-white p-4 flex gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold shrink-0">M</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Minh Nguyen</p>
            <p className="text-xs text-gray-500 mb-3">Backend · 4y · Hanoi</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['Go', 'Postgres', 'Kafka', 'k8s', 'observability', 'mentoring'].map((s) => (
                <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Highlights</p>
            <div className="space-y-1">
              {['Shipped outbox-v2 · backed by 18 PRs', 'Cut p99 latency 41% · backed by SLO doc', 'Mentored 2 juniors · backed by review history'].map((h, i) => (
                <div key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <CheckIcon size={11} />{h}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
  },
]

function Features() {
  return (
    <section id="features" className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-cobalt-600 uppercase tracking-widest">Features</span>
          <h2 className="text-4xl font-extrabold text-gray-900 mt-2 mb-3 tracking-tight">
            Built for teams that ship,<br />not teams that report.
          </h2>
          <svg width="180" height="10" viewBox="0 0 180 10" className="mx-auto opacity-50">
            <path d="M2 6 Q22 2 45 6 Q68 10 90 6 Q112 2 135 6 Q158 10 178 6" fill="none" stroke="#3574f0" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="space-y-20">
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}
            >
              <div className={i % 2 === 1 ? 'md:[direction:ltr]' : ''}>
                <span className="text-xs font-semibold text-cobalt-300 tracking-widest">{feat.num}</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1 mb-3 tracking-tight">{feat.title}</h3>
                <p className="text-gray-500 leading-relaxed mb-4">{feat.body}</p>
                <a href="#" className="inline-flex items-center gap-1 text-sm text-cobalt-600 font-medium hover:underline">
                  Learn more <ArrowIcon />
                </a>
              </div>
              <div className={i % 2 === 1 ? 'md:[direction:ltr]' : ''}>
                {feat.mockup}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PRICING_ROWS = [
  'Workspaces',
  'Members',
  'Contribution history',
  'Public portfolio',
  'Skill tracking',
  'PM dashboard',
  'AI contribution analysis',
  'Priority support',
]

function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-cobalt-600 uppercase tracking-widest">Pricing</span>
          <h2 className="text-4xl font-extrabold text-gray-900 mt-2 tracking-tight">Start free. Scale when you're ready.</h2>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 items-start">
          {/* row labels */}
          <div className="pt-[148px]">
            {PRICING_ROWS.map((row) => (
              <div key={row} className="h-10 flex items-center border-t border-dashed border-gray-100">
                <span className="text-sm text-gray-500">{row}</span>
              </div>
            ))}
          </div>

          {/* Free */}
          <div className="border border-gray-200 rounded-2xl p-6 bg-white">
            <p className="text-sm text-gray-500 font-medium mb-1">Free</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-5xl font-extrabold text-gray-900">$0</span>
              <span className="text-sm text-gray-400">/ month</span>
            </div>
            <Link href="/register" className="block text-center border border-gray-200 text-gray-700 hover:border-gray-300 py-2 rounded-xl text-sm font-medium transition mb-4">
              Get started free
            </Link>
            {[true, false, false, true, false, false, false, false].map((inc, i) => (
              <div key={i} className="h-10 flex items-center border-t border-dashed border-gray-100">
                {inc
                  ? <CheckIcon size={16} />
                  : <span className="text-gray-200">—</span>
                }
              </div>
            ))}
          </div>

          {/* Team — featured tier with gradient per design system */}
          <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(140deg, #2454d6 0%, #7c3aed 45%, #db2777 100%)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest" style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
              Most popular
            </div>
            <p className="text-sm text-white/70 font-medium mb-1">Team</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-5xl font-extrabold">$8</span>
              <span className="text-sm text-white/60">/ user / mo</span>
            </div>
            <Link href="/register" className="block text-center bg-white text-cobalt-700 hover:bg-cobalt-50 py-2 rounded-xl text-sm font-medium transition mb-4">
              Start free trial
            </Link>
            {[true, true, true, true, true, true, true, true].map((inc, i) => (
              <div key={i} className="h-10 flex items-center border-t border-white/20">
                <CheckIcon size={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Integration icon ──────────────────────────────────────────────────────────
const IntegrationIcons: Record<string, { bg: string; fg: string }> = {
  GitHub: { bg: 'bg-[#24292F]', fg: 'text-white' },
}

function Integrations() {
  const icon = IntegrationIcons['GitHub']
  return (
    <section id="integrations" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-cobalt-600 uppercase tracking-widest">Integration</span>
          <h2 className="text-4xl font-extrabold text-gray-900 mt-2 tracking-tight">
            Built on top of where<br />your work already lives.
          </h2>
        </div>

        <div className="flex justify-center">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-6 shadow-sm max-w-sm w-full">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${icon.bg} ${icon.fg}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">GitHub</p>
              <p className="text-sm text-gray-500 mt-0.5">PRs · code reviews · commits</p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Connect your repos and every contribution is automatically captured, verified, and mapped to skills.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p className="font-bold text-white text-base mb-1">unity_skill</p>
          <p className="text-sm text-slate-400">Verified work, automatically documented.</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <a href="#integrations" className="hover:text-white transition">Integration</a>
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
        <p className="text-xs text-slate-500">© 2026 unity_skill. All rights reserved.</p>
        <p className="text-xs text-slate-500">Made with ☕ in Ho Chi Minh City</p>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const user = useAuthStore((s) => s.user)
  const loggedIn = !!user

  return (
    <div className="min-h-screen bg-white font-sans">
      <Nav loggedIn={loggedIn} />
      <main>
        <Hero loggedIn={loggedIn} />
        <Features />
        <Pricing />
        <Integrations />
      </main>
      <Footer />
    </div>
  )
}
