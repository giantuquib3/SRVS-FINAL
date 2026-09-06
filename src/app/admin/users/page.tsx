'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  ArrowLeft,
  RefreshCw,
  Search,
  UserPlus,
  Trash2,
  Edit3,
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    total: number;
    deptHeads: number;
    educators: number;
    students: number;
    admins: number;
  }>({ total: 0, deptHeads: 0, educators: 0, students: 0, admins: 0 });

  // Create User Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Educator');
  const [newDeptId, setNewDeptId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Role Edit Modal State
  const [roleModalUser, setRoleModalUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('');

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const cleanUsername = newUsername.trim();
    if (!cleanUsername) {
      setCreateError('Username (ID Number) is required.');
      return;
    }

    if (newRole === 'Student') {
      if (!/^\d{10}$/.test(cleanUsername)) {
        setCreateError('Student Username / ID number must be exactly 10 digits (e.g. 2022012708).');
        return;
      }
    } else {
      if (!/^\d{5}$/.test(cleanUsername)) {
        setCreateError('Admin, Faculty, and Department Head Username / ID numbers must be exactly 5 digits (e.g. 00000 or 10001).');
        return;
      }
    }

    setCreateLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: cleanUsername,
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
          departmentId: newDeptId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user.');
        setCreateLoading(false);
        return;
      }

      setCreateModalOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewDeptId('');
      setActionMessage(`User account for ${data.user?.fullName || 'user'} (ID: ${data.user?.id || cleanUsername}) created successfully.`);
      setTimeout(() => setActionMessage(''), 4000);
      await fetchUsers();
    } catch (err) {
      setCreateError('Connection error.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string, newRoleValue?: string) => {
    setProcessingId(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, newRole: newRoleValue }),
      });
      if (res.ok) {
        if (action === 'ChangeRole') {
          setRoleModalUser(null);
        }
        await fetchUsers();
      }
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete or deactivate account for ${userName}?`)) {
      return;
    }

    setProcessingId(userId);
    try {
      const res = await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || 'User removed successfully.');
        setTimeout(() => setActionMessage(''), 4000);
        await fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/dashboard"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                Identity & Access
              </span>
              <span className="text-xs text-slate-500 font-medium">User Accounts Directory</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
              User Accounts & Role Management
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsers}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#FEF08A]" />
            <span>Create User Account</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Role Segregation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: '', label: 'All Users', count: counts.total },
          { id: 'DepartmentHead', label: 'Department Heads', count: counts.deptHeads },
          { id: 'Educator', label: 'Faculty / Educators', count: counts.educators },
          { id: 'Student', label: 'Students', count: counts.students },
          { id: 'Admin', label: 'Administrators', count: counts.admins },
        ].map((tab) => {
          const active = roleFilter === tab.id;
          return (
            <button
              key={tab.id || 'all'}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                active
                  ? 'bg-[#005A36] text-white shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  active ? 'bg-[#FEF08A] text-[#854D0E]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, or username..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-20 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-[#005A36] hover:bg-[#004529] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">All Statuses</option>
              <option value="PendingApproval">Pending Approval</option>
              <option value="Active">Active</option>
              <option value="Deactivated">Deactivated</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-bold">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="DepartmentHead">Department Head</option>
              <option value="Educator">Educator</option>
              <option value="Student">Student</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-600">
            Showing {users.length} registered accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <th className="py-2.5 px-3">Full Name & Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Department</th>
                {roleFilter === 'Student' && (
                  <th className="py-2.5 px-3">Enrolled Subjects (Codes)</th>
                )}
                <th className="py-2.5 px-3">Account Status</th>
                <th className="py-2.5 px-3">Registered Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{u.fullName}</p>
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                      <span className="font-bold text-[#005A36] bg-emerald-50 px-1 rounded border border-emerald-200">ID: {u.id || '—'}</span>
                      <span>•</span>
                      <span>{u.email}</span>
                    </div>
                    {roleFilter !== 'Student' && u.role === 'Student' && u.enrolledSubjects && (
                      <div className="mt-1 flex items-center space-x-1 text-[10px]">
                        <span className="text-slate-500 font-semibold">Enrolled:</span>
                        <span className="font-mono font-bold text-[#005A36] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {u.enrolledSubjects}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => {
                        setRoleModalUser(u);
                        setSelectedRole(u.role);
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-[#FEF08A] text-slate-800 hover:text-[#854D0E] transition-colors cursor-pointer"
                      title="Click to change role"
                    >
                      <span>{u.role}</span>
                      <Edit3 className="w-2.5 h-2.5 ml-1 text-slate-400" />
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">
                    <span className="font-bold text-slate-900">
                      {u.studentProfile?.department || u.deptHeadProfile?.department || u.facultyProfile?.department || u.department?.code || 'Unassigned'}
                    </span>
                    {u.department && (
                      <span className="text-slate-500 text-[11px] block">
                        {u.department.name}
                      </span>
                    )}
                  </td>
                  {roleFilter === 'Student' && (
                    <td className="py-3 px-3">
                      {u.enrolledSubjects ? (
                        <div className="flex flex-wrap gap-1">
                          {u.enrolledSubjects.split(',').map((code: string) => (
                            <span
                              key={code.trim()}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-[#005A36] border border-emerald-200 shadow-2xs"
                            >
                              {code.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No enrolled subjects</span>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.accountStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : u.accountStatus === 'PendingApproval'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {u.accountStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5">
                    {u.accountStatus === 'PendingApproval' ? (
                      <>
                        <button
                          onClick={() => handleAction(u.id, 'Approve')}
                          disabled={processingId === u.id}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors cursor-pointer shadow-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(u.id, 'Reject')}
                          disabled={processingId === u.id}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-sm"
                        >
                          Reject
                        </button>
                      </>
                    ) : u.accountStatus === 'Active' ? (
                      <button
                        onClick={() => handleAction(u.id, 'Deactivate')}
                        disabled={processingId === u.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 transition-colors cursor-pointer"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(u.id, 'Activate')}
                        disabled={processingId === u.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#005A36] border border-slate-300 transition-colors cursor-pointer"
                      >
                        Activate
                      </button>
                    )}

                    {currentUser?.id !== u.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.fullName)}
                        disabled={processingId === u.id}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#005A36] flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#005A36]" />
                <span>Create User Account</span>
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">System Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      setNewRole(e.target.value);
                      setNewUsername('');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36]"
                  >
                    <option value="Admin">System Administrator (5-digit ID)</option>
                    <option value="DepartmentHead">Department Head (5-digit ID)</option>
                    <option value="Educator">Educator (5-digit ID)</option>
                    <option value="Student">Student (10-digit ID)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36]"
                  >
                    <option value="">-- None / Unassigned --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        [{dept.code}] {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    {newRole === 'Student' ? 'Username (Student ID - 10 digits) *' : 'Username (Staff/Admin ID - 5 digits) *'}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {newRole === 'Student' ? '10 digits' : '5 digits'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={newRole === 'Student' ? 10 : 5}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/\D/g, ''))}
                  placeholder={newRole === 'Student' ? 'e.g. 2022012708' : 'e.g. 00000 or 10001'}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@usjr.edu.ph"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Temporary password (min 6 chars)"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] disabled:bg-emerald-800 text-white transition-all shadow-sm flex items-center space-x-1.5"
                >
                  {createLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE EDIT MODAL */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#005A36] flex items-center space-x-2">
                <Shield className="w-4 h-4 text-[#CA8A04]" />
                <span>Change User Role</span>
              </h3>
              <button
                onClick={() => setRoleModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Updating role for <strong className="text-slate-900">{roleModalUser.fullName}</strong>:
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select New Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36]"
                >
                  <option value="Admin">Admin (Full Access)</option>
                  <option value="DepartmentHead">Department Head (Curriculum Review)</option>
                  <option value="Educator">Educator (Syllabus Creator)</option>
                  <option value="Student">Student (Read-Only)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(roleModalUser.id, 'ChangeRole', selectedRole)}
                  className="px-4 py-1.5 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm"
                >
                  Save Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
