'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Clock, Eye, KeyRound, Layers, Send } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  DeptTag,
  EmptyState,
  Field,
  FilterPills,
  LoadingState,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  Tabs,
  formatDate,
  useToast,
} from '@/components/ui';
import {
  formatShortVersionLabel,
  formatVersionLabel,
  getApprovalRouteLabel,
  roleLabel,
  syllabusStatusLabel,
} from '@/lib/status';
import { DEPARTMENTS } from '@/lib/departments';

type TabId = 'approvals' | 'edit-requests' | 'syllabi' | 'my-dean';
type EditReqFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'ALL';

const EDIT_REQ_STATUS: Record<string, { label: string; tone: 'amber' | 'green' | 'blue' | 'red' }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  APPROVED: { label: 'Granted', tone: 'green' },
  COMPLETED: { label: 'Completed', tone: 'blue' },
  REJECTED: { label: 'Denied', tone: 'red' },
};

export default function DeptHeadAndDeanDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [myDeanSubmissions, setMyDeanSubmissions] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [editReqFilter, setEditReqFilter] = useState<EditReqFilter>('PENDING');
  const [deanDeptFilter, setDeanDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('approvals');
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const { toast, showToast } = useToast();

  // Deny / revoke edit permission
  const [editReqModal, setEditReqModal] = useState<{ request: any; action: 'REJECT' | 'REVOKE' } | null>(null);
  const [editReqRemarks, setEditReqRemarks] = useState('');

  // Quick approve / reject of a pending version
  const [approvingVersion, setApprovingVersion] = useState<any | null>(null);
  const [approveComments, setApproveComments] = useState('');
  const [rejectingVersion, setRejectingVersion] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const deptQuery = deanDeptFilter ? `&departmentId=${encodeURIComponent(deanDeptFilter)}` : '';
      const subjQuery = deanDeptFilter ? `?departmentId=${encodeURIComponent(deanDeptFilter)}` : '';
      const [meRes, statsRes, coursesRes, syllabiRes, approvalsRes, deptsRes, editReqsRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/dashboard/stats').then((r) => r.json()),
        fetch(`/api/subjects${subjQuery}`).then((r) => r.json()),
        fetch(`/api/syllabi?status=ALL${deptQuery}`).then((r) => r.json()),
        fetch(`/api/syllabus-approvals?status=PENDING_APPROVAL${deptQuery}`).then((r) =>
          r.ok ? r.json() : { approvals: [], mySubmissions: [] }
        ),
        fetch('/api/departments').then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/syllabus-edit-requests?status=ALL${deptQuery}`).then((r) => (r.ok ? r.json() : { requests: [] })),
      ]);

      if (meRes?.user) setCurrentUser(meRes.user);
      setData(statsRes);
      if (deptsRes?.departments?.length) setDepartmentsList(deptsRes.departments);
      setCourses(coursesRes.subjects || coursesRes.courses || []);
      setSyllabi(syllabiRes.syllabi || []);
      setPendingQueue(approvalsRes.approvals || []);
      setMyDeanSubmissions(approvalsRes.mySubmissions || []);
      setEditRequests(editReqsRes.requests || []);

      if (meRes?.user?.role === 'DepartmentHead') {
        fetch('/api/department-head/pending-users?format=detailed')
          .then((r) => (r.ok ? r.json() : null))
          .then((reg) => {
            const list = Array.isArray(reg) ? reg : reg?.pendingUsers || [];
            setPendingRegistrations(list.length);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [deanDeptFilter]);

  // Deep link from notifications: /dept/dashboard?tab=edit-requests
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'edit-requests' || tab === 'syllabi' || tab === 'my-dean') setActiveTab(tab);
  }, []);

  const isDean = currentUser?.role === 'Dean' || data?.role === 'Dean';
  const isDeptHead = currentUser?.role === 'DepartmentHead' || data?.role === 'DepartmentHead';
  const currentDept = data?.department;
  const stats = data?.stats || {};
  const pendingEditRequests = editRequests.filter((r) => r.status === 'PENDING').length;
  const grantedEditRequests = editRequests.filter((r) => r.status === 'APPROVED').length;
  const awaitingDean = myDeanSubmissions.filter((v) => v.approvalStatus === 'UNDER_REVIEW').length;
  const visibleEditRequests = editRequests.filter((r) => editReqFilter === 'ALL' || r.status === editReqFilter);

  const patchEditRequest = async (id: number, body: object, fallbackMsg: string) => {
    setProcessingId(`edit-req-${id}`);
    try {
      const res = await fetch(`/api/syllabus-edit-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || fallbackMsg);
        return true;
      }
      showToast(resData.error || 'Failed to update edit permission.', 'error');
    } catch {
      showToast('Network error while updating edit permission.', 'error');
    } finally {
      setProcessingId(null);
    }
    return false;
  };

  const handleGrantEditPermission = async (req: any) => {
    if (await patchEditRequest(req.id, { action: 'APPROVE' }, 'Edit permission granted.')) await fetchAllData();
  };

  const handleConfirmDenyOrRevoke = async () => {
    if (!editReqModal || !editReqRemarks.trim()) return;
    const ok = await patchEditRequest(
      editReqModal.request.id,
      { action: editReqModal.action, remarks: editReqRemarks.trim() },
      'Edit permission updated.'
    );
    if (ok) {
      setEditReqModal(null);
      setEditReqRemarks('');
      await fetchAllData();
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingVersion) return;
    setProcessingId(approvingVersion.id);
    try {
      const res = await fetch(`/api/syllabus-approvals/${approvingVersion.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: approveComments }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Version approved and now in effect.');
        setApprovingVersion(null);
        setApproveComments('');
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to approve syllabus version.', 'error');
      }
    } catch {
      showToast('Network error while approving syllabus.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingVersion || !rejectRemarks.trim()) return;
    setProcessingId(rejectingVersion.id);
    try {
      const res = await fetch(`/api/syllabus-approvals/${rejectingVersion.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectRemarks.trim() }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Returned to the author with your feedback.');
        setRejectingVersion(null);
        setRejectRemarks('');
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to reject syllabus version.', 'error');
      }
    } catch {
      showToast('Network error while rejecting syllabus.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !data) return <LoadingState className="min-h-[60vh]" />;

  const tabs: Array<{ id: TabId; label: string; count?: number; highlight?: boolean }> = [
    { id: 'approvals', label: 'Review queue', count: pendingQueue.length, highlight: true },
    ...(isDeptHead ? [{ id: 'edit-requests' as const, label: 'Edit requests', count: pendingEditRequests, highlight: true }] : []),
    { id: 'syllabi', label: 'Syllabi', count: syllabi.length },
    ...(isDeptHead ? [{ id: 'my-dean' as const, label: 'My revisions', count: myDeanSubmissions.length }] : []),
  ];

  return (
    <div className="space-y-6">
      {toast}

      <PageHeader
        title={isDean ? 'Dean dashboard' : 'Department dashboard'}
        description={
          isDean
            ? 'Review revisions submitted by Department Heads across all departments.'
            : `Review faculty revisions and manage edit access for ${currentDept?.name || currentDept?.code || 'your department'}.`
        }
        actions={
          isDean && (
            <select
              value={deanDeptFilter}
              onChange={(e) => setDeanDeptFilter(e.target.value)}
              className="input w-60"
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {isDeptHead && pendingRegistrations > 0 && (
        <Alert
          tone="warning"
          title={`${pendingRegistrations} faculty registration${pendingRegistrations === 1 ? '' : 's'} awaiting your approval`}
          action={
            <Link href="/dept/users?status=PendingApproval" className="btn btn-secondary btn-sm">
              Review
            </Link>
          }
        />
      )}

      <div className={`grid grid-cols-2 gap-4 ${isDeptHead ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard
          label={isDean ? 'Awaiting your approval' : 'Revisions to review'}
          value={pendingQueue.length}
          hint={isDean ? 'From Department Heads' : 'From faculty'}
          icon={Clock}
          tone={pendingQueue.length ? 'amber' : 'default'}
          active={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
        />
        {isDeptHead && (
          <StatCard
            label="Edit requests"
            value={pendingEditRequests}
            hint={`${grantedEditRequests} currently granted`}
            icon={KeyRound}
            tone={pendingEditRequests ? 'amber' : 'default'}
            active={activeTab === 'edit-requests'}
            onClick={() => setActiveTab('edit-requests')}
          />
        )}
        <StatCard
          label="Approved syllabi"
          value={stats.approvedSyllabi ?? 0}
          hint={`of ${syllabi.length} total`}
          icon={CheckCircle2}
          active={activeTab === 'syllabi'}
          onClick={() => setActiveTab('syllabi')}
        />
        {isDeptHead ? (
          <StatCard
            label="My revisions"
            value={myDeanSubmissions.length}
            hint={`${awaitingDean} awaiting the Dean`}
            icon={Send}
            active={activeTab === 'my-dean'}
            onClick={() => setActiveTab('my-dean')}
          />
        ) : (
          <Link href="/subjects" className="block">
            <StatCard label="Courses" value={courses.length} hint="View catalog →" icon={BookOpen} />
          </Link>
        )}
      </div>

      <Card>
        <div className="px-4 pt-3">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Review queue */}
        {activeTab === 'approvals' &&
          (pendingQueue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="You're all caught up"
              description={
                isDean
                  ? 'Revisions submitted by Department Heads will appear here.'
                  : 'Syllabus revisions submitted by your faculty will appear here.'
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Submitted by</th>
                      <th>Change summary</th>
                      <th>Submitted</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQueue.map((item) => {
                      const subj = item.syllabus?.subject || item.syllabus?.course;
                      const busy = processingId === item.id;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className="code">{subj?.code}</span>
                              {isDean && <DeptTag code={item.syllabus?.departmentId} />}
                            </div>
                            <p className="text-slate-900">{subj?.title}</p>
                          </td>
                          <td>
                            <p className="capitalize text-slate-900">{item.editor?.fullName}</p>
                            <p className="text-xs text-slate-500">{roleLabel(item.editor?.role)}</p>
                          </td>
                          <td className="max-w-sm">
                            <p className="text-xs font-medium text-slate-500">{formatVersionLabel(item)}</p>
                            <p className="mt-0.5 line-clamp-2 text-slate-700">{item.changeSummary}</p>
                          </td>
                          <td className="whitespace-nowrap text-slate-500">{formatDate(item.submittedAt || item.createdAt)}</td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <Link href={`/department/syllabus-approvals/${item.id}`} className="btn btn-secondary btn-sm">
                                Review
                              </Link>
                              {item.canReview && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setRejectingVersion(item);
                                      setRejectRemarks('');
                                    }}
                                    className="btn btn-danger-outline btn-sm"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setApprovingVersion(item);
                                      setApproveComments('');
                                    }}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Approve
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href="/department/syllabus-approvals"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  View full approval history <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          ))}

        {/* Edit permission requests */}
        {isDeptHead && activeTab === 'edit-requests' && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="hidden text-xs text-slate-500 sm:block">Faculty need your permission before editing a syllabus.</p>
              <FilterPills
                options={[
                  { id: 'PENDING', label: 'Pending' },
                  { id: 'APPROVED', label: 'Granted' },
                  { id: 'REJECTED', label: 'Denied' },
                  { id: 'COMPLETED', label: 'Completed' },
                  { id: 'ALL', label: 'All' },
                ]}
                value={editReqFilter}
                onChange={setEditReqFilter}
              />
            </div>
            {visibleEditRequests.length === 0 ? (
              <EmptyState icon={KeyRound} title="No edit requests" description="Requests from faculty to edit a syllabus appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Faculty</th>
                      <th>Course</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEditRequests.map((req) => {
                      const busy = processingId === `edit-req-${req.id}`;
                      const st = EDIT_REQ_STATUS[req.status] || EDIT_REQ_STATUS.REJECTED;
                      return (
                        <tr key={req.id}>
                          <td>
                            <p className="capitalize text-slate-900">{req.faculty?.fullName}</p>
                            <p className="text-xs text-slate-500">Requested {formatDate(req.requestedAt)}</p>
                          </td>
                          <td>
                            <span className="code">{req.syllabus?.subject?.code}</span>
                            <p className="text-slate-900">{req.syllabus?.subject?.title}</p>
                          </td>
                          <td className="max-w-sm">
                            <p className="text-slate-700">{req.reason}</p>
                            {req.reviewRemarks && req.status !== 'PENDING' && (
                              <p className="mt-1 text-xs italic text-slate-500">Your remarks: “{req.reviewRemarks}”</p>
                            )}
                          </td>
                          <td>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <Link href={`/syllabi/${req.syllabusId}`} className="btn btn-ghost btn-icon" title="View syllabus">
                                <Eye className="h-4 w-4" />
                              </Link>
                              {req.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditReqModal({ request: req, action: 'REJECT' });
                                      setEditReqRemarks('');
                                    }}
                                    className="btn btn-danger-outline btn-sm"
                                  >
                                    Deny
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleGrantEditPermission(req)}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Grant
                                  </button>
                                </>
                              )}
                              {req.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditReqModal({ request: req, action: 'REVOKE' });
                                    setEditReqRemarks('');
                                  }}
                                  className="btn btn-danger-outline btn-sm"
                                >
                                  Revoke
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
            )}
          </>
        )}

        {/* All syllabi */}
        {activeTab === 'syllabi' &&
          (syllabi.length === 0 ? (
            <EmptyState icon={Layers} title="No syllabi yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>In effect</th>
                    <th>Latest activity</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {syllabi.map((s) => {
                    const subj = s.subject || s.course;
                    const approved = s.approvedVersion;
                    const pending = s.pendingVersion;
                    const latest = s.latestVersion;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="code">{subj?.code}</span>
                            {isDean && <DeptTag code={s.departmentId} />}
                          </div>
                          <p className="text-slate-900">{subj?.title}</p>
                          <p className="text-xs text-slate-500">
                            {s.semester}, AY {s.academicYear}
                          </p>
                        </td>
                        <td>
                          {approved ? (
                            <Badge tone="green">v{approved.versionNumber}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">Not yet approved</span>
                          )}
                        </td>
                        <td>
                          {pending ? (
                            <>
                              <StatusBadge
                                status={pending.approvalStatus}
                                label={`${formatShortVersionLabel(pending)} · pending`}
                              />
                              <p className="mt-1 text-xs text-slate-500">
                                by <span className="capitalize">{pending.editor?.fullName}</span>
                              </p>
                            </>
                          ) : latest ? (
                            <span className="text-xs text-slate-500">
                              {formatShortVersionLabel(latest)} · {syllabusStatusLabel(latest.approvalStatus)}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <Link href={`/syllabi/${s.id}`} className="btn btn-secondary btn-sm">
                              View
                            </Link>
                            {isDeptHead && (
                              <Link href={`/syllabi/${s.id}/edit`} className="btn btn-secondary btn-sm" title="Edits are sent to the Dean for approval">
                                Edit
                              </Link>
                            )}
                            <Link href={`/syllabi/${s.id}/versions`} className="btn btn-ghost btn-sm">
                              History
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {/* My revisions sent to the Dean */}
        {isDeptHead &&
          activeTab === 'my-dean' &&
          (myDeanSubmissions.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No revisions yet"
              description="Syllabus edits you make are sent to the Dean for approval and tracked here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Change summary</th>
                    <th>Status</th>
                    <th>Dean feedback</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myDeanSubmissions.map((item) => {
                    const subj = item.syllabus?.subject || item.syllabus?.course;
                    const isRejected = item.approvalStatus === 'REJECTED';
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="code">{subj?.code}</span>
                          <p className="text-slate-900">{subj?.title}</p>
                        </td>
                        <td className="max-w-xs">
                          <p className="text-xs font-medium text-slate-500">{formatVersionLabel(item)}</p>
                          <p className="mt-0.5 text-slate-700">{item.changeSummary}</p>
                        </td>
                        <td>
                          <StatusBadge status={item.approvalStatus} />
                          <p className="mt-1 text-xs text-slate-500">{getApprovalRouteLabel(item.approvalStatus, 'DepartmentHead')}</p>
                        </td>
                        <td className="max-w-xs">
                          {item.reviewComments ? (
                            <p className="text-xs italic text-slate-600">
                              “{item.reviewComments}”
                              {item.reviewedBy?.fullName && <span className="block not-italic text-slate-400">— {item.reviewedBy.fullName}</span>}
                            </p>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <Link href={`/syllabi/${item.syllabusId}?version=${item.versionNumber}`} className="btn btn-secondary btn-sm">
                              View
                            </Link>
                            {isRejected && (
                              <Link
                                href={`/syllabi/${item.syllabusId}/edit?fromVersion=${item.versionNumber}`}
                                className="btn btn-primary btn-sm"
                              >
                                Revise
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </Card>

      {/* Approve */}
      <Modal
        open={Boolean(approvingVersion)}
        onClose={() => setApprovingVersion(null)}
        title={`Approve ${approvingVersion?.syllabus?.subject?.code || ''}`}
        description={approvingVersion ? formatVersionLabel(approvingVersion) : undefined}
        footer={
          <>
            <button type="button" onClick={() => setApprovingVersion(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="button" disabled={processingId === approvingVersion?.id} onClick={handleConfirmApprove} className="btn btn-primary">
              {processingId === approvingVersion?.id ? 'Approving…' : 'Approve'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            This becomes <strong>Version {(approvingVersion?.syllabus?.currentVersionNumber || 1) + 1}</strong>, the syllabus in
            effect. Earlier versions stay in the history.
          </p>
          <Field label="Comments (optional)">
            <textarea rows={3} value={approveComments} onChange={(e) => setApproveComments(e.target.value)} className="input" />
          </Field>
        </div>
      </Modal>

      {/* Reject */}
      <Modal
        open={Boolean(rejectingVersion)}
        onClose={() => setRejectingVersion(null)}
        title={`Return ${rejectingVersion?.syllabus?.subject?.code || ''} for revision`}
        description="The author will see your feedback. The syllabus in effect stays unchanged."
        footer={
          <>
            <button type="button" onClick={() => setRejectingVersion(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              disabled={!rejectRemarks.trim() || processingId === rejectingVersion?.id}
              onClick={handleConfirmReject}
              className="btn btn-danger"
            >
              {processingId === rejectingVersion?.id ? 'Sending…' : 'Return for revision'}
            </button>
          </>
        }
      >
        <Field label="Feedback" required>
          <textarea
            rows={4}
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            placeholder="What needs to change before resubmission?"
            className="input"
          />
        </Field>
      </Modal>

      {/* Deny / revoke edit permission */}
      <Modal
        open={Boolean(editReqModal)}
        onClose={() => setEditReqModal(null)}
        title={editReqModal?.action === 'REVOKE' ? 'Revoke edit access' : 'Deny edit request'}
        description={
          editReqModal
            ? `${editReqModal.request.faculty?.fullName} · ${editReqModal.request.syllabus?.subject?.code} ${editReqModal.request.syllabus?.subject?.title}`
            : undefined
        }
        footer={
          <>
            <button type="button" onClick={() => setEditReqModal(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              disabled={!editReqRemarks.trim() || processingId === `edit-req-${editReqModal?.request.id}`}
              onClick={handleConfirmDenyOrRevoke}
              className="btn btn-danger"
            >
              {editReqModal?.action === 'REVOKE' ? 'Revoke' : 'Deny'}
            </button>
          </>
        }
      >
        <Field label="Reason" required>
          <textarea rows={3} value={editReqRemarks} onChange={(e) => setEditReqRemarks(e.target.value)} className="input" />
        </Field>
      </Modal>
    </div>
  );
}
