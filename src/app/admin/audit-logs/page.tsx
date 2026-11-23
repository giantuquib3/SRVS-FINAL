'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Badge, Card, DeptTag, EmptyState, LoadingState, PageHeader, SearchInput, formatDate } from '@/components/ui';
import { roleLabel } from '@/lib/status';

const ACTION_TYPES = [
  'Login',
  'Register',
  'CreateUser',
  'DeleteUser',
  'CreateCourse',
  'CreateSyllabus',
  'EditSyllabus',
  'SubmitSyllabus',
  'ApproveSyllabus',
  'RejectSyllabus',
  'RestoreVersion',
];

function resultTone(status: string) {
  if (status === 'Success') return 'green' as const;
  if (status === 'Warning') return 'amber' as const;
  return 'red' as const;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [resultStatus, setResultStatus] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionType) params.append('actionType', actionType);
      if (resultStatus) params.append('resultStatus', resultStatus);
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionType, resultStatus]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="A record of sign-ins, account changes, and syllabus activity." />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={fetchLogs}
            placeholder="Search by user, action, or description"
            className="flex-1"
          />
          <div className="flex gap-2">
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="input sm:w-44" aria-label="Action type">
              <option value="">All actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={resultStatus} onChange={(e) => setResultStatus(e.target.value)} className="input sm:w-36" aria-label="Result">
              <option value="">All results</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Warning">Warning</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <EmptyState icon={History} title="No matching events" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Description</th>
                  <th>Result</th>
                  <th>IP address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-slate-500">{formatDate(log.createdAt, true)}</td>
                    <td className="font-medium text-slate-900">{log.actionType}</td>
                    <td>
                      <p className="text-slate-900">{log.userDisplayName || 'System'}</p>
                      {log.user?.role && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          {roleLabel(log.user.role)}
                          <DeptTag code={log.user.departmentCode} />
                        </p>
                      )}
                    </td>
                    <td className="max-w-md text-slate-600">{log.description}</td>
                    <td>
                      <Badge tone={resultTone(log.resultStatus)}>{log.resultStatus}</Badge>
                    </td>
                    <td className="font-mono text-xs text-slate-400">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && logs.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">{logs.length} events</p>
        )}
      </Card>
    </div>
  );
}
