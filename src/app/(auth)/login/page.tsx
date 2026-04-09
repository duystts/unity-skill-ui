'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'
import { useState } from 'react'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      const res = await apiClient.post<{ data: { id: string; email: string; displayName: string; accessToken: string } }>(
        '/auth/login',
        data
      )
      const { accessToken, ...user } = res.data.data
      setAccessToken(accessToken)
      setUser({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: null, isIncognito: false, createdAt: '', updatedAt: '' })
      router.push('/workspaces')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: ApiError; status?: number } }
      if (axiosErr.response?.status === 401) {
        setServerError('Invalid email or password')
      } else {
        setServerError('Login failed. Please try again.')
      }
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Log in to your account</h1>
      {serverError && <p className="text-red-500 text-sm mb-4">{serverError}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input {...register('email')} type="email" className="w-full border rounded px-3 py-2 text-sm" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input {...register('password')} type="password" className="w-full border rounded px-3 py-2 text-sm" />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      <p className="text-sm text-center mt-4">
        Don&apos;t have an account? <a href="/register" className="text-blue-600">Sign up</a>
      </p>
    </div>
  )
}
