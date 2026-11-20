'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  GitCompare,
  RotateCcw,
  Eye,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Send,
  Clock,
  XCircle,
  FileEdit,
  ShieldCheck,
} from 'lucide-react';
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

function VersionHistoryInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const compareAParam = searchParams.get('compareA');
  const compareBParam = searchParams.get('compareB');

  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(1);
  const [showDiff, setShowDiff] = useState(Boolean(compareAParam || compareBParam));

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetRestoreVersion, setTargetRestoreVersion] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState<number | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const [vRes, uRes] = await Promise.all([
        fetch(`/api/syllabi/${id}/versions`),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);

      const vData = await vRes.json();
      if (vData.error) {
        setError(vData.error);
      } else {
        setData(vData);
        if (vData.versions && vData.versions.length > 0) {
          const sorted = vData.versions;
          const defaultB = compareBParam ? Number(compareBParam) : sorted[0].versionNumber;
          const defaultA = compareAParam
            ? Number(compareAParam)
            : sorted.length > 1
            ? sorted[1].versionNumber
            : sorted[0].versionNumber;
          setVersionB(defaultB);
          setVersionA(defaultA);
        }
      }
      if (uRes?.user) setCurrentUser(uRes.user);
    } catch {
      setError('Failed to retrieve version history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchVersions();
  }, [id]);

  const handleSubmitVersion = async (versionNum: number) => {
    const targetReviewer = currentUser?.role === 'DepartmentHead' ? 'Dean' : 'Department Head';
    if (!confirm(`Submit Version ${versionNum} for ${targetReviewer} approval?`)) return;
    setSubmittingVersion(versionNum);
    setActionMsg('');
    try {
      const res = await fetch(`/api/syllabi/${id}/versions/${versionNum}/submit`, { method: 'POST' });
      const resData = await res.json();
      if (res.ok) {
        setActionMsg(resData.message || `Version ${versionNum} submitted for ${targetReviewer} approval.`);
        await fetchVersions();
      } else {
        alert(resData.error || 'Failed to submit version for approval.');
      }
    } catch {
      alert('Connection error submitting version.');
    } finally {
      setSubmittingVersion(null);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!targetRestoreVersion) return;
    setRestoring(true);
    setActionMsg('');
    try {
      const res = await fetch(`/api/syllabi/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber: targetRestoreVersion.versionNumber }),
      });
      const resData = await res.json();
      if (res.ok) {
        setRestoreModalOpen(false);
        setTargetRestoreVersion(null);
        setActionMsg(resData.message || 'Historical version restored as a new draft version.');
        await fetchVersions();
      } else {
        alert(resData.error || 'Failed to restore version.');
      }
    } catch {
      alert('Error connecting to server.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading version history...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Versions Not Found'}</h2>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
      </div>
    );
  }

  const { syllabus, versions } = data;
  const canEditOrRestore = Boolean(data.canEdit);

  const currentUserIdInt = parseInt(currentUser?.id || '0', 10) || 0;
  const objA = versions.find((v: any) => v.versionNumber === Number(versionA)) || versions[versions.length - 1];
  const objB = versions.find((v: any) => v.versionNumber === Number(versionB)) || versions[0];
  const effectiveApproved = versions.find(
    (v: any) => v.approvalStatus === 'APPROVED' && v.versionNumber === syllabus.currentVersionNumber
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href={`/syllabi/${id}`}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold text-[#005A36] font-mono">{syllabus.course.code}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-medium">
                {syllabus.semester}, {syllabus.academicYear}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-mono text-[11px]">
                Syllabus #{syllabus.id} • Subject #{syllabus.subjectId}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Immutable Version History & Side-by-Side Comparison
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEditOrRestore && (
            <Link
              href={`/syllabi/${id}/edit`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 shadow-sm"
            >
              <FileEdit className="w-3.5 h-3.5 text-[#005A36]" />
              <span>Create New Revision</span>
            </Link>
          )}
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
              showDiff ? 'bg-[#005A36] text-white' : 'bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{showDiff ? 'Hide Side-by-Side Compare' : 'Compare Two Versions Side-by-Side'}</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#005A36] shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Side-by-Side Version Comparison */}
      {showDiff && objA && objB && (
        <SyllabusVersionCompare
          versionA={objA}
          versionB={objB}
          subject={syllabus.subject || syllabus.course}
          departmentName={syllabus.department?.name || syllabus.departmentId}
          versions={versions}
          onSelectVersionA={(n) => setVersionA(n)}
          onSelectVersionB={(n) => setVersionB(n)}
        />
      )}

      {/* Version History Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-[#005A36]" />
              <span>Complete Immutable Revision Log</span>
            </h2>
            <p className="text-xs text-slate-500">
              Every edit automatically creates a new version. Previous versions are never overwritten or deleted.
              {effectiveApproved && (
                <>
                  {' '}
                  Current Effective Syllabus: <strong className="text-[#005A36]">Version {effectiveApproved.versionNumber}</strong>.
                </>
              )}
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30">
            {versions.length} Recorded {versions.length === 1 ? 'Version' : 'Versions'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Change Summary & Review Feedback</th>
                <th className="py-2.5 px-3">Editor (Author)</th>
                <th className="py-2.5 px-3">Approval Status & Route</th>
                <th className="py-2.5 px-3">Reviewer / Approver</th>
                <th className="py-2.5 px-3">Modified Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versions.map((v: any) => {
                const isEffective = v.approvalStatus === 'APPROVED' && v.versionNumber === syllabus.currentVersionNumber;
                const isPending = isPendingReview(v.approvalStatus);
                const isApproved = v.approvalStatus === 'APPROVED';
                const isDraft = v.approvalStatus === 'DRAFT';
                const isRejected = v.approvalStatus === 'REJECTED';
                const comments = extractReviewComments(v);
                const isSelf = v.editorId === currentUserIdInt || v.submittedById === currentUserIdInt;
                const canReviewThis =
                  !isSelf &&
                  ((currentUser?.role === 'Dean' && v.approvalStatus === 'UNDER_REVIEW') ||
                    (currentUser?.role === 'DepartmentHead' && v.approvalStatus === 'SUBMITTED'));

                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-bold align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-[#005A36] text-xs font-mono whitespace-nowrap">
                          {formatShortVersionLabel(v)}
                        </span>
                        {isEffective && (
                          <span className="inline-block w-fit text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold">
                            Effective Active
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-900 font-medium max-w-sm align-top space-y-1.5">
                      <div>{v.changeSummary || 'No change summary provided.'}</div>
                      {comments && (
                        <div
                          className={`p-2 rounded-lg text-[11px] border ${
                            isRejected
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          }`}
                        >
                          <span className="font-bold block">
                            {isRejected ? 'Rejection Feedback:' : 'Approver Remarks:'}
                          </span>
                          <span className="italic">&ldquo;{comments}&rdquo;</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-700 align-top">
                      <div className="font-semibold text-slate-900 capitalize">
                        {v.editor?.fullName || `User #${v.editorId}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ID: <span className="font-mono">{v.editorId}</span>
                        {v.editor?.role ? ` • ${roleLabel(v.editor.role)}` : ''}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 align-top space-y-1">
                      {isApproved && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>APPROVED</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-[#CA8A04]" />
                          <span>{syllabusStatusLabel(v.approvalStatus)}</span>
                        </span>
                      )}
                      {isDraft && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          DRAFT
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>REJECTED</span>
                        </span>
                      )}
                      <div className="text-[10px] text-slate-500">
                        {getApprovalRouteLabel(v.approvalStatus, v.editor?.role)}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-700 align-top">
                      {v.reviewedBy ? (
                        <div>
                          <div className="font-semibold text-slate-800 capitalize">{v.reviewedBy.fullName}</div>
                          <div className="text-[10px] text-slate-500">
                            {roleLabel(v.reviewedBy.role)}
                            {v.reviewedAt ? ` • ${new Date(v.reviewedAt).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Pending / N/A</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-500 align-top font-mono text-[11px]">
                      <div>{new Date(v.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px]">
                        {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link
                          href={`/syllabi/${id}?version=${v.versionNumber}`}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-[#005A36]" />
                          <span>View</span>
                        </Link>

                        <button
                          onClick={() => {
                            const compareTarget =
                              effectiveApproved && effectiveApproved.versionNumber !== v.versionNumber
                                ? effectiveApproved.versionNumber
                                : versions[0].versionNumber;
                            setVersionA(Math.min(v.versionNumber, compareTarget));
                            setVersionB(Math.max(v.versionNumber, compareTarget));
                            setShowDiff(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer"
                        >
                          Compare
                        </button>

                        {canReviewThis && (
                          <Link
                            href={`/department/syllabus-approvals/${v.id}`}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Review</span>
                          </Link>
                        )}

                        {isDraft && canEditOrRestore && isSelf && (
                          <button
                            onClick={() => handleSubmitVersion(v.versionNumber)}
                            disabled={submittingVersion === v.versionNumber}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3 text-[#FEF08A]" />
                            <span>{submittingVersion === v.versionNumber ? '...' : 'Submit'}</span>
                          </button>
                        )}

                        {isRejected && canEditOrRestore && isSelf && (
                          <Link
                            href={`/syllabi/${id}/edit?fromVersion=${v.versionNumber}`}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1"
                          >
                            <FileEdit className="w-3 h-3" />
                            <span>Revise</span>
                          </Link>
                        )}

                        {canEditOrRestore && !isEffective && !isDraft && (
                          <button
                            onClick={() => {
                              setTargetRestoreVersion(v);
                              setRestoreModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30 cursor-pointer inline-flex items-center gap-1"
                            title="Copy this snapshot into a new Draft version"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
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
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalOpen && targetRestoreVersion && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-xl space-y-4 text-slate-900">
            <h3 className="text-base font-extrabold text-[#005A36] flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Restore {formatVersionLabel(targetRestoreVersion)} as Draft Proposal</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will create a new <strong>Draft Proposal</strong> copied from {formatVersionLabel(targetRestoreVersion)}. All existing versions and the currently effective approved syllabus remain preserved in revision history.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleRestoreConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer"
              >
                {restoring ? 'Restoring...' : 'Create Restored Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VersionHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
        </div>
      }
    >
      <VersionHistoryInner />
    </Suspense>
  );
}
