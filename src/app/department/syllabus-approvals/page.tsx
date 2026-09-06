'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  FileText,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Filter,
  ShieldCheck,
  FileUp,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function SyllabusApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_APPROVAL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/syllabus-approvals?status=${statusFilter}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load syllabus approval queue.');
        return;
      }
      setApprovals(data.approvals || []);
      if (data.stats) setStats(data.stats);
    } catch (err: any) {
      setError('Connection error. Could not reach approval server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  return (
    <div className="space-y-8">
      {/* USJ-R Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Curriculum Quality Review
            </span>
            <span className="text-xs text-slate-500 font-medium">Department Head Workflow</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Pending Syllabus Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review, evaluate, and officially approve departmental syllabus submissions and revisions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchApprovals}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('PENDING_APPROVAL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING_APPROVAL'
              ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Awaiting Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</p>
          <span className="text-[11px] text-amber-700/80 font-medium">Action required</span>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 shadow-sm ring-2 ring-emerald-400/20'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-[#005A36] mt-1">{stats.approved}</p>
          <span className="text-[11px] text-emerald-700/80 font-medium">Official & Student-visible</span>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-50/70 border-rose-300 shadow-sm ring-2 ring-rose-400/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Returned for Revision</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900 mt-1">{stats.rejected}</p>
          <span className="text-[11px] text-rose-700/80 font-medium">Faculty revising</span>
        </button>

        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-100 border-slate-400 shadow-sm ring-2 ring-slate-400/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Submissions</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          <span className="text-[11px] text-slate-500 font-medium">Historical audit records</span>
        </button>
      </div>

      {/* Error Alert */}
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
                {statusFilter === 'PENDING_APPROVAL'
                  ? 'Pending Syllabus Review Requests'
                  : statusFilter === 'APPROVED'
                  ? 'Approved Official Syllabi'
                  : statusFilter === 'REJECTED'
                  ? 'Returned / Rejected Syllabus Submissions'
                  : 'All Department Syllabus Submissions'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly filtered to your authorized academic department.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Filter:</span>
            <span className="text-xs font-bold text-[#005A36]">
              {statusFilter === 'ALL' ? 'All Records' : statusFilter.replace('_', ' ')}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Retrieving approval queue...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#005A36] flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No submissions in this queue</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {statusFilter === 'PENDING_APPROVAL'
                ? 'All departmental syllabi have been evaluated. New submissions from faculty members will appear here automatically.'
                : 'No records match the selected status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Document / Type</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvals.map((item) => {
                  const course = item.syllabus?.course;
                  const instructor = item.syllabus?.instructor;
                  const submittedDate = item.submittedAt
                    ? new Date(item.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  const isPending = item.approvalStatus === 'PENDING_APPROVAL';
                  const isApproved = item.approvalStatus === 'APPROVED';
                  const isRejected = item.approvalStatus === 'REJECTED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold">
                        <div className="text-[#005A36] text-sm font-mono">{course?.code}</div>
                        <div className="text-[11px] text-slate-500 font-normal truncate max-w-[180px]">
                          {course?.title}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{instructor?.fullName || item.editor?.fullName}</div>
                        <div className="text-[10px] text-slate-400">{instructor?.email}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {item.syllabus?.semester}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-mono">
                        {item.syllabus?.academicYear}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF9C3] border border-[#CA8A04]/30 text-[#854D0E]">
                          Version {item.versionNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {item.fileUrl ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <FileText className="w-3 h-3 text-sky-600" />
                            <span>{item.fileType || 'PDF'} Document</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                            <BookOpen className="w-3 h-3 text-slate-500" />
                            <span>Structured Form</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {submittedDate}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.approvalStatus.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/department/syllabus-approvals/${item.id}`}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            isPending
                              ? 'bg-[#005A36] hover:bg-[#004529] text-white hover:scale-105'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <span>{isPending ? 'Review' : 'View Details'}</span>
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
