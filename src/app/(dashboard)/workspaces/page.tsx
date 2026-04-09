'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import type { Workspace } from '@/types'

export default function WorkspacesPage() {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.workspaces.all(),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Workspace[] }>('/workspaces')
      return res.data.data
    },
  })

  useEffect(() => {
    if (isLoading || data === undefined) return
    if (data.length === 0) {
      router.replace('/workspaces/new')
    } else if (data.length === 1) {
      router.replace(`/${data[0].id}`)
    }
  }, [data, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  // Multiple workspaces — show selector
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Select a Workspace</h1>
        <div className="space-y-3">
          {data?.map((ws) => (
            <button
              key={ws.id}
              onClick={() => router.push(`/${ws.id}`)}
              className="w-full text-left p-4 bg-white border rounded-lg hover:border-blue-500 transition-colors"
            >
              <p className="font-medium">{ws.name}</p>
              {ws.description && (
                <p className="text-sm text-gray-500 mt-1">{ws.description}</p>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push('/workspaces/new')}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          + Create new workspace
        </button>
      </div>
    </div>
  )
}
