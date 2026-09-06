'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  FileText,
  Download,
  AlertTriangle,
  History,
  GitBranch,
  ShieldCheck,
  User,
  Calendar,
  Layers,
  GraduationCap,
  MessageSquare,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';

export default function SyllabusReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'comparison' | 'history'>('content');

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Approve Modal
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
    } catch (err: any) {
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
      setActionSuccess(resJson.message || 'Syllabus approved successfully! Enrolled students can now access this official version.');
      await fetchApprovalDetails();
    } catch (err: any) {
      setActionError('Error communicating with approval server.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setActionError('A rejection reason is strictly required.');
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
      setActionSuccess(resJson.message || 'Syllabus returned to faculty with feedback for revision.');
      await fetchApprovalDetails();
    } catch (err: any) {
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
          <p className="text-xs text-slate-500 font-semibold">Loading syllabus for review...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.version) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Review Request Not Found'}</h2>
        <p className="text-xs text-slate-500">
          You may not have authorization to view this syllabus, or it has been removed.
        </p>
        <Link
          href="/department/syllabus-approvals"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Approval Queue</span>
        </Link>
      </div>
    );
  }

  const { version, syllabus, previousApprovedVersion, isSelfSubmission } = data;
  const course = syllabus.course;
  const instructor = syllabus.instructor;
  const content = version.content || {};
  const prevContent = previousApprovedVersion?.content || {};

  const isPending = version.approvalStatus === 'PENDING_APPROVAL';
  const isApproved = version.approvalStatus === 'APPROVED';
  const isRejected = version.approvalStatus === 'REJECTED';

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/department/syllabus-approvals"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-extrabold text-[#005A36]">{course.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-medium">{syllabus.semester}, AY {syllabus.academicYear}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">Dept: [{syllabus.department.code}] {syllabus.department.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
          </div>
        </div>

        {/* Action Decision Buttons */}
        <div className="flex items-center space-x-2">
          {isPending && !isSelfSubmission && (
            <>
              <button
                onClick={() => setRejectModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Reject Syllabus</span>
              </button>
              <button
                onClick={() => setApproveModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FEF08A]" />
                <span>Approve Syllabus</span>
              </button>
            </>
          )}

          {isApproved && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#005A36]" />
              <span>Official Active Version</span>
            </span>
          )}

          {isRejected && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Returned for Revision</span>
            </span>
          )}
        </div>
      </div>

      {/* Success / Error Alerts */}
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

      {/* Self-Approval Prohibition Warning Banner */}
      {isSelfSubmission && isPending && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold">Self-Approval Strictly Prohibited</h4>
            <p className="text-amber-800 leading-relaxed">
              You are the instructor or submitter of this syllabus. Under USJ-R SRVS institutional policy, a Department Head cannot approve their own syllabus. This review request must be evaluated and approved by another Department Head or an authorized Administrator.
            </p>
          </div>
        </div>
      )}

      {/* Overview Metadata Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 font-semibold block">Faculty / Instructor</span>
          <span className="font-bold text-slate-800 text-sm mt-0.5 block">{instructor.fullName}</span>
          <span className="text-[11px] text-slate-500 font-mono">{instructor.email}</span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block">Reviewing Version</span>
          <span className="font-bold text-slate-800 text-sm mt-0.5 block flex items-center space-x-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30">
              Version {version.versionNumber}
            </span>
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {version.versionNumber > 1 ? 'Curriculum Revision' : 'Initial Creation'}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block">Submission Date</span>
          <span className="font-mono text-slate-800 font-bold text-sm mt-0.5 block">
            {version.submittedAt ? new Date(version.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
          <span className="text-[11px] text-slate-500">
            {version.submittedAt ? new Date(version.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block">Evaluation Status</span>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${
              isApproved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isPending
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {version.approvalStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Change Summary Card (Critical for Revisions) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
          <MessageSquare className="w-4 h-4 text-[#005A36]" />
          <span>Faculty Submitted Change Summary</span>
        </div>
        <p className="text-sm text-slate-800 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200/80 leading-relaxed">
          &ldquo;{version.changeSummary}&rdquo;
        </p>
      </div>

      {/* If Rejected: Show Rejection Feedback Banner */}
      {version.rejectionReason && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl space-y-2 text-rose-900">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-rose-700">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Rejection Remarks Provided to Faculty</span>
          </div>
          <p className="text-sm font-medium bg-white/80 p-4 rounded-xl border border-rose-200 text-rose-800 leading-relaxed">
            &ldquo;{version.rejectionReason}&rdquo;
          </p>
          {version.reviewedBy && (
            <p className="text-[11px] text-rose-600 font-medium">
              Evaluated by: {version.reviewedBy.fullName} on {version.reviewedAt ? new Date(version.reviewedAt).toLocaleDateString() : '—'}
            </p>
          )}
        </div>
      )}

      {/* Tabs: Submitted Content vs Version Comparison vs Decision History */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'content'
                ? 'bg-[#005A36] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Submitted Content & Document
          </button>

          {previousApprovedVersion && (
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'comparison'
                  ? 'bg-[#005A36] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Version Comparison (v{previousApprovedVersion.versionNumber} vs v{version.versionNumber})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'bg-[#005A36] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Approval Logs & History ({version.approvalLogs?.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: Content View */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Uploaded Document Banner (if uploaded via file) */}
            {version.fileUrl && (
              <div className="p-5 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-white border border-sky-200 text-sky-700 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-sky-950">
                      Uploaded Syllabus Document ({version.fileType || 'PDF'})
                    </h4>
                    <p className="text-xs text-sky-700">
                      File: <span className="font-mono font-bold">{version.fileName}</span> • Size: {version.fileSize ? `${(version.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Standard'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={version.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>
                  <a
                    href={version.fileUrl}
                    download={version.fileName || 'syllabus.pdf'}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 shadow-sm flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>
              </div>
            )}

            {/* Structured Content Container */}
            <div className="bg-white p-8 sm:p-12 rounded-3xl space-y-8 border border-slate-200 shadow-sm text-slate-800">
              {/* Header */}
              <div className="text-center space-y-2 border-b border-slate-200 pb-6">
                <p className="text-xs uppercase tracking-widest text-[#005A36] font-extrabold">
                  {syllabus.department.name}
                </p>
                <h2 className="text-2xl font-black text-slate-900">
                  {course.code}: {course.title}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 pt-1 font-medium">
                  <span>Term: {syllabus.semester}</span>
                  <span>•</span>
                  <span>Academic Year: {syllabus.academicYear}</span>
                  <span>•</span>
                  <span>Instructor: {instructor.fullName}</span>
                </div>
              </div>

              {/* Course Description */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
                  I. Course Description
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {content.courseDescription || course.description || 'No course description provided.'}
                </p>
              </section>

              {/* Learning Outcomes */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
                  II. Course Learning Outcomes (CLOs)
                </h3>
                {!content.learningOutcomes || content.learningOutcomes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No structured learning outcomes specified.</p>
                ) : (
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 pl-1">
                    {content.learningOutcomes.map((outcome: string, idx: number) => (
                      <li key={idx} className="leading-relaxed font-medium">
                        <span className="ml-1">{outcome}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Weekly Topics Outline */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
                  III. Weekly Course Outline & Topics
                </h3>
                {!content.topics || content.topics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No topics outline specified.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 w-24">Week</th>
                          <th className="py-2.5 px-4">Lecture / Laboratory Topic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {content.topics.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-4 font-mono font-bold text-[#005A36]">
                              Week {t.week}
                            </td>
                            <td className="py-2.5 px-4 text-slate-800 font-medium">{t.topic}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Assessment & Grading System */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
                  IV. Assessment & Grading Criteria
                </h3>
                {!content.gradingSystem || content.gradingSystem.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No grading criteria specified.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {content.gradingSystem.map((g: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-800 font-semibold">{g.component}</span>
                        <span className="font-extrabold text-[#005A36]">{g.weight}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* References */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
                  V. Required References & Textbooks
                </h3>
                {!content.references || content.references.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No references specified.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 pl-1">
                    {content.references.map((r: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">
                        <span className="ml-1">{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: Revision Comparison / Diff */}
        {activeTab === 'comparison' && previousApprovedVersion && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <h4 className="font-bold flex items-center space-x-1.5 text-amber-800">
                <GitBranch className="w-4 h-4" />
                <span>Revision Comparison: Prior Approved vs Submitted</span>
              </h4>
              <p className="text-amber-800 leading-relaxed">
                Evaluating changes between previously approved <strong>Version {previousApprovedVersion.versionNumber}</strong> and newly submitted <strong>Version {version.versionNumber}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Previous Approved Version */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Official Baseline</span>
                    <h4 className="text-base font-bold text-slate-800">Version {previousApprovedVersion.versionNumber} (Approved)</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Currently Student-Visible
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Course Description:</span>
                    <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 leading-relaxed">
                      {prevContent.courseDescription || '—'}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Learning Outcomes ({prevContent.learningOutcomes?.length || 0}):</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                      {(prevContent.learningOutcomes || []).map((o: string, idx: number) => (
                        <li key={idx} className="leading-tight">{o}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Topics Outline ({prevContent.topics?.length || 0} weeks):</span>
                    <div className="space-y-1">
                      {(prevContent.topics || []).slice(0, 5).map((t: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-slate-600 flex space-x-2">
                          <span className="font-bold text-slate-500">W{t.week}:</span>
                          <span>{t.topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Submitted Revision */}
              <div className="bg-white p-6 rounded-2xl border-2 border-[#005A36] shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#005A36]">Submitted Revision</span>
                    <h4 className="text-base font-bold text-slate-900">Version {version.versionNumber} (Pending Evaluation)</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Awaiting Review
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Course Description:</span>
                    <p className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-slate-800 leading-relaxed font-medium">
                      {content.courseDescription || '—'}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Learning Outcomes ({content.learningOutcomes?.length || 0}):</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-800 pl-1 font-medium">
                      {(content.learningOutcomes || []).map((o: string, idx: number) => (
                        <li key={idx} className="leading-tight">{o}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Topics Outline ({content.topics?.length || 0} weeks):</span>
                    <div className="space-y-1">
                      {(content.topics || []).slice(0, 5).map((t: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-slate-800 flex space-x-2 font-medium">
                          <span className="font-bold text-[#005A36]">W{t.week}:</span>
                          <span>{t.topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Decision History / Audit Logs */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-[#005A36]" />
              <span>Syllabus Version Approval & Decision Trail</span>
            </h3>

            {!version.approvalLogs || version.approvalLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No formal review decision records logged yet for this version.</p>
            ) : (
              <div className="space-y-3">
                {version.approvalLogs.map((log: any) => (
                  <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.decision === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.decision}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {log.reviewer.fullName} ({log.reviewer.role})
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs italic">&ldquo;{log.comments}&rdquo;</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <XCircle className="w-5 h-5" />
                <h3 className="text-base font-bold">Return Syllabus for Revision</h3>
              </div>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please specify clear, actionable rejection feedback. The faculty member ({instructor.fullName}) will be required to address these comments and resubmit a corrected version.
            </p>

            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rejection Reason / Comments <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Please review the grading system percentages. The total must equal 100%. Update Week 8 topic references."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <span>Confirm Rejection</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-[#005A36]">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-base font-bold">Approve Official Syllabus</h3>
              </div>
              <button
                onClick={() => setApproveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              By approving, <strong>Version {version.versionNumber}</strong> will become the official active syllabus for <strong>{course.code}</strong>. Authorized students actively enrolled in this course will immediately gain viewing access.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Approval Remarks
                </label>
                <input
                  type="text"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="e.g. Approved and compliant with CHED curriculum standards"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] disabled:bg-emerald-800 text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <span>Confirm & Publish Official Syllabus</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
