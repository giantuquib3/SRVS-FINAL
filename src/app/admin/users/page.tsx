'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  DeptTag,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  Spinner,
  Tabs,
  accountStatusLabel,
  accountStatusTone,
  formatDate,
} from '@/components/ui';
import { roleLabel } from '@/lib/status';

/** Roles that are institution-wide and have no department. */
const NO_DEPT_ROLES = ['Admin', 'Registrar', 'VPAcademics', 'Dean'];

const ROLE_OPTIONS = [
  { id: 'Registrar', label: 'School Registrar' },
  { id: 'VPAcademics', label: 'VP-Academics' },
  { id: 'Dean', label: 'Dean' },
  { id: 'DepartmentHead', label: 'Department Head' },
  { id: 'Educator', label: 'Faculty' },
  { id: 'Admin', label: 'System Administrator' },
];

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [actionMessage, setActionMessage] = useState('');

  // Create user
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('DepartmentHead');
  const [newDeptId, setNewDeptId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Change role
  const [roleModalUser, setRoleModalUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  const flash = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('role', roleFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [uListRes, dRes, meRes] = await Promise.all([
        fetch(`/api/users?${params.toString()}`).then((r) => r.json()),
        fetch('/api/departments').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);
      setUsers(uListRes.users || []);
      if (uListRes.counts) setCounts(uListRes.counts);
      setDepartments(dRes.departments || []);
      if (meRes?.user) setCurrentUser(meRes.user);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const cleanUsername = newUsername.trim();
    if (!cleanUsername) return setCreateError('ID number is required.');
    if (!ROLE_OPTIONS.some((r) => r.id === newRole)) return setCreateError('Please select a valid role.');
    if (!NO_DEPT_ROLES.includes(newRole) && !newDeptId) return setCreateError('Please select a department for this role.');
    if (!/^\d{5}$/.test(cleanUsername) && !(newRole === 'Admin' && cleanUsername === '0')) {
      return setCreateError('ID numbers must be 5 digits (or 0 for the Super Admin).');
    }
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
          role: newRole,
          departmentId: newDeptId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user.');
        return;
      }
      setCreateModalOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewDeptId('');
      flash(`Account created for ${data.user?.fullName || 'user'}.`);
      await fetchUsers();
    } catch {
      setCreateError('Could not connect to the server.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string, newRoleValue?: string, newDeptValue?: string | null) => {
    setProcessingId(userId);
    try {
      const payload: any = { userId, action, newRole: newRoleValue };
      if (action === 'ChangeRole' && newRoleValue) {
        payload.departmentId = NO_DEPT_ROLES.includes(newRoleValue) ? null : newDeptValue || null;
      }
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (action === 'ChangeRole') setRoleModalUser(null);
        await fetchUsers();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete or deactivate the account for ${userName}?`)) return;
    setProcessingId(userId);
    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        flash(data.message || 'User removed.');
        await fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const openRoleModal = (u: any) => {
    setRoleModalUser(u);
    setSelectedRole(u.role);
    setSelectedDeptId(NO_DEPT_ROLES.includes(u.role) ? '' : u.departmentId || u.departmentCode || '');
  };

  const tabs = [
    { id: '', label: 'All', count: counts.total },
    { id: 'DepartmentHead', label: 'Department Heads', count: counts.deptHeads },
    { id: 'Educator', label: 'Faculty', count: counts.educators },
    { id: 'Dean', label: 'Deans' },
    { id: 'Registrar', label: 'Registrar' },
    { id: 'VPAcademics', label: 'VP-Academics' },
    { id: 'Admin', label: 'Admins', count: counts.admins },
  ];

  const deptSelect = (value: string, onChange: (v: string) => void, role: string) =>
    NO_DEPT_ROLES.includes(role) ? (
      <input type="text" disabled value="Institution-wide (no department)" className="input" />
    ) : (
      <select value={value} onChange={(e) => onChange(e.target.value)} required className="input">
        <option value="">Select a department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.code} — {d.name}
          </option>
        ))}
      </select>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create accounts, approve registrations, and manage roles."
        actions={
          <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
            <UserPlus className="h-4 w-4" />
            New user
          </button>
        }
      />

      {actionMessage && <Alert tone="success">{actionMessage}</Alert>}

      <Card>
        <div className="px-4 pt-3">
          <Tabs tabs={tabs} active={roleFilter} onChange={setRoleFilter} />
        </div>
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
          <EmptyState icon={Users} title="No users found" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const busy = processingId === u.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <p className="font-medium text-slate-900">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        {u.role === 'Educator' && u.assignedSubjects?.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Teaches <span className="font-mono text-slate-700">{u.assignedSubjects.join(', ')}</span>
                          </p>
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-600">{u.idNumber || u.username || '—'}</td>
                      <td className="whitespace-nowrap">{roleLabel(u.role)}</td>
                      <td>
                        {NO_DEPT_ROLES.includes(u.role) ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : u.departmentCode || u.departmentId || u.department?.code ? (
                          <span className="flex items-center gap-1.5">
                            <DeptTag code={u.departmentCode || u.departmentId || u.department?.code} />
                            <span className="truncate text-xs text-slate-500">{u.departmentName || u.department?.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
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
                            <>
                              <button onClick={() => openRoleModal(u)} className="btn btn-ghost btn-sm">
                                Change role
                              </button>
                              <button
                                onClick={() => handleAction(u.id, u.accountStatus === 'Active' ? 'Deactivate' : 'Activate')}
                                disabled={busy}
                                className="btn btn-secondary btn-sm"
                              >
                                {u.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              disabled={busy}
                              className="btn btn-ghost btn-icon text-slate-400 hover:text-rose-600"
                              title="Delete user"
                              aria-label={`Delete ${u.fullName}`}
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
      </Card>

      {/* Create user */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="New user"
        description="Department applies only to Department Heads and Faculty."
        footer={
          <>
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" form="create-user-form" disabled={createLoading} className="btn btn-primary">
              {createLoading ? <Spinner /> : 'Create user'}
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
          {createError && <Alert tone="error">{createError}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" required>
              <select
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value);
                  setNewUsername('');
                  if (NO_DEPT_ROLES.includes(e.target.value)) setNewDeptId('');
                }}
                className="input"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department" required={!NO_DEPT_ROLES.includes(newRole)}>
              {deptSelect(newDeptId, setNewDeptId, newRole)}
            </Field>
          </div>
          <Field label="Full name" required>
            <input type="text" required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="input" />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="ID number" required hint="5 digits">
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={5}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.replace(/\D/g, ''))}
                placeholder="10018"
                className="input font-mono"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@usjr.edu.ph"
                className="input"
              />
            </Field>
          </div>
          <Field label="Temporary password" required hint="At least 6 characters">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
            />
          </Field>
        </form>
      </Modal>

      {/* Change role */}
      <Modal
        open={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        title="Change role"
        description={roleModalUser?.fullName}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setRoleModalUser(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              disabled={!NO_DEPT_ROLES.includes(selectedRole) && !selectedDeptId}
              onClick={() => handleAction(roleModalUser.id, 'ChangeRole', selectedRole, selectedDeptId)}
              className="btn btn-primary"
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                if (NO_DEPT_ROLES.includes(e.target.value)) setSelectedDeptId('');
              }}
              className="input"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department" required={!NO_DEPT_ROLES.includes(selectedRole)}>
            {deptSelect(selectedDeptId, setSelectedDeptId, selectedRole)}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
