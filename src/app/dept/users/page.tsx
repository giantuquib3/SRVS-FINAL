'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  Spinner,
  accountStatusLabel,
  accountStatusTone,
  formatDate,
} from '@/components/ui';

const DEFAULT_PASSWORD = 'USJR@Faculty2026';

export default function DeptFacultyPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  // Add faculty
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD);
  const [newEmploymentType, setNewEmploymentType] = useState('Full-Time');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const flash = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role: 'Educator' });
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [uListRes, meRes] = await Promise.all([
        fetch(`/api/users?${params.toString()}`).then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);
      setUsers(uListRes.users || []);
      if (meRes?.user) setCurrentUser(meRes.user);
    } catch (err) {
      console.error('Error fetching department faculty:', err);
    } finally {
      setLoading(false);
    }
  };

  // Honor deep links such as /dept/users?status=PendingApproval before the first fetch
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status) setStatusFilter(status);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) fetchUsers();
  }, [ready, statusFilter]);

  const openCreateModal = () => {
    setNewUsername('');
    setNewFullName('');
    setNewEmail('');
    setNewPassword(DEFAULT_PASSWORD);
    setCreateError('');
    setCreateModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const cleanUsername = newUsername.trim();
    if (!/^\d{5}$/.test(cleanUsername)) return setCreateError('Faculty ID numbers must be exactly 5 digits (e.g., 10002).');
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail.endsWith('@usjr.edu.ph')) return setCreateError('Email must end with @usjr.edu.ph.');

    setCreateLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: cleanUsername,
          idNumber: cleanUsername,
          email: cleanEmail,
          password: newPassword,
          role: 'Educator',
          departmentId: currentUser?.departmentCode || currentUser?.departmentId || undefined,
          academicRank: newEmploymentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create account.');
        return;
      }
      setCreateModalOpen(false);
      flash(`Faculty account created for ${data.user?.fullName || 'user'}.`);
      await fetchUsers();
    } catch {
      setCreateError('Could not connect to the server.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAction = async (userId: string | number, action: string) => {
    setProcessingId(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        flash('Account updated.');
        await fetchUsers();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: string | number, userName: string) => {
    if (!confirm(`Deactivate the account for ${userName}?`)) return;
    setProcessingId(userId);
    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        flash(data.message || 'Account deactivated.');
        await fetchUsers();
      } else {
        alert(data.error || 'Failed to deactivate account.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const deptCode = currentUser?.departmentCode || currentUser?.departmentId || '';
  const deptName = currentUser?.departmentName || (deptCode ? `${deptCode} Department` : 'your department');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty"
        description={`Faculty accounts in ${deptName}.`}
        actions={
          <button onClick={openCreateModal} className="btn btn-primary">
            <UserPlus className="h-4 w-4" />
            Add faculty
          </button>
        }
      />

      {actionMessage && <Alert tone="success">{actionMessage}</Alert>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={fetchUsers}
            placeholder="Search by name, email, or ID"
            className="flex-1"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-44" aria-label="Status">
            <option value="">All statuses</option>
            <option value="PendingApproval">Pending approval</option>
            <option value="Active">Active</option>
            <option value="Deactivated">Deactivated</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <LoadingState />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No faculty found" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Employment</th>
                  <th>Courses</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const busy = processingId === u.id;
                  const courses: string[] = Array.isArray(u.assignedSubjects) ? u.assignedSubjects : [];
                  return (
                    <tr key={u.id}>
                      <td>
                        <p className="font-medium text-slate-900">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="font-mono text-xs text-slate-600">{u.idNumber || u.id || '—'}</td>
                      <td className="whitespace-nowrap">{u.academicRank || 'Full-Time'}</td>
                      <td>
                        {courses.length > 0 ? (
                          <span className="font-mono text-xs text-slate-700">{courses.join(', ')}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={accountStatusTone(u.accountStatus)}>{accountStatusLabel(u.accountStatus)}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{formatDate(u.createdAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {u.accountStatus === 'PendingApproval' ? (
                            <>
                              <button onClick={() => handleAction(u.id, 'Reject')} disabled={busy} className="btn btn-danger-outline btn-sm">
                                Reject
                              </button>
                              <button onClick={() => handleAction(u.id, 'Approve')} disabled={busy} className="btn btn-primary btn-sm">
                                Approve
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAction(u.id, u.accountStatus === 'Active' ? 'Deactivate' : 'Activate')}
                              disabled={busy}
                              className="btn btn-secondary btn-sm"
                            >
                              {u.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {String(currentUser?.id) !== String(u.id) && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              disabled={busy}
                              className="btn btn-ghost btn-icon text-slate-400 hover:text-rose-600"
                              title="Deactivate account"
                              aria-label={`Deactivate ${u.fullName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && users.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">{users.length} faculty</p>
        )}
      </Card>

      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add faculty"
        description={`The account will belong to ${deptName}.`}
        footer={
          <>
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" form="faculty-form" disabled={createLoading} className="btn btn-primary">
              {createLoading ? <Spinner /> : 'Create account'}
            </button>
          </>
        }
      >
        <form id="faculty-form" onSubmit={handleCreateUser} className="space-y-4">
          {createError && <Alert tone="error">{createError}</Alert>}
          <Field label="Full name" required>
            <input type="text" required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Faculty ID" required hint="5 digits">
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={5}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.replace(/\D/g, ''))}
                placeholder="10002"
                className="input font-mono"
              />
            </Field>
            <Field label="Employment">
              <select value={newEmploymentType} onChange={(e) => setNewEmploymentType(e.target.value)} className="input">
                <option value="Full-Time">Full-time</option>
                <option value="Part-Time">Part-time</option>
              </select>
            </Field>
          </div>
          <Field label="Institutional email" required>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@usjr.edu.ph"
              className="input"
            />
          </Field>
          <Field label="Temporary password" required hint="At least 6 characters. Share it with the faculty member.">
            <input
              type="text"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input font-mono"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
