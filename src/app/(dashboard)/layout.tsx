'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { apiClient } from '@/lib/apiClient'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [loggingOut, setLoggingOut] = useState(false)

  // 'pending'  — chưa biết có session không (F5 vừa xảy ra)
  // 'ok'       — đã có token hợp lệ
  // 'rejected' — refresh thất bại, sẽ redirect login
  const [sessionState, setSessionState] = useState<'pending' | 'ok' | 'rejected'>('pending')

  useWebSocket()

  // ── Silent restore: chạy 1 lần duy nhất khi mount ──────────────────────────
  useEffect(() => {
    // Nếu đã có token trong memory (navigate bình thường, không phải F5)
    if (accessToken) {
      setSessionState('ok')
      return
    }

    // Không có token → thử refresh bằng HttpOnly cookie
    axios
      .post(`${BASE_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data?.data?.accessToken
        if (newToken) {
          setAccessToken(newToken)
          setSessionState('ok')
        } else {
          clearAuth()
          setSessionState('rejected')
        }
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

    if (sessionState === 'rejected' || !user) {
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
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Restoring session…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top nav bar ── */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <Link
          href="/workspaces"
          className="text-sm font-semibold text-gray-800 hover:text-indigo-600 transition"
        >
          Unity_skill
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/workspaces/new"
            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition"
          >
            + New workspace
          </Link>
          <span className="text-sm text-gray-600">{user.displayName}</span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-gray-500 hover:text-red-600 transition disabled:opacity-50"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
