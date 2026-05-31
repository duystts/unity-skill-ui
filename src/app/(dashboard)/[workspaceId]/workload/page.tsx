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

function statusToPercent(status: WorkloadStatus): number {
  if (status === 'OVERLOADED') return 110;
  if (status === 'BALANCED')   return 75;
  return 40; // AVAILABLE
}

function memberInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

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

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-5 h-5 border-2 border-cobalt-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error === 'FORBIDDEN') return (
    <div className="p-8 text-sm text-red-600">Access denied. Only PM or Admin can view workload.</div>
  );
  if (error) return (
    <div className="p-8 text-sm text-red-600">Failed to load workload data.</div>
  );

  const overloadedCount = members.filter(m => m.workloadStatus === 'OVERLOADED').length;
  const totalOpen       = members.reduce((s, m) => s + m.openTicketCount, 0);
  const capacityPct     = members.length === 0 ? 0
    : Math.round(members.filter(m => m.workloadStatus !== 'OVERLOADED').length / members.length * 100);

  const summaryCards = [
    { label: 'TEAM CAPACITY', value: `${capacityPct}%` },
    { label: 'OPEN TICKETS',  value: totalOpen },
    { label: 'MEMBERS',       value: members.length },
  ];

  const isOverloaded = overloadedCount > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Workload</h1>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
          background: isOverloaded ? '#fef3c7' : '#d1fae5',
          color:      isOverloaded ? '#92400e' : '#065f46',
          border:     `1px solid ${isOverloaded ? '#fde68a' : '#a7f3d0'}`,
        }}>
          {isOverloaded ? `${overloadedCount} overloaded` : 'balanced'}
        </span>
        <div className="flex-1" />
        <button className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Rebalance
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl"
              style={{ padding: '14px 16px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {card.value}
              </div>
              <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Workload bars */}
        {members.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">No members found in this workspace.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 70px 120px',
              rowGap: 0,
              padding: 0,
            }}>
              {/* Header row */}
              {['Member', 'Load', 'Tickets', 'Status'].map((h, i) => (
                <div key={h} style={{
                  padding: i === 0 ? '10px 18px' : i === 3 ? '10px 18px 10px 0' : '10px 0',
                  fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  {h}
                </div>
              ))}

              {/* AC4: sorted by openTicketCount desc */}
              {members.map((member) => {
                const pct     = statusToPercent(member.workloadStatus);
                const barPct  = Math.min(pct, 100);
                const isOver  = pct > 100;
                const barColor = isOver ? '#ef4444' : '#3574f0';
                const initials = memberInitials(member.displayName);

                return (
                  <Link
                    key={member.userId}
                    href={`/${workspaceId}/workload/${member.userId}`}
                    style={{ display: 'contents', textDecoration: 'none' }}
                  >
                    {/* Col 1: avatar + name */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 18px',
                      borderBottom: '1px solid #f8fafc',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#3574f0', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, flexShrink: 0,
                      }}>{initials}</div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.displayName.split(' ')[0]}
                      </span>
                    </div>

                    {/* Col 2: progress bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      padding: '12px 14px 12px 0',
                      borderBottom: '1px solid #f8fafc',
                    }}>
                      <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${barPct}%`,
                          background: barColor, borderRadius: 99,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>

                    {/* Col 3: open count */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid #f8fafc',
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 12, color: '#64748b',
                    }}>
                      {member.openTicketCount} open
                    </div>

                    {/* Col 4: status + percentage */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 18px 12px 0',
                      borderBottom: '1px solid #f8fafc',
                    }}>
                      {isOver ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                          background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                        }}>
                          overloaded
                        </span>
                      ) : (
                        <span />
                      )}
                      <span style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 12, color: isOver ? '#ef4444' : '#64748b', fontWeight: 600,
                      }}>
                        {pct}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
