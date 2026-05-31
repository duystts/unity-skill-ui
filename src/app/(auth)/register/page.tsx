'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'
import { useState } from 'react'

const registerSchema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(100),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').max(72),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })

type RegisterForm = z.infer<typeof registerSchema>

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGithubLogin = async () => {
    setGithubLoading(true)
    try {
      const res = await apiClient.get<{ data: { authUrl: string } }>('/auth/github/login')
      window.location.href = res.data.data.authUrl
    } catch {
      setServerError('Failed to connect to GitHub. Please try again.')
      setGithubLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      const res = await apiClient.get<{ data: { authUrl: string } }>('/auth/google/login')
      window.location.href = res.data.data.authUrl
    } catch {
      setServerError('Failed to connect to Google. Please try again.')
      setGoogleLoading(false)
    }
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null)
    try {
      const res = await apiClient.post<{
        data: { id: string; email: string; displayName: string; uiMode: 'CHARACTER' | 'SERIOUS'; accessToken: string }
      }>('/auth/register', { email: data.email, password: data.password, displayName: data.displayName })
      const { accessToken, uiMode, ...user } = res.data.data
      setAccessToken(accessToken)
      setUser({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: null, isIncognito: false, uiMode, createdAt: '', updatedAt: '' })
      router.push('/workspaces/new')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: ApiError; status?: number } }
      setServerError(axiosErr.response?.status === 409 ? 'This email is already registered. Try logging in instead.' : 'Something went wrong. Please try again.')
    }
  }

  return (
    /* Full-page background */
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      {/* Centered card */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex">

        {/* ── Left: IDE dark code-rain panel ── */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col justify-between p-8 relative overflow-hidden border-r" style={{ background: '#0d1117', borderColor: '#30363d' }}>
          {/* faded code-rain background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.32 }}>
            <pre className="font-mono text-[11px] leading-[1.7] p-4 whitespace-pre-wrap" style={{ color: '#3574f0' }}>{`import { classify } from\n  '@unity/skill-engine'\n\nconst profile = await\n  classify({\n    github: repos,\n    meetings: calendar,\n    chats: slack\n  })\n\n// automatically documented\nconst verified = profile\n  .skills\n  .filter(s => s.backed)\n\nreturn verified`}</pre>
          </div>

          {/* brand */}
          <div className="relative z-10">
            <span className="font-bold text-white text-base tracking-tight">
              unity<span style={{ color: '#8aabff' }}>_</span>skill
            </span>
          </div>

          {/* proof block */}
          <div className="relative z-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3574f0' }}>// proof of work</p>
            <h2 className="text-[22px] font-extrabold text-white leading-snug mb-3">
              Let your code<br />do the talking.
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: '#8b949e' }}>
              Less performing. More shipping. Every PR, review, and meeting — automatically documented.
            </p>
          </div>

          {/* 3 features with lime dots */}
          <div className="relative z-10 space-y-4">
            {[
              'Auto-tracked from GitHub & Slack',
              'Verified, not self-reported',
              'Share a public portfolio link',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#bef264' }} />
                <span className="text-sm font-medium" style={{ color: '#c9d1d9' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: form ── */}
        <div className="flex-1 flex flex-col justify-center px-10 py-8 overflow-y-auto">
          {/* mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-cobalt-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">U</span>
            </div>
            <span className="font-bold text-gray-900 text-sm">unity_skill</span>
          </div>

          {/* back to home */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-cobalt-600 transition mb-5 -mt-1">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to home
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-500 mb-5">
            Already have an account?{' '}
            <Link href="/login" className="text-cobalt-600 font-medium hover:underline">Sign in</Link>
          </p>

          {/* OAuth buttons */}
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={githubLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-[#24292F] hover:bg-gray-700 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {githubLoading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              ) : <GithubIcon />}
              {githubLoading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </button>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              ) : <GoogleIcon />}
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
          </div>

          {/* divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">or sign up with email</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* error */}
          {serverError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              <svg className="h-4 w-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <Field label="Display name" error={errors.displayName?.message}>
              <input
                {...register('displayName')}
                placeholder="How teammates will see you"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-transparent transition
                  ${errors.displayName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
              />
            </Field>

            <Field label="Work email" error={errors.email?.message}>
              <input
                {...register('email')}
                type="email"
                placeholder="you@company.com"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-transparent transition
                  ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
              />
            </Field>

            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className={`w-full border rounded-xl px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-transparent transition
                    ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </Field>

            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  className={`w-full border rounded-xl px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-transparent transition
                    ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 text-white py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            By creating an account you agree to our{' '}
            <span className="underline cursor-pointer hover:text-gray-600">Terms</span> and{' '}
            <span className="underline cursor-pointer hover:text-gray-600">Privacy Policy</span>
          </p>
        </div>

      </div>
    </div>
  )
}
