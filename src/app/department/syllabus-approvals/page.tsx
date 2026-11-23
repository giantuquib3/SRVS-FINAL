'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Clock, Layers, Send, XCircle } from 'lucide-react';
import {
  Alert,
  Card,
  DeptTag,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
  formatDate,
} from '@/components/ui';
import { formatVersionLabel, roleLabel } from '@/lib/status';
import { DEPARTMENTS } from '@/lib/departments';

type StatusFilter = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL';

export default function SyllabusApprovalsPage() {
  const [viewerRole, setViewerRole] = useState('');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [department, setDepartment] = useState<{ id: string; code: string; name: string } | null>(null);
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING_APPROVAL');
  const [view, setView] = useState<'review' | 'mine'>('review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');
    try {
      const deptQuery = departmentFilter ? `&departmentId=${encodeURIComponent(departmentFilter)}` : '';
      const [res, deptRes] = await Promise.all([
        fetch(`/api/syllabus-approvals?status=${statusFilter}${deptQuery}`),
        fetch('/api/departments'),
      ]);
      const data = await res.json();
      if (deptRes.ok) {
        const deptJson = await deptRes.json();
        if (deptJson?.departments?.length) setDepartmentsList(deptJson.departments);
      }
      if (!res.ok) {
        setError(data.error || 'Failed to load the approval queue.');
        return;
      }
      setViewerRole(data.role || '');
      setApprovals(data.approvals || []);
      setMySubmissions(data.mySubmissions || []);
      if (data.stats) setStats(data.stats);
      setDepartment(data.department || null);
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter, departmentFilter]);

  const isDean = viewerRole === 'Dean';
  const isDeptHead = viewerRole === 'DepartmentHead';
  const showDept = isDean || viewerRole === 'Admin';
  const list = view === 'mine' ? mySubmissions : approvals;

  const selectFilter = (s: StatusFilter) => {
    setView('review');
    setStatusFilter(s);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Syllabus approvals"
        description={
          isDean
            ? 'Revisions submitted by Department Heads across all departments.'
            : isDeptHead
              ? `Revisions submitted by faculty in ${department?.name || department?.code || 'your department'}.`
              : 'Approval history and active review queues.'
        }
        actions={
          showDept && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="input w-60"
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending review"
          value={stats.pending}
          icon={Clock}
          tone={stats.pending ? 'amber' : 'default'}
          active={view === 'review' && statusFilter === 'PENDING_APPROVAL'}
          onClick={() => selectFilter('PENDING_APPROVAL')}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          active={view === 'review' && statusFilter === 'APPROVED'}
          onClick={() => selectFilter('APPROVED')}
        />
        <StatCard
          label="Returned for revision"
          value={stats.rejected}
          icon={XCircle}
          tone={stats.rejected ? 'red' : 'default'}
          active={view === 'review' && statusFilter === 'REJECTED'}
          onClick={() => selectFilter('REJECTED')}
        />
        {isDeptHead ? (
          <StatCard
            label="My revisions to the Dean"
            value={mySubmissions.length}
            icon={Send}
            active={view === 'mine'}
            onClick={() => setView('mine')}
          />
        ) : (
          <StatCard
            label="All versions"
            value={stats.total}
            icon={Layers}
            active={view === 'review' && statusFilter === 'ALL'}
            onClick={() => selectFilter('ALL')}
          />
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={view === 'mine' ? 'No revisions yet' : 'Nothing here'}
            description={
              view === 'mine'
                ? 'Syllabus edits you submit as Department Head appear here with the Dean’s decision.'
                : statusFilter === 'PENDING_APPROVAL'
                  ? 'All submissions have been reviewed.'
                  : 'No submissions match this filter.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Author</th>
                  <th>Change summary</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const course = item.syllabus?.course || item.syllabus?.subject;
                  const editor = item.editor || item.syllabus?.instructor;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="code">{course?.code}</span>
                          {showDept && <DeptTag code={item.syllabus?.departmentId} />}
                        </div>
                        <p className="max-w-[220px] truncate text-slate-900">{course?.title}</p>
                      </td>
                      <td>
                        <p className="capitalize text-slate-900">{editor?.fullName || '—'}</p>
                        <p className="text-xs text-slate-500">{roleLabel(editor?.role)}</p>
                      </td>
                      <td className="max-w-xs">
                        <p className="text-xs font-medium text-slate-500">{formatVersionLabel(item)}</p>
                        <p className="mt-0.5 line-clamp-2 text-slate-700">{item.changeSummary}</p>
                        {item.reviewComments && (
                          <p className="mt-1 truncate text-xs italic text-slate-500">Feedback: “{item.reviewComments}”</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{formatDate(item.submittedAt || item.createdAt)}</td>
                      <td>
                        <StatusBadge status={item.approvalStatus} />
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/department/syllabus-approvals/${item.id}`}
                          className={`btn btn-sm ${item.canReview ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {item.canReview ? 'Review' : 'Open'}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
