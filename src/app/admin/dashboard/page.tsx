'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, Eye, FileText, KeyRound, Users } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  DeptTag,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  StatCard,
  formatDate,
} from '@/components/ui';
import { roleLabel } from '@/lib/status';

const DEFAULT_RESET_PASSWORD = 'USJR@Reset2026';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingSyllabi, setPendingSyllabi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [newResetPassword, setNewResetPassword] = useState(DEFAULT_RESET_PASSWORD);
  const [notice, setNotice] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, syllabiRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/users?status=PendingApproval'),
        fetch('/api/syllabi?status=Submitted'),
      ]);
      setData(await statsRes.json());
      setPendingUsers((await usersRes.json()).users || []);
      setPendingSyllabi((await syllabiRes.json()).syllabi || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUserAction = async (userId: string, action: 'Approve' | 'Reject') => {
    setProcessingId(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) await fetchDashboardData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleSyllabusReview = async (syllabusId: string, action: 'Approve' | 'Reject') => {
    setProcessingId(syllabusId);
    try {
      const res = await fetch(`/api/syllabi/${syllabusId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: `${action}d by System Administrator` }),
      });
      if (res.ok) await fetchDashboardData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdminPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setProcessingId(resetModalUser.id);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetModalUser.id, action: 'ResetPassword', newPassword: newResetPassword }),
      });
      if (res.ok) {
        setNotice(`Password for ${resetModalUser.fullName} was reset to: ${newResetPassword}`);
        setResetModalUser(null);
        await fetchDashboardData();
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !data) return <LoadingState className="min-h-[60vh]" />;

  const stats = data?.stats || {};
  const recentActivities = data?.recentActivities || [];
  const passwordResetRequests = data?.passwordResetRequests || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin dashboard" description="Accounts, approvals, and system activity at a glance." />

      {notice && (
        <Alert tone="success" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered users" value={stats.totalUsers ?? 0} icon={Users} />
        <StatCard
          label="Pending registrations"
          value={stats.pendingRegistrations ?? 0}
          icon={Clock}
          tone={stats.pendingRegistrations ? 'amber' : 'default'}
        />
        <StatCard
          label="Syllabi"
          value={stats.totalSyllabi ?? 0}
          hint={`${stats.pendingSyllabi ?? 0} awaiting review`}
          icon={BookOpen}
        />
        <StatCard
          label="Password resets"
          value={passwordResetRequests.length}
          icon={KeyRound}
          tone={passwordResetRequests.length ? 'amber' : 'default'}
        />
      </div>

      {passwordResetRequests.length > 0 && (
        <Card>
          <CardHeader title="Password reset requests" description="Requested from the sign-in page." />
          <ul className="divide-y divide-slate-100">
            {passwordResetRequests.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{u.fullName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {u.email} · {roleLabel(u.role)} · ID {u.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(u);
                    setNewResetPassword(DEFAULT_RESET_PASSWORD);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Reset password
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pending registrations"
            actions={<Badge tone={pendingUsers.length ? 'amber' : 'gray'}>{pendingUsers.length}</Badge>}
          />
          {pendingUsers.length === 0 ? (
            <EmptyState icon={Users} title="No pending registrations" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{u.fullName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="truncate">{u.email}</span>
                      <span>·</span>
                      <span>{roleLabel(u.role)}</span>
                      <DeptTag code={u.departmentCode || u.department?.code} />
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => handleUserAction(u.id, 'Reject')}
                      disabled={processingId === u.id}
                      className="btn btn-danger-outline btn-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleUserAction(u.id, 'Approve')}
                      disabled={processingId === u.id}
                      className="btn btn-primary btn-sm"
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Syllabi awaiting review"
            actions={<Badge tone={pendingSyllabi.length ? 'amber' : 'gray'}>{pendingSyllabi.length}</Badge>}
          />
          {pendingSyllabi.length === 0 ? (
            <EmptyState icon={FileText} title="Nothing awaiting review" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingSyllabi.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-900">
                      <span className="code mr-1.5">{s.course.code}</span>
                      {s.course.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {s.instructor?.fullName} · v{s.currentVersionNumber} · {s.semester}, AY {s.academicYear}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Link href={`/syllabi/${s.id}`} className="btn btn-ghost btn-icon" title="View syllabus">
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleSyllabusReview(s.id, 'Reject')}
                      disabled={processingId === s.id}
                      className="btn btn-danger-outline btn-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleSyllabusReview(s.id, 'Approve')}
                      disabled={processingId === s.id}
                      className="btn btn-primary btn-sm"
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent activity"
          actions={
            <Link href="/admin/audit-logs" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              View audit log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {recentActivities.length === 0 ? (
          <EmptyState title="No recent activity" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Description</th>
                  <th>When</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((log: any) => (
                  <tr key={log.id}>
                    <td className="font-medium text-slate-900">{log.actionType}</td>
                    <td>{log.userDisplayName || 'System'}</td>
                    <td className="max-w-md truncate text-slate-600">{log.description}</td>
                    <td className="whitespace-nowrap text-slate-500">{formatDate(log.createdAt, true)}</td>
                    <td>
                      <Badge tone={log.resultStatus === 'Success' ? 'green' : 'red'}>{log.resultStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(resetModalUser)}
        onClose={() => setResetModalUser(null)}
        title="Reset password"
        description={resetModalUser ? `${resetModalUser.fullName} · ${resetModalUser.email}` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setResetModalUser(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              form="reset-form"
              disabled={processingId === resetModalUser?.id}
              className="btn btn-primary"
            >
              Reset password
            </button>
          </>
        }
      >
        <form id="reset-form" onSubmit={handleAdminPasswordReset}>
          <Field label="New temporary password" required hint="Share this with the user so they can sign in.">
            <input
              type="text"
              required
              minLength={6}
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              className="input font-mono"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
