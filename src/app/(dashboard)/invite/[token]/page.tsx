'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/apiClient'

type AcceptState = 'loading' | 'success' | 'already-member' | 'error'

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<AcceptState>('loading')

  useEffect(() => {
    if (!token) return

    apiClient
      .post<{ data: { workspaceId: string } }>(`/invitations/${token}/accept`)
      .then((res) => {
        setState('success')
        router.replace(`/${res.data.data.workspaceId}`)
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 409) {
          setState('already-member')
        } else {
          setState('error')
        }
      })
  }, [token, router])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Joining workspace...</p>
      </div>
    )
  }

  if (state === 'already-member') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Already a member</h1>
          <p className="text-gray-600 mb-4">
            You are already a member of this workspace.
          </p>
          <button
            onClick={() => router.push('/workspaces')}
            className="text-blue-600 hover:underline text-sm"
          >
            Go to your workspaces
          </button>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Invalid invitation</h1>
          <p className="text-gray-600 mb-4">
            This invitation has expired or is no longer valid.
          </p>
          <button
            onClick={() => router.push('/workspaces')}
            className="text-blue-600 hover:underline text-sm"
          >
            Go to your workspaces
          </button>
        </div>
      </div>
    )
  }

  return null
}
