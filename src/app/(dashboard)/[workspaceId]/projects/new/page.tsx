'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/apiClient'
import type { Project } from '@/types'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
})

type CreateProjectForm = z.infer<typeof createProjectSchema>

export default function NewProjectPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { visibility: 'PRIVATE' },
  })

  const onSubmit = async (data: CreateProjectForm) => {
    setServerError(null)
    try {
      await apiClient.post<{ data: Project }>(
        `/workspaces/${workspaceId}/projects`,
        data
      )
      router.push(`/${workspaceId}/projects`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 403) {
        setServerError('You need PM or Admin role to create projects.')
      } else {
        setServerError('Failed to create project. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-2">Create a Project</h1>
        <p className="text-gray-600 text-sm mb-6">
          Projects help your team organize work into focused spaces.
        </p>

        {serverError && <p className="text-red-500 text-sm mb-4">{serverError}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="My Project"
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
              placeholder="What is this project about?"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Visibility</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('visibility')}
                  type="radio"
                  value="PRIVATE"
                  className="accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium">Private</span>
                  <p className="text-xs text-gray-500">Only workspace members can see this project</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('visibility')}
                  type="radio"
                  value="PUBLIC"
                  className="accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium">Public</span>
                  <p className="text-xs text-gray-500">Anyone with the link can view this project</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 border rounded py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded font-medium disabled:opacity-50 hover:bg-blue-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
