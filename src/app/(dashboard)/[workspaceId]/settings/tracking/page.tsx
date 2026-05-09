'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Permission {
  id: string;
  resourceType: 'GITHUB_REPO' | 'CHAT_CHANNEL';
  resourceId: string;
  enabled: boolean;
  updatedAt: string;
}

interface GroupedPermissions {
  GITHUB_REPO?: Permission[];
  CHAT_CHANNEL?: Permission[];
}

export default function TrackingPermissionsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [grouped, setGrouped] = useState<GroupedPermissions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // permissionId being saved
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem('token');

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/users/me/tracking-permissions`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      if (!res.ok) throw new Error('Failed to load permissions');
      const json = await res.json();
      setGrouped(json.data ?? {});
    } catch {
      setError('Failed to load tracking permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPermissions(); }, [workspaceId]);

  const toggle = async (resourceType: Permission['resourceType'],
                        resourceId: string, currentEnabled: boolean) => {
    setSaving(`${resourceType}:${resourceId}`);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/users/me/tracking-permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resourceType, resourceId, enabled: !currentEnabled }),
        }
      );
      if (!res.ok) throw new Error('Failed to save');
      await fetchPermissions();
    } catch {
      setError('Failed to update permission. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const renderSection = (
    title: string,
    description: string,
    perms: Permission[] | undefined
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
      <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {!perms || perms.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No {title.toLowerCase()} connected yet.</p>
      ) : (
        <ul className="space-y-3">
          {perms.map(p => {
            const key = `${p.resourceType}:${p.resourceId}`;
            const isSaving = saving === key;
            return (
              <li key={p.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-mono">{p.resourceId}</span>
                <button
                  onClick={() => toggle(p.resourceType, p.resourceId, p.enabled)}
                  disabled={isSaving}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    p.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  } disabled:opacity-50`}
                >
                  {isSaving ? 'Saving\u2026' : p.enabled ? 'Tracking ON' : 'Tracking OFF'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (loading) return (
    <div className="p-8 text-sm text-gray-500">Loading tracking permissions\u2026</div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracking Permissions</h1>
      <p className="text-sm text-gray-500 mb-6">
        Control which repositories and channels contribute to your skill evidence.
        Disabling tracking for a resource excludes it from your contribution analysis \u2014 other
        members are unaffected.
      </p>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {renderSection(
        'GitHub Repositories',
        'When tracking is OFF for a repository, merged PRs from that repo are excluded from your skill evidence.',
        grouped.GITHUB_REPO
      )}

      {renderSection(
        'Chat Channels',
        'When tracking is OFF for a channel, messages you send there are excluded from your contribution analysis.',
        grouped.CHAT_CHANNEL
      )}
    </div>
  );
}
