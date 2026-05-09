'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';

type WorkloadStatus = 'AVAILABLE' | 'BALANCED' | 'OVERLOADED';

interface MemberWorkloadInfo {
  userId: string;
  displayName: string;
  role: string;
  openTicketCount: number;
  inProgressTicketCount: number;
  workloadStatus: WorkloadStatus;
}

const statusBadgeClass: Record<WorkloadStatus, string> = {
  AVAILABLE:  'bg-green-100 text-green-800 border border-green-300',
  BALANCED:   'bg-yellow-100 text-yellow-800 border border-yellow-300',
  OVERLOADED: 'bg-red-100 text-red-800 border border-red-300',
};

export default function WorkloadPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [members, setMembers] = useState<MemberWorkloadInfo[]>([]);
  const [error, setError]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/workspaces/${workspaceId}/team-health/workload`)
      .then(res => setMembers(res.data.data.members))
      .catch((err: any) => {
        if (err.response?.status === 403) setError('FORBIDDEN');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="p-6">Loading workload...</div>;
  if (error === 'FORBIDDEN') return (
    <div className="p-6 text-red-600">Access denied. Only PM or Admin can view workload.</div>
  );
  if (error) return <div className="p-6 text-red-600">Failed to load workload data.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Member Workload</h1>

      {/* AC4: sorted by openTicketCount desc (backend guarantees order) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(member => (
          /* AC3: clicking member navigates to detail view */
          <Link
            key={member.userId}
            href={`/${workspaceId}/workload/${member.userId}`}
            className="block bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900">{member.displayName}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadgeClass[member.workloadStatus]}`}>
                {member.workloadStatus}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>
                <span className="font-bold text-gray-900">{member.openTicketCount}</span> open
              </div>
              <div>
                <span className="font-bold text-gray-900">{member.inProgressTicketCount}</span> in progress
              </div>
            </div>
          </Link>
        ))}
      </div>

      {members.length === 0 && (
        <p className="text-gray-500 text-center py-8">No members found in this workspace.</p>
      )}
    </div>
  );
}
