'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  FileEdit,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  GitCompare,
  ShieldCheck,
  Clock,
  XCircle,
  KeyRound,
} from 'lucide-react';
import ElectronicSyllabusViewer from '@/components/ElectronicSyllabusViewer';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';
import {
  isPendingReview,
  syllabusStatusLabel,
  getApprovalRouteLabel,
  roleLabel,
  formatVersionLabel,
  formatShortVersionLabel,
} from '@/lib/status';
import { extractReviewComments } from '@/lib/syllabus-template';

function SyllabusViewerInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const versionParam = searchParams.get('version');

  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const fetchSyllabus = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const q = versionParam ? `?version=${encodeURIComponent(versionParam)}` : '';
      const [syllabusData, userData] = await Promise.all([
        fetch(`/api/syllabi/${id}${q}`).then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (syllabusData.error) setError(syllabusData.error);
      else setData(syllabusData);
      if (userData?.user) setCurrentUser(userData.user);
    } catch {
      setError('Failed to load electronic syllabus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabus();
  }, [id, versionParam]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading electronic syllabus viewer...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.syllabus) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Syllabus Not Found'}</h2>
        <p className="text-xs text-slate-500">
          The requested electronic syllabus does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const { syllabus, currentVersion, effectiveVersion, pendingVersion, versions = [], canEdit, editPermission } = data;
  const isReadOnlyGlobal = currentUser?.role === 'Registrar' || currentUser?.role === 'VPAcademics';
  const isStudent = currentUser?.role === 'Student';
  const isDeptHead = currentUser?.role === 'DepartmentHead';
  const isDean = currentUser?.role === 'Dean';
  const isFaculty = currentUser?.role === 'Educator' || currentUser?.role === 'Faculty';
  const canViewHistory = currentUser && !isStudent && !isReadOnlyGlobal;
  const permStatus = editPermission?.status || 'NONE';
  const permRequest = editPermission?.request || null;

  const displayedStatus = currentVersion?.approvalStatus || syllabus.status;
  const isViewingEffective =
    effectiveVersion && currentVersion && effectiveVersion.versionNumber === currentVersion.versionNumber;
  const isDraftOrRejected = displayedStatus === 'DRAFT' || displayedStatus === 'REJECTED';
  const reviewComments = extractReviewComments(currentVersion);

  // Can this user jump directly to the Approval Review screen for the currently displayed pending version?
  const currentUserIdInt = parseInt(currentUser?.id || '0', 10) || 0;
  const isSelfEdited =
    currentVersion &&
    (currentVersion.editorId === currentUserIdInt || currentVersion.submittedById === currentUserIdInt);
  const canOpenReview =
    !isSelfEdited &&
    currentVersion &&
    ((isDean && currentVersion.approvalStatus === 'UNDER_REVIEW') ||
      (isDeptHead && currentVersion.approvalStatus === 'SUBMITTED'));

  const handleSubmitForApproval = async () => {
    if (!currentVersion) return;
    setSubmittingVersion(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`/api/syllabi/${syllabus.id}/versions/${currentVersion.versionNumber}/submit`, {
        method: 'POST',
      });
      const resJson = await res.json();
      if (!res.ok) {
        setError(resJson.error || 'Failed to submit version.');
        return;
      }
      setSuccessMessage(resJson.message || 'Syllabus version submitted for review.');
      await fetchSyllabus();
    } catch {
      setError('Connection error while submitting version.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 py-2">
      {/* Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors cursor-pointer shadow-sm"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-[#005A36] font-mono">{syllabus.course.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-medium">
                {syllabus.semester}, AY {syllabus.academicYear}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30">
                Viewing {formatVersionLabel(currentVersion)}
              </span>
              {!isReadOnlyGlobal && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    displayedStatus === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : isPendingReview(displayedStatus)
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : displayedStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {syllabusStatusLabel(displayedStatus)}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
              {syllabus.course.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Version Switcher for Authorized Users */}
          {canViewHistory && versions.length > 1 && (
            <select
              value={currentVersion?.versionNumber || ''}
              onChange={(e) => router.push(`/syllabi/${syllabus.id}?version=${e.target.value}`)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005A36]"
              title="Switch Electronic Version"
            >
              {versions.map((v: any) => (
                <option key={v.id} value={v.versionNumber}>
                  {formatVersionLabel(v)} — {syllabusStatusLabel(v.approvalStatus)}
                  {effectiveVersion?.versionNumber === v.versionNumber ? ' ★ Effective' : ''}
                </option>
              ))}
            </select>
          )}

          {isReadOnlyGlobal && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>Export / Save PDF</span>
            </button>
          )}

          {canViewHistory && (
            <Link
              href={`/syllabi/${syllabus.id}/versions`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30 shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-[#CA8A04]" />
              <span>Versions & Compare ({versions.length})</span>
            </Link>
          )}

          {canOpenReview && (
            <Link
              href={`/department/syllabus-approvals/${currentVersion.id}`}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Review & Approve / Reject</span>
            </Link>
          )}

          {isDraftOrRejected && canEdit && displayedStatus === 'DRAFT' && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submittingVersion}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>
                {submittingVersion
                  ? 'Submitting...'
                  : isDeptHead
                  ? 'Submit to Dean'
                  : 'Submit to Dept. Head'}
              </span>
            </button>
          )}

          {canEdit && (
            <Link
              href={`/syllabi/${syllabus.id}/edit${currentVersion ? `?fromVersion=${currentVersion.versionNumber}` : ''}`}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <FileEdit className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>{displayedStatus === 'REJECTED' ? 'Revise & Resubmit' : 'Edit Syllabus'}</span>
            </Link>
          )}

          {isFaculty && !canEdit && permStatus === 'PENDING' && (
            <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit Permission Pending</span>
            </span>
          )}

          {isFaculty && !canEdit && permStatus !== 'PENDING' && (
            <button
              type="button"
              onClick={() => setRequestModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{permStatus === 'REJECTED' ? 'Request Edit Permission Again' : 'Request Edit Permission'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Status Banners */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#005A36]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Faculty Edit Permission Status Banner */}
      {isFaculty && permStatus === 'APPROVED' && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#005A36] shrink-0 mt-0.5" />
            <span>
              <strong>Edit Permission Granted:</strong> Your Department Head approved your request to edit this syllabus. You can edit now and submit your proposed changes for Department Head approval.
            </span>
          </div>
          <Link
            href={`/syllabi/${syllabus.id}/edit`}
            className="px-3 py-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white font-bold text-[11px]"
          >
            Open Editor →
          </Link>
        </div>
      )}

      {isFaculty && permStatus === 'PENDING' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Edit Permission Pending:</strong> Your request to edit this syllabus is awaiting your Department Head&apos;s approval.
            {permRequest?.reason ? ` Reason: "${permRequest.reason}"` : ''}
          </span>
        </div>
      )}

      {isFaculty && permStatus === 'REJECTED' && permRequest && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              <strong>Edit Permission Denied:</strong> {permRequest.reviewRemarks || 'Your previous edit request was not approved.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-[11px] cursor-pointer"
          >
            Request Again
          </button>
        </div>
      )}

      {/* Pending Revision Notice while viewing the Effective Approved Syllabus */}
      {!isReadOnlyGlobal &&
        !isStudent &&
        pendingVersion &&
        currentVersion?.versionNumber !== pendingVersion.versionNumber && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">
                  {formatVersionLabel(pendingVersion)} is Pending Approval ({getApprovalRouteLabel(pendingVersion.approvalStatus, pendingVersion.editor?.role)})
                </p>
                <p className="text-amber-800/90 mt-0.5">
                  You are currently viewing the active official <strong>{formatVersionLabel(currentVersion)}</strong>. Once approved, the system will automatically generate the next official version.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/syllabi/${syllabus.id}?version=${pendingVersion.versionNumber}`}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold"
              >
                Preview {formatShortVersionLabel(pendingVersion)}
              </Link>
              <Link
                href={`/syllabi/${syllabus.id}/versions?compareA=${currentVersion.versionNumber}&compareB=${pendingVersion.versionNumber}`}
                className="px-3 py-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white font-bold flex items-center gap-1"
              >
                <GitCompare className="w-3.5 h-3.5 text-[#FEF08A]" />
                <span>Compare Side-by-Side</span>
              </Link>
            </div>
          </div>
        )}

      {/* Non-Effective Banner when inspecting a Draft / Pending / Older version */}
      {!isReadOnlyGlobal && !isStudent && effectiveVersion && !isViewingEffective && (
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            You are inspecting <strong>Version {currentVersion.versionNumber}</strong> ({syllabusStatusLabel(displayedStatus)}). The currently active effective syllabus is <strong>Version {effectiveVersion.versionNumber}</strong>.
          </span>
          <Link
            href={`/syllabi/${syllabus.id}`}
            className="font-bold text-[#005A36] hover:underline"
          >
            Return to Active Effective v{effectiveVersion.versionNumber} →
          </Link>
        </div>
      )}

      {/* Review Comments / Rejection Feedback Banner */}
      {!isReadOnlyGlobal && !isStudent && displayedStatus === 'REJECTED' && reviewComments && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-rose-700 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>
                Returned for Revision by {currentVersion.reviewedBy?.fullName || 'Reviewer'}
                {currentVersion.reviewedBy?.role ? ` (${roleLabel(currentVersion.reviewedBy.role)})` : ''}
              </span>
            </span>
            {canEdit && (
              <Link
                href={`/syllabi/${syllabus.id}/edit?fromVersion=${currentVersion.versionNumber}`}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
              >
                Revise & Resubmit (Creates New Version)
              </Link>
            )}
          </div>
          <p className="bg-white/80 p-3 rounded-xl border border-rose-100 text-slate-800 font-medium">
            &ldquo;{reviewComments}&rdquo;
          </p>
        </div>
      )}

      {/* Integrated Paper-Free Electronic Syllabus Viewer */}
      <ElectronicSyllabusViewer
        syllabus={syllabus}
        version={currentVersion}
        versionsHistory={isReadOnlyGlobal || isStudent ? [] : versions}
        hideApprovalStatus={isReadOnlyGlobal || isStudent}
      />

      {/* Faculty Edit Permission Request Modal */}
      <RequestEditPermissionModal
        isOpen={requestModalOpen}
        syllabusId={syllabus.id}
        subjectCode={syllabus.course.code}
        subjectTitle={syllabus.course.title}
        currentVersionNumber={syllabus.currentVersionNumber}
        onClose={() => setRequestModalOpen(false)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          fetchSyllabus();
        }}
      />
    </div>
  );
}

export default function SyllabusViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
        </div>
      }
    >
      <SyllabusViewerInner />
    </Suspense>
  );
}
