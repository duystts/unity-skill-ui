'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiClient } from '@/lib/apiClient'

type ProjectData = {
  id: string
  name: string
  description?: string
}

type PageState = 'loading' | 'found' | 'not-found' | 'error'

export default function PublicProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [state, setState] = useState<PageState>('loading')
  const [project, setProject] = useState<ProjectData | null>(null)

  useEffect(() => {
    if (!projectId) return

    apiClient
      .get<{ data: ProjectData }>(`/public/projects/${projectId}`)
      .then((res) => {
        setProject(res.data.data)
        setState('found')
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404 || status === 403) {
          setState('not-found')
        } else {
          setState('error')
        }
      })
  }, [projectId])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading project...</p>
      </div>
    )
  }

  if (state === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Project not found</h1>
          <p className="text-gray-600">
            This project does not exist or is not publicly accessible.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-600">Unable to load this project. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">{project?.name}</h1>
        {project?.description && (
          <p className="text-gray-600 mt-2">{project.description}</p>
        )}
      </div>
    </div>
  )
}
