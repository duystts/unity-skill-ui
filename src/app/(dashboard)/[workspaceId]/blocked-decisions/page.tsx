'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';

type BlockedReason = 'UNASSIGNED_OPEN_POOL' | 'PENDING_PR_REVIEW' | 'STALE_STAGE';

interface BlockedTicketInfo {
  ticketId: string;
  title: string;
  projectId: string;
  blockedReason: BlockedReason;
  blockedDurationHours: number;
}

const reasonLabel: Record<BlockedReason, string> = {
  UNASSIGNED_OPEN_POOL: 'Unassigned (Open Pool)',
  PENDING_PR_REVIEW:    'Pending PR Review',
  STALE_STAGE:          'No Stage Activity',
};

const reasonBadgeClass: Record<BlockedReason, string> = {
  UNASSIGNED_OPEN_POOL: 'bg-orange-100 text-orange-800 border border-orange-300',
  PENDING_PR_REVIEW:    'bg-purple-100 text-purple-800 border border-purple-300',
  STALE_STAGE:          'bg-gray-100 text-gray-700 border border-gray-300',
};

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem  = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

export default function BlockedDecisionsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [tickets, setTickets] = useState<BlockedTicketInfo[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/workspaces/${workspaceId}/team-health/blocked-decisions`)
      .then(res => setTickets(res.data.data.tickets))
      .catch((err: any) => {
        if (err.response?.status === 403) setError('FORBIDDEN');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="p-6">Loading blocked decisions...</div>;
  if (error === 'FORBIDDEN') return (
    <div className="p-6 text-red-600">Access denied. Only PM or Admin can view blocked decisions.</div>
  );
  if (error) return <div className="p-6 text-red-600">Failed to load blocked decisions.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Blocked Decisions</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tickets that need your attention to unblock the team.
      </p>

      {tickets.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No blocked tickets — the team is unblocked! 🎉
        </p>
      )}

      <ul className="space-y-3">
        {tickets.map(ticket => (
          <li key={ticket.ticketId} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* AC2: direct link to the ticket */}
                <Link
                  href={`/${workspaceId}/projects/${ticket.projectId}/tickets/${ticket.ticketId}`}
                  className="text-base font-semibold text-gray-900 hover:text-blue-700 hover:underline truncate block"
                >
                  {ticket.title}
                </Link>
                {/* AC2: blocked reason */}
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${reasonBadgeClass[ticket.blockedReason]}`}>
                  {reasonLabel[ticket.blockedReason]}
                </span>
              </div>
              {/* AC2: blocked duration */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-red-600">
                  {formatDuration(ticket.blockedDurationHours)}
                </p>
                <p className="text-xs text-gray-400">blocked</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
