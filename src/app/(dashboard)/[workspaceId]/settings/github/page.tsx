'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'

interface GithubConnectionData {
  connected: boolean
  repoFullName: string | null
}

export default function GithubSettingsPage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const connectedParam = searchParams.get('connected')
  const queryClient = useQueryClient()

  const [repoInput, setRepoInput] = useState('')

  // Show success toast when redirected back from GitHub OAuth
  useEffect(() => {
    if (connectedParam === 'true') {
      toast.success('GitHub connected successfully')
    }
  }, [connectedParam])

  const { data: connection, isLoading } = useQuery({
    queryKey: queryKeys.github.connection(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: GithubConnectionData }>(
          `/workspaces/${workspaceId}/projects/${projectId}/github`
        )
        .then(r => r.data.data),
    enabled: !!projectId,
  })

  const webhookMutation = useMutation({
    mutationFn: (repoFullName: string) =>
      apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/github/webhook`,
        { repoFullName }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.github.connection(workspaceId, projectId),
      })
      toast.success('Webhook registered successfully')
      setRepoInput('')
    },
    onError: () => toast.error('Failed to register webhook'),
  })

  const handleConnect = async () => {
    try {
      const res = await apiClient.get<{ data: { authUrl: string } }>(
        `/auth/github?projectId=${projectId}&workspaceId=${workspaceId}`
      )
      window.location.href = res.data.data.authUrl
    } catch {
      toast.error('Failed to initiate GitHub connection')
    }
  }

  const handleRegisterWebhook = (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoInput.trim()) {
      toast.error('Enter a repository name (owner/repo)')
      return
    }
    webhookMutation.mutate(repoInput.trim())
  }

  if (!projectId) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <p className="text-gray-500 text-sm">No project selected. Provide a projectId query parameter.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">GitHub Integration</h1>
      <p className="text-gray-500 text-sm mb-8">Connect a GitHub repository to enable automatic ticket stage transitions.</p>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : connection?.connected ? (
        <div className="border rounded p-6 bg-white space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Connected</span>
            {connection.repoFullName && (
              <span className="text-sm font-mono text-gray-700">{connection.repoFullName}</span>
            )}
          </div>

          {!connection.repoFullName && (
            <form onSubmit={handleRegisterWebhook} className="space-y-3">
              <p className="text-sm text-gray-600">Register a webhook to receive GitHub events:</p>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Repository <span className="text-red-500">*</span>
                </label>
                <input
                  value={repoInput}
                  onChange={e => setRepoInput(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full border rounded px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={webhookMutation.isPending}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                {webhookMutation.isPending ? 'Registering...' : 'Register Webhook'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="border rounded p-6 bg-white">
          <p className="text-sm text-gray-600 mb-4">No GitHub repository connected to this project.</p>
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800"
          >
            Connect GitHub
          </button>
        </div>
      )}
    </div>
  )
}
