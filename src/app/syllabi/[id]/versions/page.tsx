'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, GitCompare, RotateCcw } from 'lucide-react';
import SyllabusVersionCompare from '@/components/SyllabusVersionCompare';
import { Alert, Badge, Card, EmptyState, LoadingState, Modal, PageHeader, StatusBadge, formatDate } from '@/components/ui';
import { formatShortVersionLabel, formatVersionLabel, roleLabel } from '@/lib/status';
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
        const sorted = vData.versions || [];
        if (sorted.length > 0) {
          setVersionB(compareBParam ? Number(compareBParam) : sorted[0].versionNumber);
          setVersionA(
            compareAParam ? Number(compareAParam) : sorted.length > 1 ? sorted[1].versionNumber : sorted[0].versionNumber
          );
        }
      }
      if (uRes?.user) setCurrentUser(uRes.user);
    } catch {
      setError('Failed to load version history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchVersions();
  }, [id]);

  const handleSubmitVersion = async (versionNum: number) => {
    const reviewer = currentUser?.role === 'DepartmentHead' ? 'the Dean' : 'your Department Head';
    if (!confirm(`Submit this version to ${reviewer} for approval?`)) return;
    setSubmittingVersion(versionNum);
    setActionMsg('');
    try {
      const res = await fetch(`/api/syllabi/${id}/versions/${versionNum}/submit`, { method: 'POST' });
      const resData = await res.json();
      if (res.ok) {
        setActionMsg(resData.message || `Submitted to ${reviewer}.`);
        await fetchVersions();
      } else {
        alert(resData.error || 'Failed to submit version.');
      }
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
        setTargetRestoreVersion(null);
        setActionMsg(resData.message || 'Restored as a new draft.');
        await fetchVersions();
      } else {
        alert(resData.error || 'Failed to restore version.');
      }
    } finally {
      setRestoring(false);
    }
  };

  if (loading) return <LoadingState className="min-h-[60vh]" />;

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={error || 'Version history not found'}
        action={
          <Link href={`/syllabi/${id}`} className="btn btn-primary">
            Back to syllabus
          </Link>
        }
      />
    );
  }

  const { syllabus, versions } = data;
  const canEditOrRestore = Boolean(data.canEdit);
  const currentUserIdInt = parseInt(currentUser?.id || '0', 10) || 0;
  const objA = versions.find((v: any) => v.versionNumber === Number(versionA)) || versions[versions.length - 1];
  const objB = versions.find((v: any) => v.versionNumber === Number(versionB)) || versions[0];
  const effective = versions.find(
    (v: any) => v.approvalStatus === 'APPROVED' && v.versionNumber === syllabus.currentVersionNumber
  );

  const compareWith = (v: any) => {
    const target = effective && effective.versionNumber !== v.versionNumber ? effective.versionNumber : versions[0].versionNumber;
    setVersionA(Math.min(v.versionNumber, target));
    setVersionB(Math.max(v.versionNumber, target));
    setShowDiff(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/syllabi/${id}`}
        eyebrow={
          <>
            <span className="code">{syllabus.course.code}</span>
            <span>{syllabus.course.title}</span>
          </>
        }
        title="Version history"
        description={
          <>
            Every edit creates a new version; nothing is overwritten.
            {effective && <> Version {effective.versionNumber} is in effect.</>}
          </>
        }
        actions={
          <>
            {versions.length > 1 && (
              <button onClick={() => setShowDiff(!showDiff)} className="btn btn-secondary">
                <GitCompare className="h-4 w-4" />
                {showDiff ? 'Hide comparison' : 'Compare versions'}
              </button>
            )}
            {canEditOrRestore && (
              <Link href={`/syllabi/${id}/edit`} className="btn btn-primary">
                New revision
              </Link>
            )}
          </>
        }
      />

      {actionMsg && (
        <Alert tone="success" onClose={() => setActionMsg('')}>
          {actionMsg}
        </Alert>
      )}

      {showDiff && objA && objB && (
        <SyllabusVersionCompare
          versionA={objA}
          versionB={objB}
          subject={syllabus.subject || syllabus.course}
          departmentName={syllabus.department?.name || syllabus.departmentId}
          versions={versions}
          onSelectVersionA={setVersionA}
          onSelectVersionB={setVersionB}
        />
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Changes</th>
                <th>Author</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v: any) => {
                const isEffective = v.approvalStatus === 'APPROVED' && v.versionNumber === syllabus.currentVersionNumber;
                const isDraft = v.approvalStatus === 'DRAFT';
                const isRejected = v.approvalStatus === 'REJECTED';
                const comments = extractReviewComments(v);
                const isSelf = v.editorId === currentUserIdInt || v.submittedById === currentUserIdInt;
                const canReviewThis =
                  !isSelf &&
                  ((currentUser?.role === 'Dean' && v.approvalStatus === 'UNDER_REVIEW') ||
                    (currentUser?.role === 'DepartmentHead' && v.approvalStatus === 'SUBMITTED'));

                return (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-slate-900">{formatShortVersionLabel(v)}</span>
                      {isEffective && (
                        <div className="mt-1">
                          <Badge tone="green">In effect</Badge>
                        </div>
                      )}
                    </td>
                    <td className="max-w-sm">
                      <p className="text-slate-800">{v.changeSummary || <span className="text-slate-400">No summary</span>}</p>
                      {comments && (
                        <p className={`mt-1 text-xs italic ${isRejected ? 'text-rose-700' : 'text-slate-500'}`}>“{comments}”</p>
                      )}
                    </td>
                    <td>
                      <p className="capitalize text-slate-900">{v.editor?.fullName || `User #${v.editorId}`}</p>
                      <p className="text-xs text-slate-500">{roleLabel(v.editor?.role)}</p>
                    </td>
                    <td>
                      <StatusBadge status={v.approvalStatus} />
                      {v.reviewedBy && (
                        <p className="mt-1 text-xs text-slate-500">
                          by {v.reviewedBy.fullName}
                          {v.reviewedAt ? ` · ${formatDate(v.reviewedAt)}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-slate-500">{formatDate(v.createdAt, true)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/syllabi/${id}?version=${v.versionNumber}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                        {versions.length > 1 && (
                          <button onClick={() => compareWith(v)} className="btn btn-ghost btn-sm">
                            Compare
                          </button>
                        )}
                        {canReviewThis && (
                          <Link href={`/department/syllabus-approvals/${v.id}`} className="btn btn-primary btn-sm">
                            Review
                          </Link>
                        )}
                        {isDraft && canEditOrRestore && isSelf && (
                          <button
                            onClick={() => handleSubmitVersion(v.versionNumber)}
                            disabled={submittingVersion === v.versionNumber}
                            className="btn btn-primary btn-sm"
                          >
                            {submittingVersion === v.versionNumber ? 'Submitting…' : 'Submit'}
                          </button>
                        )}
                        {isRejected && canEditOrRestore && isSelf && (
                          <Link href={`/syllabi/${id}/edit?fromVersion=${v.versionNumber}`} className="btn btn-primary btn-sm">
                            Revise
                          </Link>
                        )}
                        {canEditOrRestore && !isEffective && !isDraft && (
                          <button
                            onClick={() => setTargetRestoreVersion(v)}
                            className="btn btn-ghost btn-icon"
                            title="Restore as a new draft"
                            aria-label="Restore as a new draft"
                          >
                            <RotateCcw className="h-4 w-4" />
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
      </Card>

      <Modal
        open={Boolean(targetRestoreVersion)}
        onClose={() => setTargetRestoreVersion(null)}
        title={`Restore ${targetRestoreVersion ? formatVersionLabel(targetRestoreVersion) : ''}?`}
        footer={
          <>
            <button type="button" onClick={() => setTargetRestoreVersion(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="button" disabled={restoring} onClick={handleRestoreConfirm} className="btn btn-primary">
              {restoring ? 'Restoring…' : 'Restore as draft'}
            </button>
          </>
        }
      >
        <p className="text-slate-600">
          This creates a new draft copied from that version. All existing versions, including the one in effect, are kept.
        </p>
      </Modal>
    </div>
  );
}

export default function VersionHistoryPage() {
  return (
    <Suspense fallback={<LoadingState className="min-h-[60vh]" />}>
      <VersionHistoryInner />
    </Suspense>
  );
}
