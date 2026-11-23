'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Clock, KeyRound, Layers, XCircle } from 'lucide-react';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  SearchInput,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { formatShortVersionLabel, isPendingReview } from '@/lib/status';

type Filter = 'ALL' | 'GRANTED' | 'PERM_PENDING' | 'SUBMITTED' | 'REJECTED';

export default function EducatorDashboard() {
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [requestTarget, setRequestTarget] = useState<{
    syllabusId: number;
    code: string;
    title: string;
    currentVersionNumber: number;
  } | null>(null);

  const isMine = (s: any, user: any) => {
    if (!user) return false;
    const uName = (user.fullName || '').trim().toLowerCase();
    return s.instructorId === Number(user.id) || (uName && (s.subject?.professorName || '').trim().toLowerCase() === uName);
  };

  const fetchEducatorData = async () => {
    setLoading(true);
    try {
      const [meRes, statsRes, syllabiRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/dashboard/stats'),
        fetch('/api/syllabi?status=ALL'),
      ]);
      const meData = meRes.ok ? await meRes.json() : null;
      const loggedUser = meData?.user || null;
      setCurrentUser(loggedUser);
      setData(await statsRes.json());

      // Granted edit access first, then courses assigned to me, then by course code
      const list: any[] = (await syllabiRes.json()).syllabi || [];
      list.sort((a, b) => {
        const grant = Number(b.editPermissionStatus === 'APPROVED') - Number(a.editPermissionStatus === 'APPROVED');
        if (grant) return grant;
        const mine = Number(isMine(b, loggedUser)) - Number(isMine(a, loggedUser));
        if (mine) return mine;
        return String(a.course?.code || '').localeCompare(String(b.course?.code || ''));
      });
      setSyllabi(list);
    } catch (err) {
      console.error('Error fetching educator data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducatorData();
  }, []);

  const handleSubmitDraftVersion = async (syllabusId: number, versionNumber: number) => {
    setSubmittingId(syllabusId);
    setActionMessage('');
    try {
      const res = await fetch(`/api/syllabi/${syllabusId}/versions/${versionNumber}/submit`, { method: 'POST' });
      const resData = await res.json();
      if (res.ok) {
        setActionMessage(resData.message || 'Draft submitted to your Department Head for approval.');
        await fetchEducatorData();
      } else {
        alert(resData.error || 'Failed to submit syllabus version.');
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const stats = data?.stats || {};
  const q = searchQuery.trim().toLowerCase();
  const filteredSyllabi = syllabi.filter((s) => {
    if (q && !`${s.course?.code || ''} ${s.course?.title || ''}`.toLowerCase().includes(q)) return false;
    const latestStatus = s.latestVersion?.approvalStatus || s.status;
    switch (statusFilter) {
      case 'GRANTED':
        return s.editPermissionStatus === 'APPROVED';
      case 'PERM_PENDING':
        return s.editPermissionStatus === 'PENDING';
      case 'SUBMITTED':
        return Boolean(s.pendingVersion) || isPendingReview(latestStatus);
      case 'REJECTED':
        return Boolean(s.latestRejectedVersion) || latestStatus === 'REJECTED';
      default:
        return true;
    }
  });

  const toggle = (f: Filter) => setStatusFilter(statusFilter === f ? 'ALL' : f);

  if (loading && !data) return <LoadingState className="min-h-[60vh]" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty dashboard"
        description={
          data?.department?.name
            ? `Syllabi in ${data.department.name}. Request edit access from your Department Head to propose changes.`
            : 'Request edit access from your Department Head to propose syllabus changes.'
        }
      />

      {actionMessage && (
        <Alert tone="success" onClose={() => setActionMessage('')}>
          {actionMessage}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="All syllabi" value={syllabi.length} icon={Layers} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
        <StatCard
          label="Edit access"
          value={stats.grantedEditPermissions ?? syllabi.filter((s) => s.editPermissionStatus === 'APPROVED').length}
          icon={CheckCircle2}
          active={statusFilter === 'GRANTED'}
          onClick={() => toggle('GRANTED')}
        />
        <StatCard
          label="Access requested"
          value={stats.pendingEditRequests ?? syllabi.filter((s) => s.editPermissionStatus === 'PENDING').length}
          icon={KeyRound}
          active={statusFilter === 'PERM_PENDING'}
          onClick={() => toggle('PERM_PENDING')}
        />
        <StatCard
          label="In review"
          value={stats.submittedCount ?? 0}
          icon={Clock}
          active={statusFilter === 'SUBMITTED'}
          onClick={() => toggle('SUBMITTED')}
        />
        <StatCard
          label="Returned"
          value={stats.rejectedCount ?? 0}
          icon={XCircle}
          tone={stats.rejectedCount ? 'red' : 'default'}
          active={statusFilter === 'REJECTED'}
          onClick={() => toggle('REJECTED')}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">
            Department syllabi <span className="font-normal text-slate-500">({filteredSyllabi.length})</span>
          </p>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by code or title" className="sm:w-72" />
        </div>

        {filteredSyllabi.length === 0 ? (
          <EmptyState icon={BookOpen} title="No syllabi match" description="Try a different filter or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>In effect</th>
                  <th>Latest revision</th>
                  <th>Edit access</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSyllabi.map((s) => {
                  const latest = s.latestVersion;
                  const approved = s.approvedVersion;
                  const pending = s.pendingVersion;
                  const rejected = latest?.approvalStatus === 'REJECTED' ? latest : null;
                  const permStatus = s.editPermissionStatus || 'NONE';
                  const hasEditAccess = permStatus === 'APPROVED';
                  const historyHref = `/syllabi/${s.id}/versions${
                    approved && pending ? `?compareA=${approved.versionNumber}&compareB=${pending.versionNumber}` : ''
                  }`;

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="code">{s.course.code}</span>
                          {isMine(s, currentUser) && <Badge >Assigned to you</Badge>}
                        </div>
                        <p className="text-slate-900">{s.course.title}</p>
                        <p className="text-xs text-slate-500">{s.semester}</p>
                      </td>
                      <td>
                        {approved ? (
                          <>
                            <Badge tone="green">v{approved.versionNumber}</Badge>
                            {approved.reviewedBy?.fullName && (
                              <p className="mt-1 text-xs text-slate-500">by {approved.reviewedBy.fullName}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Not yet approved</span>
                        )}
                      </td>
                      <td className="max-w-xs">
                        {latest && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-600">{formatShortVersionLabel(latest)}</span>
                            <StatusBadge status={latest.approvalStatus} />
                          </div>
                        )}
                        {rejected?.rejectionReason ? (
                          <p className="mt-1 line-clamp-2 text-xs text-rose-700">“{rejected.rejectionReason}”</p>
                        ) : (
                          latest?.changeSummary && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{latest.changeSummary}</p>
                        )}
                      </td>
                      <td>
                        {permStatus === 'APPROVED' ? (
                          <Badge tone="green">Granted</Badge>
                        ) : permStatus === 'PENDING' ? (
                          <Badge tone="amber">Requested</Badge>
                        ) : permStatus === 'REJECTED' ? (
                          <>
                            <Badge tone="red">Denied</Badge>
                            {s.editPermissionRequest?.reviewRemarks && (
                              <p className="mt-1 line-clamp-1 text-xs italic text-rose-700">“{s.editPermissionRequest.reviewRemarks}”</p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/syllabi/${s.id}`} className="btn btn-secondary btn-sm">
                            View
                          </Link>
                          <Link href={historyHref} className="btn btn-ghost btn-sm">
                            History
                          </Link>
                          {hasEditAccess ? (
                            <>
                              {latest?.approvalStatus === 'DRAFT' && (
                                <button
                                  type="button"
                                  disabled={submittingId === s.id}
                                  onClick={() => handleSubmitDraftVersion(s.id, latest.versionNumber)}
                                  className="btn btn-secondary btn-sm"
                                >
                                  {submittingId === s.id ? 'Submitting…' : 'Submit draft'}
                                </button>
                              )}
                              <Link
                                href={`/syllabi/${s.id}/edit${rejected ? `?fromVersion=${rejected.versionNumber}` : ''}`}
                                className="btn btn-primary btn-sm"
                              >
                                {rejected ? 'Revise' : 'Edit'}
                              </Link>
                            </>
                          ) : permStatus !== 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setRequestTarget({
                                  syllabusId: s.id,
                                  code: s.course.code,
                                  title: s.course.title,
                                  currentVersionNumber: s.currentVersionNumber || 1,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                            >
                              Request edit
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {requestTarget && (
        <RequestEditPermissionModal
          isOpen
          syllabusId={requestTarget.syllabusId}
          subjectCode={requestTarget.code}
          subjectTitle={requestTarget.title}
          currentVersionNumber={requestTarget.currentVersionNumber}
          onClose={() => setRequestTarget(null)}
          onSuccess={(msg) => {
            setActionMessage(msg);
            fetchEducatorData();
          }}
        />
      )}
    </div>
  );
}
