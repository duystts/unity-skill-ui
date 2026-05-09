'use client'

import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/lib/apiClient'

export default function UIModeToggle() {
  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)

  const handleToggle = async () => {
    const newMode = mode === 'character' ? 'serious' : 'character'
    const apiMode = newMode === 'character' ? 'CHARACTER' : 'SERIOUS'
    // Optimistic update
    setMode(newMode)
    try {
      await apiClient.patch('/users/me/preferences', { uiMode: apiMode })
    } catch {
      // Revert on failure
      setMode(mode)
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="px-3 py-1 text-sm rounded border hover:bg-gray-100"
    >
      {mode === 'character' ? '🎭 Character' : '💼 Serious'}
    </button>
  )
}
