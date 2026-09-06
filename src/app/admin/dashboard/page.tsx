'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  Shield,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Eye,
  BookOpen
} from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingSyllabi, setPendingSyllabi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, syllabiRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/users?status=PendingApproval'),
        fetch('/api/syllabi?status=Submitted'),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const syllabiData = await syllabiRes.json();

      setData(statsData);
      setPendingUsers(usersData.users || []);
      setPendingSyllabi(syllabiData.syllabi || []);
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
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Action error:', err);
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
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading system statistics...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentActivities = data?.recentActivities || [];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              System Administration
            </span>
            <span className="text-xs text-slate-500 font-medium">USJ-R Central Control</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            System Administrator Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <Link
            href="/courses"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all"
          >
            Manage Courses
          </Link>
        </div>
      </div>

      {/* Dynamic Database Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Users</span>
            <Users className="w-5 h-5 text-[#005A36]" />
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.totalUsers ?? 0}</p>
          <span className="text-[11px] text-slate-500">Across 4 institutional roles</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Registrations</span>
            <Clock className="w-5 h-5 text-[#CA8A04]" />
          </div>
          <p className="text-3xl font-black text-amber-700">{stats.pendingRegistrations ?? 0}</p>
          <span className="text-[11px] text-amber-600 font-medium">Require approval</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Syllabi</span>
            <BookOpen className="w-5 h-5 text-[#005A36]" />
          </div>
          <p className="text-3xl font-black text-[#005A36]">{stats.totalSyllabi ?? 0}</p>
          <span className="text-[11px] text-slate-500">{stats.pendingSyllabi ?? 0} awaiting review</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#854D0E] uppercase tracking-wider">Immutable Versions</span>
            <History className="w-5 h-5 text-[#CA8A04]" />
          </div>
          <p className="text-3xl font-black text-[#854D0E]">{stats.totalVersions ?? 0}</p>
          <span className="text-[11px] text-slate-500">Permanent revision snapshots</span>
        </div>
      </div>

      {/* Two Column Layout: User Approval Queue & Pending Syllabus Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Approval Queue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#005A36]" />
                <span>User Approval Queue</span>
              </h2>
              <p className="text-xs text-slate-500">Pending faculty and student registrations</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              {pendingUsers.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {pendingUsers.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No registrations currently pending approval.</p>
            ) : (
              pendingUsers.map((u) => (
                <div key={u.id} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{u.fullName}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                        {u.role}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {u.department?.name || 'Department'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUserAction(u.id, 'Approve')}
                      disabled={processingId === u.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors cursor-pointer flex items-center space-x-1 shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[#FEF08A]" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleUserAction(u.id, 'Reject')}
                      disabled={processingId === u.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center space-x-1 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Syllabus Reviews */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#005A36]" />
                <span>Pending Syllabus Reviews</span>
              </h2>
              <p className="text-xs text-slate-500">Submitted syllabi awaiting approval decision</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
              {pendingSyllabi.length} Submitted
            </span>
          </div>

          <div className="space-y-3">
            {pendingSyllabi.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No syllabi awaiting administrative review.</p>
            ) : (
              pendingSyllabi.map((s) => (
                <div key={s.id} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-[#005A36]">{s.course.code}</span>
                      <span className="text-xs text-slate-500">{s.semester}, AY {s.academicYear}</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium mt-0.5">{s.course.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Submitted by: <span className="font-semibold text-slate-700">{s.instructor?.fullName}</span> | Version {s.currentVersionNumber}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/syllabi/${s.id}`}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                      title="View Syllabus"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleSyllabusReview(s.id, 'Approve')}
                      disabled={processingId === s.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors cursor-pointer shadow-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleSyllabusReview(s.id, 'Reject')}
                      disabled={processingId === s.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent System Audit Logs Feed */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#005A36]" />
              <span>Recent System Activities (Audit Trail)</span>
            </h2>
            <p className="text-xs text-slate-500">Live transaction stream logged in PostgreSQL</p>
          </div>
          <Link
            href="/admin/audit-logs"
            className="text-xs text-[#005A36] hover:underline font-bold flex items-center space-x-1"
          >
            <span>Full Audit Trail</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivities.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{log.actionType}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{log.userDisplayName || 'System'}</td>
                  <td className="py-2.5 px-3 text-slate-600 max-w-md truncate">{log.description}</td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.resultStatus === 'Success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                      {log.resultStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
