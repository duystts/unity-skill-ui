'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'

interface SkillEvidenceItem {
  id: string
  skillCategory: string
  aiSummary: string
  developerNotes: string | null
  reviewedAt: string | null
  createdAt: string
  isPublished: boolean   // Story 7.2
}

interface SkillCategoryGroup {
  skillCategory: string
  count: number
  items: SkillEvidenceItem[]
}

interface SkillProfileData {
  totalApproved: number
  categories: SkillCategoryGroup[]
}

interface PendingEvidence {
  id: string
  skillCategory: string
  aiSummary: string
}

export default function SkillProfilePage() {
  const params = useParams<{ workspaceId: string }>()
  const { workspaceId } = params
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  // AC1 (Story 7.1): fetch private skill profile (APPROVED evidence grouped by category)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.portfolio.private(workspaceId),
    queryFn: () =>
      apiClient
        .get<{ data: SkillProfileData }>(`/workspaces/${workspaceId}/skill-profile`)
        .then((r) => r.data.data),
  })

  // Fetch pending evidence for the quick-approve section (Story 7.1 AC3 enabler)
  const { data: pendingEvidence = [] } = useQuery({
    queryKey: ['skill-evidences', workspaceId, 'pending'],
    queryFn: () =>
      apiClient
        .get<{ data: PendingEvidence[] }>(
          `/workspaces/${workspaceId}/skill-evidences?status=PENDING`
        )
        .then((r) => r.data.data),
  })

  // Story 7.1 AC3: invalidate profile cache after successful approval/rejection
  const reviewMutation = useMutation({
    mutationFn: ({ evidenceId, action }: { evidenceId: string; action: string }) =>
      apiClient
        .patch(`/workspaces/${workspaceId}/skill-evidences/${evidenceId}`, { action })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.private(workspaceId) })
      queryClient.invalidateQueries({ queryKey: ['skill-evidences', workspaceId, 'pending'] })
    },
  })

  // Story 7.2: publish/unpublish approved evidence items
  const publishMutation = useMutation({
    mutationFn: ({ evidenceId, isPublished }: { evidenceId: string; isPublished: boolean }) =>
      apiClient
        .patch(`/skill-evidences/${evidenceId}`, { isPublished })
        .then((r) => r.data),
    onSuccess: () => {
      // Invalidate private profile (publish badge updates) and public portfolio
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.private(workspaceId) })
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.public(userId) })
      }
    },
  })

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">My Skill Profile</h1>
      <p className="text-gray-500 text-sm mb-6">
        Your verified contributions — private to you only.
      </p>

      {/* Total approved count — Story 7.1 AC4 */}
      {!profileLoading && (
        <p className="text-sm text-gray-600 mb-6">
          {profile?.totalApproved ?? 0} approved skill evidence item
          {(profile?.totalApproved ?? 0) !== 1 ? 's' : ''}
        </p>
      )}

      {profileLoading ? (
        <p className="text-gray-400 text-sm">Loading profile...</p>
      ) : (profile?.categories ?? []).length === 0 ? (
        <p className="text-gray-400 text-sm">
          No approved skill evidence yet. Approve some pending items below to get started.
        </p>
      ) : (
        /* Story 7.1 AC4: skill categories shown as groupings with item counts */
        <div className="space-y-6">
          {profile!.categories.map((group) => (
            <div key={group.skillCategory} className="border rounded p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800">{group.skillCategory}</h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  {group.count} item{group.count !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="text-sm text-gray-700 border-l-2 border-indigo-200 pl-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <p>{item.developerNotes ?? item.aiSummary}</p>
                      {item.reviewedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Approved {new Date(item.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {/* Story 7.2: publish/unpublish toggle */}
                    <button
                      onClick={() =>
                        publishMutation.mutate({
                          evidenceId: item.id,
                          isPublished: !item.isPublished,
                        })
                      }
                      disabled={publishMutation.isPending}
                      className={`shrink-0 text-xs px-2 py-0.5 rounded border disabled:opacity-50 ${
                        item.isPublished
                          ? 'border-green-500 text-green-700 hover:bg-green-50'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {item.isPublished ? 'Published' : 'Publish'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Pending evidence section — enables Story 7.1 AC3 cache invalidation on approval */}
      {pendingEvidence.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">
            Pending Evidence ({pendingEvidence.length})
          </h2>
          <ul className="space-y-3">
            {pendingEvidence.map((item) => (
              <li
                key={item.id}
                className="border rounded p-4 bg-white flex items-start justify-between gap-4"
              >
                <div className="flex-1">
                  <p className="text-xs font-medium text-indigo-600 mb-1">
                    {item.skillCategory}
                  </p>
                  <p className="text-sm text-gray-700">{item.aiSummary}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      reviewMutation.mutate({ evidenceId: item.id, action: 'APPROVE' })
                    }
                    disabled={reviewMutation.isPending}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      reviewMutation.mutate({ evidenceId: item.id, action: 'REJECT' })
                    }
                    disabled={reviewMutation.isPending}
                    className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
