'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, History, Printer } from 'lucide-react';
import ElectronicSyllabusViewer from '@/components/ElectronicSyllabusViewer';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';
import { Alert, Badge, EmptyState, LoadingState, PageHeader, StatusBadge } from '@/components/ui';
import {
  formatShortVersionLabel,
  formatVersionLabel,
  getApprovalRouteLabel,
  roleLabel,
  syllabusStatusLabel,
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
      setError('Failed to load syllabus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabus();
  }, [id, versionParam]);

  if (loading) return <LoadingState className="min-h-[60vh]" />;

  if (!data?.syllabus) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={error || 'Syllabus not found'}
        description="It may not exist, or you may not have permission to view it."
        action={
          <Link href="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  const { syllabus, currentVersion, effectiveVersion, pendingVersion, versions = [], canEdit, editPermission } = data;
  const role = currentUser?.role;
  const isReadOnlyGlobal = role === 'Registrar' || role === 'VPAcademics';
  const isDeptHead = role === 'DepartmentHead';
  const isDean = role === 'Dean';
  const isFaculty = role === 'Educator' || role === 'Faculty';
  const showWorkflow = Boolean(currentUser) && !isReadOnlyGlobal;
  const permStatus = editPermission?.status || 'NONE';
  const permRequest = editPermission?.request || null;

  const displayedStatus = currentVersion?.approvalStatus || syllabus.status;
  const isViewingEffective =
    effectiveVersion && currentVersion && effectiveVersion.versionNumber === currentVersion.versionNumber;
  const reviewComments = extractReviewComments(currentVersion);

  // Reviewers can jump straight to the approval screen for the version on display
  const currentUserIdInt = parseInt(currentUser?.id || '0', 10) || 0;
  const isSelfEdited =
    currentVersion && (currentVersion.editorId === currentUserIdInt || currentVersion.submittedById === currentUserIdInt);
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
      const res = await fetch(`/api/syllabi/${syllabus.id}/versions/${currentVersion.versionNumber}/submit`, { method: 'POST' });
      const resJson = await res.json();
      if (!res.ok) {
        setError(resJson.error || 'Failed to submit version.');
        return;
      }
      setSuccessMessage(resJson.message || 'Submitted for review.');
      await fetchSyllabus();
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  // Pick the single most relevant notice to show above the document
  let notice: React.ReactNode = null;
  if (showWorkflow && displayedStatus === 'REJECTED' && reviewComments) {
    notice = (
      <Alert
        tone="error"
        title={`Returned for revision by ${currentVersion.reviewedBy?.fullName || 'reviewer'}${
          currentVersion.reviewedBy?.role ? ` (${roleLabel(currentVersion.reviewedBy.role)})` : ''
        }`}
      >
        “{reviewComments}”
      </Alert>
    );
  } else if (isFaculty && permStatus === 'REJECTED' && permRequest) {
    notice = (
      <Alert tone="error" title="Your edit request was denied">
        {permRequest.reviewRemarks || 'Contact your Department Head for details.'}
      </Alert>
    );
  } else if (showWorkflow && pendingVersion && currentVersion?.versionNumber !== pendingVersion.versionNumber) {
    notice = (
      <Alert
        tone="warning"
        title={`${formatVersionLabel(pendingVersion)} is awaiting approval`}
        action={
          <div className="flex gap-1.5">
            <Link href={`/syllabi/${syllabus.id}?version=${pendingVersion.versionNumber}`} className="btn btn-secondary btn-sm">
              Preview
            </Link>
            <Link
              href={`/syllabi/${syllabus.id}/versions?compareA=${currentVersion.versionNumber}&compareB=${pendingVersion.versionNumber}`}
              className="btn btn-secondary btn-sm"
            >
              Compare
            </Link>
          </div>
        }
      >
        {getApprovalRouteLabel(pendingVersion.approvalStatus, pendingVersion.editor?.role)}
      </Alert>
    );
  } else if (showWorkflow && effectiveVersion && !isViewingEffective) {
    notice = (
      <Alert
        tone="info"
        action={
          <Link href={`/syllabi/${syllabus.id}`} className="btn btn-secondary btn-sm">
            View v{effectiveVersion.versionNumber}
          </Link>
        }
      >
        You&apos;re viewing {formatVersionLabel(currentVersion)} ({syllabusStatusLabel(displayedStatus)}). Version{' '}
        {effectiveVersion.versionNumber} is the one in effect.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          onBack={() => router.back()}
          eyebrow={
            <>
              <span className="code">{syllabus.course.code}</span>
              <span>
                {syllabus.semester}, AY {syllabus.academicYear}
              </span>
              {showWorkflow && <StatusBadge status={displayedStatus} />}
            </>
          }
          title={syllabus.course.title}
          description={showWorkflow ? formatVersionLabel(currentVersion) : undefined}
          actions={
            <>
              {showWorkflow && versions.length > 1 && (
                <select
                  value={currentVersion?.versionNumber || ''}
                  onChange={(e) => router.push(`/syllabi/${syllabus.id}?version=${e.target.value}`)}
                  className="input w-auto"
                  aria-label="Switch version"
                >
                  {versions.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      {formatShortVersionLabel(v)} — {syllabusStatusLabel(v.approvalStatus)}
                      {effectiveVersion?.versionNumber === v.versionNumber ? ' (in effect)' : ''}
                    </option>
                  ))}
                </select>
              )}

              {isReadOnlyGlobal && (
                <button onClick={() => window.print()} className="btn btn-secondary">
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </button>
              )}

              {showWorkflow && (
                <Link href={`/syllabi/${syllabus.id}/versions`} className="btn btn-secondary">
                  <History className="h-4 w-4" />
                  History
                </Link>
              )}

              {canOpenReview && (
                <Link href={`/department/syllabus-approvals/${currentVersion.id}`} className="btn btn-primary">
                  Review
                </Link>
              )}

              {canEdit && displayedStatus === 'DRAFT' && (
                <button onClick={handleSubmitForApproval} disabled={submittingVersion} className="btn btn-secondary">
                  {submittingVersion ? 'Submitting…' : isDeptHead ? 'Submit to Dean' : 'Submit for approval'}
                </button>
              )}

              {canEdit && (
                <Link
                  href={`/syllabi/${syllabus.id}/edit${currentVersion ? `?fromVersion=${currentVersion.versionNumber}` : ''}`}
                  className="btn btn-primary"
                >
                  {displayedStatus === 'REJECTED' ? 'Revise' : 'Edit'}
                </Link>
              )}

              {isFaculty && !canEdit && permStatus === 'PENDING' && <Badge tone="amber">Edit access requested</Badge>}

              {isFaculty && !canEdit && permStatus !== 'PENDING' && (
                <button type="button" onClick={() => setRequestModalOpen(true)} className="btn btn-primary">
                  {permStatus === 'REJECTED' ? 'Request again' : 'Request edit access'}
                </button>
              )}
            </>
          }
        />
      </div>

      {successMessage && (
        <Alert tone="success" onClose={() => setSuccessMessage('')} className="print:hidden">
          {successMessage}
        </Alert>
      )}
      {error && <Alert tone="error" className="print:hidden">{error}</Alert>}
      {notice && <div className="print:hidden">{notice}</div>}

      <ElectronicSyllabusViewer
        syllabus={syllabus}
        version={currentVersion}
        versionsHistory={showWorkflow ? versions : []}
        hideApprovalStatus={!showWorkflow}
      />

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
    <Suspense fallback={<LoadingState className="min-h-[60vh]" />}>
      <SyllabusViewerInner />
    </Suspense>
  );
}
