'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

export default function ConsentPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  const handleConsent = async () => {
    setLoading(true);
    setError(null);
    try {
      // Update display name if changed
      const trimmed = displayName.trim();
      if (trimmed && trimmed !== user?.displayName) {
        const res = await apiClient.patch<{ data: { id: string; displayName: string } }>(
          '/users/me/display-name',
          { displayName: trimmed }
        );
        if (user) setUser({ ...user, displayName: res.data.data.displayName });
      }
      await apiClient.post('/users/me/consent');
      router.replace('/workspaces');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md max-w-lg w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Unity Skill</h1>
        <p className="text-sm text-gray-500 mb-6">
          Before you begin, please review what we collect and how we use it.
        </p>

        {/* AC2: explains what data is collected */}
        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 mb-1">What we collect</h2>
            <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
              <li>GitHub PR activity (branches, merges, reviews)</li>
              <li>Chat messages in workspace channels</li>
              <li>Meeting transcript summaries</li>
            </ul>
          </div>

          {/* AC2: explains how it is used */}
          <div className="bg-green-50 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-green-900 mb-1">How we use it</h2>
            <p className="text-sm text-green-800">
              We analyse these signals to generate skill evidence — verifiable proof of your
              technical contributions — that you control and can publish to your public portfolio.
            </p>
          </div>

          {/* AC2: tracking can be paused at any time */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-yellow-900 mb-1">Your control</h2>
            <p className="text-sm text-yellow-800">
              You can pause contribution tracking at any time using Incognito Mode in your
              profile settings. Your evidence is private by default — nothing is published
              without your explicit action.
            </p>
          </div>
        </div>

        {/* Display name */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
            Your display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How teammates will see you"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-400 mt-1">You can change this anytime in settings.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* AC3: "I Agree" button triggers POST /api/v1/users/me/consent */}
        <button
          onClick={handleConsent}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Recording consent\u2026' : 'I Agree \u2014 Continue to Unity Skill'}
        </button>
      </div>
    </div>
  );
}
