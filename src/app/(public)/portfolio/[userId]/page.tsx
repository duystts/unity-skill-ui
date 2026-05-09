'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiClient } from '@/lib/apiClient'

interface EvidenceItem {
  id: string
  skillCategory: string
  aiSummary: string
  developerNotes: string | null
  publishedAt: string | null
}

interface SkillGroup {
  skillCategory: string
  count: number
  items: EvidenceItem[]
}

interface StreakInfo {
  currentWeeks: number
  longestWeeks: number
}

interface PublicPortfolioData {
  userId: string
  displayName: string
  skills: SkillGroup[]
  endorsements: unknown[]
  streak: StreakInfo | null
}

type PageState = 'loading' | 'found' | 'not-found' | 'error'

export default function PublicPortfolioPage() {
  const params = useParams()
  const userId = params.userId as string

  const [state, setState] = useState<PageState>('loading')
  const [portfolio, setPortfolio] = useState<PublicPortfolioData | null>(null)

  useEffect(() => {
    if (!userId) return

    apiClient
      .get<{ data: PublicPortfolioData }>(`/public/portfolio/${userId}`)
      .then((res) => {
        setPortfolio(res.data.data)
        setState('found')
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403 || status === 404) {
          setState('not-found')
        } else {
          setState('error')
        }
      })
  }, [userId])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading portfolio...</p>
      </div>
    )
  }

  if (state === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Portfolio not found</h1>
          <p className="text-gray-600">
            This portfolio does not exist or is not publicly accessible.
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
          <p className="text-gray-600">Unable to load this portfolio. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{portfolio?.displayName}</h1>
          <p className="text-gray-500 mt-1 text-sm">Public Skill Portfolio</p>
        </div>

        {/* Streak Badge — Story 7.5 */}
        {portfolio?.streak && (
          <div className="mt-6 mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="font-semibold text-orange-800">
                {portfolio.streak.currentWeeks} week streak
              </p>
              <p className="text-sm text-orange-600">
                Longest: {portfolio.streak.longestWeeks} weeks
              </p>
            </div>
          </div>
        )}

        {/* Skills section */}
        {(portfolio?.skills ?? []).length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-400 text-sm">No published skill evidence yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {portfolio!.skills.map((group) => (
              <div key={group.skillCategory} className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {group.skillCategory}
                  </h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                    {group.count} item{group.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <ul className="space-y-4">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="border-l-2 border-indigo-200 pl-4 text-sm text-gray-700"
                    >
                      <p>{item.developerNotes ?? item.aiSummary}</p>
                      {item.publishedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Published {new Date(item.publishedAt).toLocaleDateString()}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Endorsements section — placeholder for Story 7.4 */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Endorsements</h2>
          {(portfolio?.endorsements ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm">No endorsements yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
