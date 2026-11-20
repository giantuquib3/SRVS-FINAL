'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  History,
  GitCompare,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  X,
  Eye,
  BookOpen,
  FileEdit,
} from 'lucide-react';
import ElectronicSyllabusViewer from '@/components/ElectronicSyllabusViewer';
import SyllabusVersionCompare from '@/components/SyllabusVersionCompare';
import {
  isPendingReview,
  syllabusStatusLabel,
  getApprovalRouteLabel,
  roleLabel,
  formatVersionLabel,
  formatShortVersionLabel,
} from '@/lib/status';
import { extractReviewComments } from '@/lib/syllabus-template';

export default function SyllabusReviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'viewer' | 'comparison' | 'history'>('viewer');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');

  const fetchApprovalDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/syllabus-approvals/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to retrieve syllabus review details.');
        return;
      }
      setData(json);
    } catch {
      setError('Connection error. Could not connect to approval system.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchApprovalDetails();
  }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/syllabus-approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: approvalRemarks }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        setActionError(resJson.error || 'Failed to approve syllabus.');
        setActionLoading(false);
        return;
      }
      setApproveModalOpen(false);
      setActionSuccess(
        resJson.message || 'Proposed version approved and promoted as the current effective syllabus!'
      );
      await fetchApprovalDetails();
    } catch {
      setActionError('Error communicating with approval server.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setActionError('A rejection reason or review feedback is strictly required.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/syllabus-approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        setActionError(resJson.error || 'Failed to reject syllabus.');
        setActionLoading(false);
        return;
      }
      setRejectModalOpen(false);
      setActionSuccess(
        resJson.message || 'Proposed version returned with review feedback. Previous versions remain intact.'
      );
      await fetchApprovalDetails();
    } catch {
      setActionError('Error communicating with approval server.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">Loading electronic syllabus review...</p>
        </div>
      </div>
    );
  }

  const version = data?.version || data?.approval;
  const syllabus = data?.syllabus || version?.syllabus;

  if (error || !version || !syllabus) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Review Request Not Found'}</h2>
        <Link
          href="/department/syllabus-approvals"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Approval Queue</span>
        </Link>
      </div>
    );
  }

  const {
    previousApprovedVersion,
    allVersions = [],
    isSelfSubmission,
    isDeptHeadSubmission,
    canReview,
    viewerRole,
  } = data;

  const course = syllabus.course || syllabus.subject || {};
  const editor = version.editor || syllabus.instructor || {};
  const isPending = isPendingReview(version.approvalStatus);
  const isApproved = version.approvalStatus === 'APPROVED';
  const isRejected = version.approvalStatus === 'REJECTED';
  const reviewComments = extractReviewComments(version);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation & Decision Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/department/syllabus-approvals"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-extrabold text-[#005A36]">{course.code}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-medium">
                {syllabus.semester}, AY {syllabus.academicYear}
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#005A36] border border-emerald-200 font-mono font-bold text-[10px]">
                [{syllabus.department?.code || syllabus.departmentId}] {syllabus.department?.name}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {course.title} — {formatVersionLabel(version)}
            </h1>
          </div>
        </div>

        {/* Decision Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {canReview && isPending && (
            <>
              <button
                onClick={() => setRejectModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Reject with Feedback</span>
              </button>
              <button
                onClick={() => setApproveModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FEF08A]" />
                <span>Approve & Make Effective</span>
              </button>
            </>
          )}

          {isApproved && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#005A36]" />
              <span>Approved Effective Version</span>
            </span>
          )}

          {isRejected && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Returned for Revision</span>
              </span>
              {isSelfSubmission && (
                <Link
                  href={`/syllabi/${syllabus.id}/edit?fromVersion=${version.versionNumber}`}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Revise & Resubmit</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#005A36]" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Strict Governance Notice when Self-Submission or Different Approver Required */}
      {isPending && !canReview && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-900">
              {isSelfSubmission
                ? 'Self-Approval Prohibited by Governance Policy'
                : isDeptHeadSubmission
                  ? 'Dean Authorization Required'
                  : 'Department Head Authorization Required'}
            </p>
            <p className="text-amber-800 leading-relaxed">
              {isSelfSubmission
                ? 'You proposed this revision. Neither Faculty nor Department Heads may approve their own proposed syllabus changes. This submission is awaiting review by the authorized higher reviewer.'
                : isDeptHeadSubmission
                  ? 'This revision was proposed by a Department Head. Only the authorized Dean role can approve or reject Department Head changes.'
                  : 'This revision was proposed by Faculty and must be reviewed by the corresponding Department Head.'}
            </p>
          </div>
        </div>
      )}

      {/* Metadata Overview Strip */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 font-bold uppercase text-[10px] block">Edited / Proposed By</span>
          <span className="font-bold text-slate-900 text-sm capitalize block mt-0.5">
            {editor.fullName || 'Author'}
          </span>
          <span className="text-[11px] text-slate-500">
            {roleLabel(editor.role)} • ID: <span className="font-mono">{version.editorId}</span>
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-bold uppercase text-[10px] block">Version & Route</span>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30 mt-1">
            {formatVersionLabel(version)}
          </span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            {getApprovalRouteLabel(version.approvalStatus, version.editor?.role)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-bold uppercase text-[10px] block">Submitted Date & Time</span>
          <span className="font-mono font-bold text-slate-800 text-xs block mt-1">
            {version.submittedAt
              ? new Date(version.submittedAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              : new Date(version.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-bold uppercase text-[10px] block">Approval Status</span>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${isApproved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isPending
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
          >
            {syllabusStatusLabel(version.approvalStatus)}
          </span>
        </div>
      </div>

      {/* Change Summary & Any Review Comments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-[#005A36]" />
            <span>Editor&apos;s Change Summary</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-800 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            &ldquo;{version.changeSummary}&rdquo;
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#005A36]" />
            <span>Review Decision & Comments</span>
          </div>
          {reviewComments ? (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium ${isRejected
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
            >
              <p>&ldquo;{reviewComments}&rdquo;</p>
              {version.reviewedBy && (
                <p className="text-[11px] opacity-80 mt-1">
                  — {version.reviewedBy.fullName} ({roleLabel(version.reviewedBy.role)}){' '}
                  {version.reviewedAt ? `on ${new Date(version.reviewedAt).toLocaleDateString()}` : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              Awaiting review decision from authorized {isDeptHeadSubmission ? 'Dean' : 'Department Head'}.
            </p>
          )}
        </div>
      </div>

      {/* Review Workspace Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('viewer')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'viewer'
              ? 'bg-[#005A36] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Integrated Electronic Syllabus ({formatShortVersionLabel(version)})</span>
        </button>

        {previousApprovedVersion && (
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'comparison'
                ? 'bg-[#005A36] text-white shadow-sm'
                : 'bg-amber-50 border border-amber-200 text-[#854D0E] hover:bg-amber-100'
              }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>
              Side-by-Side Comparison ({formatShortVersionLabel(previousApprovedVersion)} → {formatShortVersionLabel(version)})
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'history'
              ? 'bg-[#005A36] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>All Versions ({allVersions.length})</span>
        </button>
      </div>

      {/* TAB 1: Integrated Electronic Syllabus Viewer (Zero Download Needed!) */}
      {activeTab === 'viewer' && (
        <ElectronicSyllabusViewer
          syllabus={syllabus}
          version={version}
          versionsHistory={allVersions}
        />
      )}

      {/* TAB 2: Side-by-Side Proposed Changes Comparison */}
      {activeTab === 'comparison' && previousApprovedVersion && (
        <SyllabusVersionCompare
          versionA={previousApprovedVersion}
          versionB={version}
          subject={course}
          departmentName={syllabus.department?.name || syllabus.departmentId}
          labelA={`Previous Version (v${previousApprovedVersion.versionNumber})`}
          labelB={`Proposed Version Under Review (v${version.versionNumber})`}
        />
      )}

      {/* TAB 3: Complete Version History */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              All Recorded Versions for [{course.code}]
            </h3>
            <Link
              href={`/syllabi/${syllabus.id}/versions`}
              className="text-xs font-bold text-[#005A36] hover:underline"
            >
              Open Full Compare Tool →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {allVersions.map((v: any) => (
              <div key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-[#005A36]">v{v.versionNumber}</span>
                    <span className="font-bold text-slate-800">{syllabusStatusLabel(v.approvalStatus)}</span>
                    {v.approvalStatus === 'APPROVED' && v.versionNumber === syllabus.currentVersionNumber && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Effective Active
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">{v.changeSummary}</p>
                  <p className="text-[11px] text-slate-400">
                    Edited by <strong className="capitalize text-slate-600">{v.editor?.fullName}</strong> ({roleLabel(v.editor?.role)}) •{' '}
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/syllabi/${syllabus.id}?version=${v.versionNumber}`}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5 text-[#005A36]" />
                  <span>Open in Viewer</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#005A36] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>Approve {formatVersionLabel(version)}</span>
              </h3>
              <button onClick={() => setApproveModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Approving these proposed changes as <strong>{roleLabel(viewerRole)}</strong> will automatically generate the next official version (e.g. <strong>Version {(syllabus.currentVersionNumber || 1) + 1}</strong>) as the effective syllabus for <strong>[{course.code}] {course.title}</strong>, while retaining all previous versions in revision history.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Review Comments (Optional)</label>
              <textarea
                rows={3}
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Add any review comments or endorsement notes..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleApprove}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer"
              >
                {actionLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (Mandatory Feedback) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReject}
            className="bg-white max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-rose-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                <span>Reject & Request Revision (v{version.versionNumber})</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Version {version.versionNumber} will be marked <strong>Rejected</strong> and preserved in version history. The currently approved effective syllabus (if any) will remain unchanged while the author revises and resubmits.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rejection Reason / Review Feedback *
              </label>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain clearly what needs to be revised before resubmission..."
                className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {actionLoading ? 'Submitting Feedback...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
