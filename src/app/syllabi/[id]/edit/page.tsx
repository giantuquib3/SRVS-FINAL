'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, KeyRound, Clock, CheckCircle2, Send, XCircle } from 'lucide-react';
import ElectronicSyllabusEditor from '@/components/ElectronicSyllabusEditor';
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

  // Inline permission request state (if Faculty arrives directly without permission)
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
      .catch(() => setError('Failed to retrieve syllabus for revision.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id, fromVersionParam]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading electronic syllabus snapshot...</p>
        </div>
      </div>
    );
  }

  const isFaculty = currentUser?.role === 'Educator' || currentUser?.role === 'Faculty';
  const isDeptHead = currentUser?.role === 'DepartmentHead';
  const canAuthor = Boolean(isFaculty || isDeptHead);

  if ((currentUser && !canAuthor) || !data?.syllabus) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">
            {error || 'Syllabus Revision Restricted'}
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Only authorized Faculty (with Department Head edit permission) and the Department Head within the assigned department may edit this electronic syllabus.
          </p>
        </div>
        <Link
          href={id ? `/syllabi/${id}` : '/'}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] text-white hover:bg-[#00472A] shadow-sm transition-all inline-flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Syllabus</span>
        </Link>
      </div>
    );
  }

  const { syllabus, currentVersion, effectiveVersion, versions = [], canEdit, editPermission } = data;

  // Faculty Permission Gate: MUST have Department Head granted permission BEFORE editing!
  if (isFaculty && !canEdit) {
    const permStatus = editPermission?.status || 'NONE';
    const permReq = editPermission?.request || null;
    const isPending = permStatus === 'PENDING';
    const isDenied = permStatus === 'REJECTED';

    const handleRequestPermission = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reqReason.trim()) {
        setReqError('Please provide a reason for requesting edit access.');
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
          setReqError(resJson.error || 'Failed to submit edit permission request.');
          return;
        }
        setReqReason('');
        setReqMessage(resJson.message || 'Edit permission request submitted to your Department Head.');
        loadData();
      } catch {
        setReqError('Network error while submitting request.');
      } finally {
        setReqSubmitting(false);
      }
    };

    return (
      <div className="max-w-xl mx-auto py-10 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 bg-[#005A36] text-white border-b-2 border-[#C99700] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              {isPending ? (
                <Clock className="w-5 h-5 text-[#FEF08A]" />
              ) : (
                <KeyRound className="w-5 h-5 text-[#FEF08A]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                {isPending ? 'Edit Permission Request Pending' : 'Department Head Edit Permission Required'}
              </h2>
              <p className="text-xs text-emerald-100">
                [{syllabus.course.code}] {syllabus.course.title} • Version {syllabus.currentVersionNumber}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs">
            {reqMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#005A36] shrink-0 mt-0.5" />
                <span>{reqMessage}</span>
              </div>
            )}

            {isPending ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Waiting for Department Head Approval</span>
                </p>
                <p className="text-amber-800 leading-relaxed">
                  You submitted an edit permission request on{' '}
                  <strong>{permReq?.requestedAt ? new Date(permReq.requestedAt).toLocaleString() : 'recently'}</strong>.
                  Once your Department Head grants permission, this editor will unlock automatically.
                </p>
                {permReq?.reason && (
                  <p className="text-[11px] text-amber-900 bg-white/80 rounded-lg p-2 border border-amber-200/80 italic">
                    Your Reason: &ldquo;{permReq.reason}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <>
                {isDenied && permReq && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Previous Edit Request Was Denied</span>
                    </p>
                    {permReq.reviewRemarks && (
                      <p className="italic">Department Head Remarks: &ldquo;{permReq.reviewRemarks}&rdquo;</p>
                    )}
                  </div>
                )}

                <p className="text-slate-600 leading-relaxed">
                  Faculty members must first request and obtain permission from their{' '}
                  <strong>Department Head</strong> before editing a syllabus. Once granted, you may revise the
                  electronic syllabus and submit your changes to the Department Head for approval.
                </p>

                {reqError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span>{reqError}</span>
                  </div>
                )}

                <form onSubmit={handleRequestPermission} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-800">
                      Reason / Planned Syllabus Revisions <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="Describe the changes you plan to make to this syllabus..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/syllabi/${syllabus.id}`}
                      className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>View Syllabus</span>
                    </Link>
                    <button
                      type="submit"
                      disabled={reqSubmitting}
                      className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
                      <span>{reqSubmitting ? 'Sending...' : 'Request Edit Permission'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}

            {isPending && (
              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <Link
                  href={`/syllabi/${syllabus.id}`}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Syllabus Viewer</span>
                </Link>
              </div>
            )}
          </div>
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
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
        </div>
      }
    >
      <EditSyllabusInner />
    </Suspense>
  );
}
