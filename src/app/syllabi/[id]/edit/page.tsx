'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Lock } from 'lucide-react';
import ElectronicSyllabusEditor from '@/components/ElectronicSyllabusEditor';
import { Alert, EmptyState, Field, LoadingState, PageHeader, formatDate } from '@/components/ui';
import { normalizeSyllabusContent } from '@/lib/syllabus-template';

function EditSyllabusInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const fromVersionParam = searchParams.get('fromVersion');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Faculty without edit access can request it right here
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqMessage, setReqMessage] = useState('');
  const [reqError, setReqError] = useState('');

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    const versionQuery = fromVersionParam ? `?version=${encodeURIComponent(fromVersionParam)}` : '';
    Promise.all([
      fetch(`/api/syllabi/${id}${versionQuery}`).then((r) => r.json()),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sylData, uData]) => {
        if (uData?.user) setCurrentUser(uData.user);
        if (sylData.error) setError(sylData.error);
        else setData(sylData);
      })
      .catch(() => setError('Failed to load the syllabus.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id, fromVersionParam]);

  if (loading) return <LoadingState className="min-h-[60vh]" />;

  const isFaculty = currentUser?.role === 'Educator' || currentUser?.role === 'Faculty';
  const isDeptHead = currentUser?.role === 'DepartmentHead';
  const canAuthor = Boolean(isFaculty || isDeptHead);

  if ((currentUser && !canAuthor) || !data?.syllabus) {
    return (
      <EmptyState
        icon={Lock}
        title={error || 'You can’t edit this syllabus'}
        description="Only the Department Head, or faculty they’ve granted edit access, can edit a department syllabus."
        action={
          <Link href={id ? `/syllabi/${id}` : '/'} className="btn btn-primary">
            Back to syllabus
          </Link>
        }
      />
    );
  }

  const { syllabus, currentVersion, effectiveVersion, versions = [], canEdit, editPermission } = data;

  // Faculty must be granted edit access by their Department Head first
  if (isFaculty && !canEdit) {
    const permStatus = editPermission?.status || 'NONE';
    const permReq = editPermission?.request || null;
    const isPending = permStatus === 'PENDING';

    const handleRequestPermission = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reqReason.trim()) {
        setReqError('Please describe what you plan to change.');
        return;
      }
      setReqSubmitting(true);
      setReqError('');
      setReqMessage('');
      try {
        const res = await fetch('/api/syllabus-edit-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syllabusId: syllabus.id, reason: reqReason.trim() }),
        });
        const resJson = await res.json();
        if (!res.ok) {
          setReqError(resJson.error || 'Failed to send your request.');
          return;
        }
        setReqReason('');
        setReqMessage(resJson.message || 'Request sent to your Department Head.');
        loadData();
      } catch {
        setReqError('Could not connect to the server.');
      } finally {
        setReqSubmitting(false);
      }
    };

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader
          backHref={`/syllabi/${syllabus.id}`}
          eyebrow={<span className="code">{syllabus.course.code}</span>}
          title={isPending ? 'Edit access requested' : 'Edit access required'}
          description={syllabus.course.title}
        />
        <div className="card space-y-4 p-6 text-sm">
          {reqMessage && <Alert tone="success">{reqMessage}</Alert>}

          {isPending ? (
            <>
              <p className="text-slate-600">
                You requested access on {formatDate(permReq?.requestedAt, true)}. The editor unlocks as soon as your
                Department Head approves.
              </p>
              {permReq?.reason && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">“{permReq.reason}”</p>}
              <div className="flex justify-end">
                <Link href={`/syllabi/${syllabus.id}`} className="btn btn-secondary">
                  Back to syllabus
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleRequestPermission} className="space-y-4">
              {permStatus === 'REJECTED' && permReq && (
                <Alert tone="error" title="Your previous request was denied">
                  {permReq.reviewRemarks}
                </Alert>
              )}
              <p className="text-slate-600">
                Ask your Department Head for edit access. Once granted, your changes go back to them for approval.
              </p>
              {reqError && <Alert tone="error">{reqError}</Alert>}
              <Field label="What do you plan to change?" required>
                <textarea rows={3} value={reqReason} onChange={(e) => setReqReason(e.target.value)} className="input" required />
              </Field>
              <div className="flex justify-end gap-2">
                <Link href={`/syllabi/${syllabus.id}`} className="btn btn-ghost">
                  Cancel
                </Link>
                <button type="submit" disabled={reqSubmitting} className="btn btn-primary">
                  <KeyRound className="h-4 w-4" />
                  {reqSubmitting ? 'Sending…' : 'Request edit access'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const sourceVersion = currentVersion || effectiveVersion || versions[0];
  const initialContent = normalizeSyllabusContent(
    sourceVersion?.content,
    syllabus.subject || syllabus.course,
    syllabus.department?.name || syllabus.departmentId
  );

  return (
    <ElectronicSyllabusEditor
      mode="edit"
      currentUser={currentUser}
      syllabus={syllabus}
      baseVersion={effectiveVersion || sourceVersion}
      initialContent={initialContent}
      versionsHistory={versions}
      submitting={submitting}
      error={error}
      onSubmit={async (payload) => {
        setSubmitting(true);
        setError('');
        try {
          const res = await fetch(`/api/syllabi/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changeSummary: payload.changeSummary,
              content: payload.content,
              saveAsDraft: payload.saveAsDraft,
              submitForApproval: payload.submitForApproval,
            }),
          });
          const resData = await res.json();
          if (!res.ok) {
            setError(resData.error || 'Failed to save new revision.');
            setSubmitting(false);
            return;
          }
          const createdVerNum = resData.version?.versionNumber;
          router.push(createdVerNum ? `/syllabi/${id}?version=${createdVerNum}` : `/syllabi/${id}`);
        } catch {
          setError('Connection error while creating new syllabus version.');
          setSubmitting(false);
        }
      }}
    />
  );
}

export default function EditSyllabusPage() {
  return (
    <Suspense fallback={<LoadingState className="min-h-[60vh]" />}>
      <EditSyllabusInner />
    </Suspense>
  );
}
