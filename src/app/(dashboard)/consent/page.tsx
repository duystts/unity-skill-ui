'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export default function ConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleConsent = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/users/me/consent');
      // AC3: redirect to workspace after consent
      router.replace('/');
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
