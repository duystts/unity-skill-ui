'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';

type DeletionCounts = {
  contributionEvents: number;
  skillEvidences: number;
  contributionStreaks: number;
  awayPeriods: number;
  endorsements: number;
  trackingPermissions: number;
};

export default function PrivacySettingsPage() {
  // ── Export state ───────────────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'requesting' | 'processing' | 'ready' | 'error'
  >('idle');

  // ── Deletion state ─────────────────────────────────────────────────────────
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<
    'idle' | 'deleting' | 'done' | 'error'
  >('idle');
  const [deletionCounts, setDeletionCounts] = useState<DeletionCounts | null>(null);

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleRequestExport = async () => {
    setExportStatus('requesting');
    try {
      const res = await apiClient.post('/users/me/data-export');
      const body = res.data;
      if (body.status === 'IN_PROGRESS' || body.status === 'PROCESSING' || body.data?.status === 'IN_PROGRESS' || body.data?.status === 'PROCESSING') {
        setExportStatus('processing');
      } else {
        setExportStatus('error');
      }
    } catch {
      setExportStatus('error');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await apiClient.get('/users/me/data-export/download', {
        responseType: 'blob'
      });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'unity-skill-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportStatus('error');
    }
  };

  // ── Deletion handler ───────────────────────────────────────────────────────
  const handleDeleteData = async () => {
    if (!deletionConfirmed) return;
    setDeletionStatus('deleting');
    try {
      const res = await apiClient.delete('/users/me/contribution-data');
      const body = res.data;
      setDeletionCounts(body.data?.deletedRecords || body.deletedRecords);
      setDeletionStatus('done');
    } catch {
      setDeletionStatus('error');
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy & Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage your personal contribution data. Exports include all contribution events,
        skill evidences, streaks, and away periods associated with your account.
      </p>

      {/* ── Export Section ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Export My Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Download a copy of all your personal contribution data as a JSON file.
          You will receive a notification when your export is ready.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRequestExport}
            disabled={exportStatus === 'requesting' || exportStatus === 'processing'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportStatus === 'requesting' ? 'Requesting\u2026' :
             exportStatus === 'processing' ? 'Preparing export\u2026' :
             'Request Data Export'}
          </button>

          {exportStatus === 'processing' && (
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-700"
            >
              Download Export
            </button>
          )}
        </div>

        {exportStatus === 'error' && (
          <p className="mt-3 text-sm text-red-600">Something went wrong. Please try again.</p>
        )}
        {exportStatus === 'processing' && (
          <p className="mt-3 text-sm text-gray-500">
            Your export is being prepared. Click &quot;Download Export&quot; once you receive
            the notification, or check back in a moment.
          </p>
        )}
      </div>

      {/* ── Delete Section ── */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Delete My Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete all your contribution data including contribution events, skill
          evidences, streaks, away periods, endorsements, and tracking permissions.
          Your account and workspace memberships will remain.{' '}
          <strong>This cannot be undone.</strong>
        </p>

        {deletionStatus === 'done' && deletionCounts ? (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Deletion complete. Records removed:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              {Object.entries(deletionCounts).map(([key, val]) => (
                <li key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-mono">{val}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={deletionConfirmed}
                onChange={e => setDeletionConfirmed(e.target.checked)}
                className="w-4 h-4 text-red-600"
              />
              I understand this is permanent and cannot be undone
            </label>

            <button
              onClick={handleDeleteData}
              disabled={!deletionConfirmed || deletionStatus === 'deleting'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium
                         hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletionStatus === 'deleting' ? 'Deleting\u2026' : 'Delete My Data'}
            </button>

            {deletionStatus === 'error' && (
              <p className="mt-3 text-sm text-red-600">
                Something went wrong. Please try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
