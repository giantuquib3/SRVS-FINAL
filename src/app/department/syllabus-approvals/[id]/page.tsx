'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, History } from 'lucide-react';
import ElectronicSyllabusViewer from '@/components/ElectronicSyllabusViewer';
import SyllabusVersionCompare from '@/components/SyllabusVersionCompare';
import {
  Alert,
  Card,
  DeptTag,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  Tabs,
  formatDate,
} from '@/components/ui';
import {
  formatShortVersionLabel,
  formatVersionLabel,
  getApprovalRouteLabel,
  isPendingReview,
  roleLabel,
} from '@/lib/status';
import { extractReviewComments } from '@/lib/syllabus-template';

export default function SyllabusReviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'viewer' | 'comparison'>('viewer');

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
        setError(json.error || 'Failed to load this review.');
        return;
      }
      setData(json);
    } catch {
      setError('Could not connect to the server.');
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
        return;
      }
      setApproveModalOpen(false);
      setActionSuccess(resJson.message || 'Approved. This version is now in effect.');
      await fetchApprovalDetails();
    } catch {
      setActionError('Could not connect to the server.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setActionError('Feedback is required when returning a revision.');
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
        return;
      }
      setRejectModalOpen(false);
      setActionSuccess(resJson.message || 'Returned to the author with your feedback.');
      await fetchApprovalDetails();
    } catch {
      setActionError('Could not connect to the server.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState className="min-h-[60vh]" />;

  const version = data?.version || data?.approval;
  const syllabus = data?.syllabus || version?.syllabus;

  if (error || !version || !syllabus) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={error || 'Review not found'}
        action={
          <Link href="/department/syllabus-approvals" className="btn btn-primary">
            Back to approvals
          </Link>
        }
      />
    );
  }

  const { previousApprovedVersion, allVersions = [], isSelfSubmission, isDeptHeadSubmission, canReview, viewerRole } = data;
  const course = syllabus.course || syllabus.subject || {};
  const editor = version.editor || syllabus.instructor || {};
  const isPending = isPendingReview(version.approvalStatus);
  const isRejected = version.approvalStatus === 'REJECTED';
  const reviewComments = extractReviewComments(version);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/department/syllabus-approvals"
        eyebrow={
          <>
            <span className="code">{course.code}</span>
            <DeptTag code={syllabus.department?.code || syllabus.departmentId} />
            <span>
              {syllabus.semester}, AY {syllabus.academicYear}
            </span>
          </>
        }
        title={course.title}
        description={formatVersionLabel(version)}
        actions={
          <>
            <Link href={`/syllabi/${syllabus.id}/versions`} className="btn btn-ghost">
              <History className="h-4 w-4" />
              Version history
            </Link>
            {canReview && isPending ? (
              <>
                <button onClick={() => setRejectModalOpen(true)} className="btn btn-danger-outline">
                  Return for revision
                </button>
                <button onClick={() => setApproveModalOpen(true)} className="btn btn-primary">
                  Approve
                </button>
              </>
            ) : (
              isRejected &&
              isSelfSubmission && (
                <Link href={`/syllabi/${syllabus.id}/edit?fromVersion=${version.versionNumber}`} className="btn btn-primary">
                  Revise &amp; resubmit
                </Link>
              )
            )}
          </>
        }
      />

      {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {isPending && !canReview && (
        <Alert tone="warning" title={isSelfSubmission ? 'You can’t approve your own revision' : 'Awaiting another reviewer'}>
          {isSelfSubmission
            ? 'This revision is waiting for review by the next approver.'
            : isDeptHeadSubmission
              ? 'Revisions by Department Heads are approved by the Dean.'
              : 'Faculty revisions are approved by their Department Head.'}
        </Alert>
      )}

      <Card className="divide-y divide-slate-100">
        <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Author</dt>
            <dd className="mt-0.5 font-medium capitalize text-slate-900">{editor.fullName || '—'}</dd>
            <dd className="text-xs text-slate-500">{roleLabel(editor.role)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Submitted</dt>
            <dd className="mt-0.5 text-slate-900">{formatDate(version.submittedAt || version.createdAt, Boolean(version.submittedAt))}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={version.approvalStatus} />
            </dd>
            <dd className="mt-1 text-xs text-slate-500">{getApprovalRouteLabel(version.approvalStatus, version.editor?.role)}</dd>
          </div>
        </dl>
        <div className="grid grid-cols-1 gap-4 p-5 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Change summary</p>
            <p className="mt-1 text-slate-800">{version.changeSummary || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Reviewer feedback</p>
            {reviewComments ? (
              <>
                <p className={`mt-1 ${isRejected ? 'text-rose-800' : 'text-slate-800'}`}>“{reviewComments}”</p>
                {version.reviewedBy && (
                  <p className="mt-1 text-xs text-slate-500">
                    {version.reviewedBy.fullName} ({roleLabel(version.reviewedBy.role)})
                    {version.reviewedAt ? ` · ${formatDate(version.reviewedAt)}` : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-slate-400">Not reviewed yet</p>
            )}
          </div>
        </div>
      </Card>

      {previousApprovedVersion && (
        <Tabs
          tabs={[
            { id: 'viewer', label: 'Syllabus' },
            {
              id: 'comparison',
              label: `Compare with ${formatShortVersionLabel(previousApprovedVersion)}`,
            },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      )}

      {activeTab === 'comparison' && previousApprovedVersion ? (
        <SyllabusVersionCompare
          versionA={previousApprovedVersion}
          versionB={version}
          subject={course}
          departmentName={syllabus.department?.name || syllabus.departmentId}
          labelA={`In effect (v${previousApprovedVersion.versionNumber})`}
          labelB="Proposed"
        />
      ) : (
        <ElectronicSyllabusViewer syllabus={syllabus} version={version} versionsHistory={allVersions} />
      )}

      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title={`Approve ${course.code}`}
        description={formatVersionLabel(version)}
        footer={
          <>
            <button type="button" onClick={() => setApproveModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="button" disabled={actionLoading} onClick={handleApprove} className="btn btn-primary">
              {actionLoading ? 'Approving…' : 'Approve'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            As {roleLabel(viewerRole)}, approving makes this <strong>Version {(syllabus.currentVersionNumber || 1) + 1}</strong>, the
            syllabus in effect. Earlier versions stay in the history.
          </p>
          <Field label="Comments (optional)">
            <textarea rows={3} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} className="input" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Return for revision"
        description="The author will see your feedback. The syllabus in effect stays unchanged."
        footer={
          <>
            <button type="button" onClick={() => setRejectModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" form="reject-form" disabled={actionLoading} className="btn btn-danger">
              {actionLoading ? 'Sending…' : 'Return for revision'}
            </button>
          </>
        }
      >
        <form id="reject-form" onSubmit={handleReject}>
          <Field label="Feedback" required>
            <textarea
              rows={4}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="What needs to change before resubmission?"
              className="input"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
