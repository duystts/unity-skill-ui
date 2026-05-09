'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

type WorkloadStatus = 'AVAILABLE' | 'BALANCED' | 'OVERLOADED';

interface MemberHealthInfo {
  userId: string;
  displayName: string;
  role: string;
  openTicketCount: number;
  lastActivityDate: string | null;
  workloadStatus: WorkloadStatus;
}

interface TeamHealthData {
  totalOpenTickets: number;
  overdueTickets: number;
  members: MemberHealthInfo[];
}

export default function TeamHealthPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [health, setHealth] = useState<TeamHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/workspaces/${workspaceId}/team-health`)
      .then(res => setHealth(res.data.data))
      .catch((err: any) => {
        if (err.response?.status === 403) setError('FORBIDDEN');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <h1 className="text-lg font-bold text-gray-900">Team health</h1>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <p className="text-gray-400 text-sm">Loading team health...</p>
        </div>
      </div>
    );
  }

  if (error === 'FORBIDDEN') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <h1 className="text-lg font-bold text-gray-900">Team health</h1>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <p className="text-red-600 text-sm">Access denied. Only PM or Admin can view team health.</p>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <h1 className="text-lg font-bold text-gray-900">Team health</h1>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <p className="text-red-600 text-sm">Failed to load team health data.</p>
        </div>
      </div>
    );
  }

  const overloadedCount = health.members.filter((m) => m.workloadStatus === 'OVERLOADED').length;

  const kpiCards = [
    { label: 'Total Open', value: health.totalOpenTickets },
    {
      label: 'Overdue',
      value: health.overdueTickets,
      warn: health.overdueTickets > 0,
    },
    { label: 'Blocked decisions', value: 0 },
    { label: 'Members', value: health.members.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Team health</h1>
        <div className="flex-1" />
        <button className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Export
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p
                className={`text-2xl font-extrabold mb-0.5 ${
                  kpi.warn ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {kpi.value}
              </p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Member table */}
        {health.members.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No members in this workspace.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] px-4 py-2.5 bg-slate-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <span>Member</span>
              <span>Role</span>
              <span>Workload</span>
              <span>Tickets</span>
              <span>Status</span>
            </div>

            {/* Table rows */}
            {health.members.map((member) => {
              const isOverloaded = member.workloadStatus === 'OVERLOADED';
              const isAvailable = member.workloadStatus === 'AVAILABLE';
              const barColor = isOverloaded
                ? 'bg-red-400'
                : isAvailable
                ? 'bg-amber-400'
                : 'bg-indigo-400';
              const barWidth = isOverloaded ? '100%' : isAvailable ? '30%' : '65%';

              return (
                <div
                  key={member.userId}
                  className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] px-4 py-3 border-b border-gray-50 items-center last:border-0"
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 shrink-0">
                      {member.displayName[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{member.displayName}</span>
                  </div>

                  {/* Role */}
                  <span className="text-sm text-gray-500">{member.role}</span>

                  {/* Workload bar */}
                  <div className="flex items-center gap-2 pr-4">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>

                  {/* Open tickets */}
                  <span className="text-sm text-gray-700">{member.openTicketCount}</span>

                  {/* Status pill */}
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                      isOverloaded
                        ? 'bg-red-100 text-red-700'
                        : isAvailable
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {isOverloaded ? 'Overloaded' : isAvailable ? 'Available' : 'Balanced'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
