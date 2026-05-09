'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';

interface TicketInfo {
  id: string;
  title: string;
  stageId: string | null;
}

export default function MemberWorkloadDetailPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const userId      = params.userId as string;
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/workspaces/${workspaceId}/team-health/workload/${userId}/tickets`)
      .then(res => setTickets(res.data.data))
      .catch((err: any) => {
        if (err.response?.status === 403) setError('FORBIDDEN');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, userId]);

  if (loading) return <div className="p-6">Loading tickets...</div>;
  if (error === 'FORBIDDEN') return <div className="p-6 text-red-600">Access denied.</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load tickets.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href={`/${workspaceId}/workload`} className="text-sm text-blue-600 hover:underline">
          ← Back to Workload
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Open Tickets</h1>

      <ul className="space-y-2">
        {tickets.map(ticket => (
          <li key={ticket.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
            <span className="text-gray-900 text-sm font-medium">{ticket.title}</span>
            {ticket.stageId ? (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">In stage</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">No stage</span>
            )}
          </li>
        ))}
      </ul>

      {tickets.length === 0 && (
        <p className="text-gray-500 text-center py-8">No open tickets assigned to this member.</p>
      )}
    </div>
  );
}
