'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/apiClient'
import type { Workspace } from '@/types'

const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
})

type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>

export default function NewWorkspacePage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceForm>({
    resolver: zodResolver(createWorkspaceSchema),
  })

  const onSubmit = async (data: CreateWorkspaceForm) => {
    setServerError(null)
    try {
      const res = await apiClient.post<{ data: Workspace }>('/workspaces', data)
      router.push(`/${res.data.data.id}`)
    } catch {
      setServerError('Failed to create workspace. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-2">Create your workspace</h1>
        <p className="text-gray-600 text-sm mb-6">
          A workspace is a shared space for your team to collaborate.
        </p>
        {serverError && <p className="text-red-500 text-sm mb-4">{serverError}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Workspace Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="My Team"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              placeholder="What is this workspace for?"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  )
}
