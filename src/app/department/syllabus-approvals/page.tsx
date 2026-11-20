'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Filter,
  ShieldCheck,
  Send,
} from 'lucide-react';
import {
  isPendingReview,
  syllabusStatusLabel,
  roleLabel,
  getApprovalRouteLabel,
  formatVersionLabel,
} from '@/lib/status';
import { DEPARTMENTS } from '@/lib/departments';

export default function SyllabusApprovalsPage() {
  const [viewerRole, setViewerRole] = useState<string>('');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ pending: 0, pendingDean: 0, approved: 0, rejected: 0, total: 0 });
  const [department, setDepartment] = useState<{ id: string; code: string; name: string } | null>(null);
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_APPROVAL');
  const [activeQueueTab, setActiveQueueTab] = useState<'review' | 'my-submissions'>('review');
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
        setError(data.error || 'Failed to load syllabus approval queue.');
        return;
      }
      setViewerRole(data.role || '');
      setApprovals(data.approvals || []);
      setMySubmissions(data.mySubmissions || []);
      if (data.stats) setStats(data.stats);
      setDepartment(data.department || null);
    } catch {
      setError('Connection error. Could not reach approval server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter, departmentFilter]);

  const isDean = viewerRole === 'Dean';
  const isDeptHead = viewerRole === 'DepartmentHead';

  const displayedList = activeQueueTab === 'my-submissions' ? mySubmissions : approvals;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              {isDean ? 'Dean Review & Approval Queue' : isDeptHead ? 'Department Head Review Queue' : 'Syllabus Approvals'}
            </span>
            {department?.code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
                Department: [{department.code}] {department.name || department.code}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            {isDean
              ? 'Department Head Submissions Awaiting Dean Approval'
              : isDeptHead
              ? 'Faculty Syllabus Submissions & Revision Approvals'
              : 'Electronic Syllabus Approvals'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isDean
              ? 'Review proposed electronic syllabus revisions submitted by Department Heads across all academic departments directly inside SRVS.'
              : isDeptHead
              ? 'Review, compare side-by-side, and approve or reject Faculty syllabus submissions in your department, or track your own revisions submitted to the Dean.'
              : 'Electronic syllabus approval history and active review queues.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isDean || viewerRole === 'Admin') && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">All Academic Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.code}] {d.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchApprovals}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setActiveQueueTab('review');
            setStatusFilter('PENDING_APPROVAL');
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeQueueTab === 'review' && statusFilter === 'PENDING_APPROVAL'
              ? 'bg-amber-50/80 border-amber-300 shadow-sm ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              {isDean ? 'Pending Dean Review' : 'Pending Dept. Head Review'}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</p>
          <span className="text-[11px] text-amber-700/80 font-medium">
            {isDean ? 'Submitted by Department Heads' : 'Submitted by Faculty'}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveQueueTab('review');
            setStatusFilter('APPROVED');
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeQueueTab === 'review' && statusFilter === 'APPROVED'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-sm ring-2 ring-emerald-400/20'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved Effective</span>
            <CheckCircle2 className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-[#005A36] mt-1">{stats.approved}</p>
          <span className="text-[11px] text-emerald-700/80 font-medium">Approved versions</span>
        </button>

        <button
          onClick={() => {
            setActiveQueueTab('review');
            setStatusFilter('REJECTED');
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeQueueTab === 'review' && statusFilter === 'REJECTED'
              ? 'bg-rose-50/80 border-rose-300 shadow-sm ring-2 ring-rose-400/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Returned for Revision</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900 mt-1">{stats.rejected}</p>
          <span className="text-[11px] text-rose-700/80 font-medium">Preserved in history</span>
        </button>

        {isDeptHead ? (
          <button
            onClick={() => setActiveQueueTab('my-submissions')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              activeQueueTab === 'my-submissions'
                ? 'bg-purple-50/80 border-purple-300 shadow-sm ring-2 ring-purple-400/20'
                : 'bg-white border-slate-200 hover:border-purple-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">My Edits → Dean</span>
              <Send className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-900 mt-1">{mySubmissions.length}</p>
            <span className="text-[11px] text-purple-700/80 font-medium">Track Dean approval status</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setActiveQueueTab('review');
              setStatusFilter('ALL');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              activeQueueTab === 'review' && statusFilter === 'ALL'
                ? 'bg-slate-100 border-slate-400 shadow-sm ring-2 ring-slate-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">All Versions</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
            <span className="text-[11px] text-slate-500 font-medium">Complete audit history</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[#005A36]" />
              <span>
                {activeQueueTab === 'my-submissions'
                  ? 'My Proposed Syllabus Revisions (Submitted to Dean)'
                  : statusFilter === 'PENDING_APPROVAL'
                  ? isDean
                    ? 'Department Head Revisions Awaiting Your Dean Decision'
                    : 'Faculty Submissions Awaiting Your Department Head Decision'
                  : statusFilter === 'APPROVED'
                  ? 'Approved Official Electronic Syllabi'
                  : statusFilter === 'REJECTED'
                  ? 'Returned / Rejected Submissions'
                  : 'All Electronic Syllabus Versions'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeQueueTab === 'my-submissions'
                ? 'Department Head edits require Dean approval and cannot be self-approved.'
                : 'Click Review to open the integrated electronic syllabus viewer and side-by-side version comparison.'}
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold text-[#005A36]">{displayedList.length} records</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Loading electronic review queue...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#005A36] flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No submissions in this queue</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeQueueTab === 'my-submissions'
                ? 'Any syllabus you edit and submit as Department Head will appear here with its live Dean approval status.'
                : 'All pending submissions for your role have been reviewed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Course & Department</th>
                  <th className="py-3 px-4">Proposed By (Editor)</th>
                  <th className="py-3 px-4">Version & Summary</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status & Route</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedList.map((item) => {
                  const course = item.syllabus?.course || item.syllabus?.subject;
                  const editor = item.editor || item.syllabus?.instructor;
                  const submittedDate = item.submittedAt || item.createdAt
                    ? new Date(item.submittedAt || item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';
                  const isPending = isPendingReview(item.approvalStatus);
                  const isApproved = item.approvalStatus === 'APPROVED';
                  const isRejected = item.approvalStatus === 'REJECTED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#005A36] text-sm font-mono font-extrabold">{course?.code}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#005A36] border border-emerald-200 text-[10px] font-mono font-bold">
                            [{item.syllabus?.departmentId}]
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[200px] mt-0.5">{course?.title}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.syllabus?.semester}, AY {item.syllabus?.academicYear}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 capitalize">{editor?.fullName || 'Author'}</div>
                        <div className="text-[10px] text-slate-500">{roleLabel(editor?.role)}</div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF9C3] border border-[#CA8A04]/30 text-[#854D0E]">
                          {formatVersionLabel(item)}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.changeSummary}</p>
                        {item.reviewComments && (
                          <p className="text-[10px] italic text-slate-500 mt-0.5 truncate">
                            Feedback: &ldquo;{item.reviewComments}&rdquo;
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{submittedDate}</td>

                      <td className="py-3.5 px-4 space-y-1">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {syllabusStatusLabel(item.approvalStatus)}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {getApprovalRouteLabel(item.approvalStatus, item.editor?.role)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/department/syllabus-approvals/${item.id}`}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            item.canReview
                              ? 'bg-[#005A36] hover:bg-[#004529] text-white'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <span>{item.canReview ? 'Review & Decide' : 'Inspect Version'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
