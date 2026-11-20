'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileEdit,
  History,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RefreshCw,
  GitCompare,
  KeyRound,
  Lock,
} from 'lucide-react';
import { isPendingReview, syllabusStatusLabel, formatShortVersionLabel } from '@/lib/status';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';

export default function EducatorDashboard() {
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  // Edit Permission Request Modal State
  const [requestTarget, setRequestTarget] = useState<{
    syllabusId: number;
    code: string;
    title: string;
    currentVersionNumber: number;
  } | null>(null);

  const fetchEducatorData = async () => {
    setLoading(true);
    try {
      const [meRes, statsRes, syllabiRes, coursesRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/dashboard/stats'),
        fetch('/api/syllabi?status=ALL'),
        fetch('/api/subjects'),
      ]);

      const meData = meRes.ok ? await meRes.json() : null;
      const statsData = await statsRes.json();
      const syllabiData = await syllabiRes.json();
      const coursesData = await coursesRes.json();

      const loggedUser = meData?.user || null;
      setCurrentUser(loggedUser);
      setData(statsData);

      // Sort assigned syllabi + granted-permission syllabi to top, then by subject code
      const allDeptSyllabi: any[] = syllabiData.syllabi || [];
      const uid = Number(loggedUser?.id || 0);
      const uName = (loggedUser?.fullName || '').trim().toLowerCase();
      allDeptSyllabi.sort((a, b) => {
        const aGranted = a.editPermissionStatus === 'APPROVED' ? 1 : 0;
        const bGranted = b.editPermissionStatus === 'APPROVED' ? 1 : 0;
        if (aGranted !== bGranted) return bGranted - aGranted;

        const aMine =
          a.instructorId === uid ||
          (uName && (a.subject?.professorName || '').trim().toLowerCase() === uName);
        const bMine =
          b.instructorId === uid ||
          (uName && (b.subject?.professorName || '').trim().toLowerCase() === uName);
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return String(a.course?.code || '').localeCompare(String(b.course?.code || ''));
      });

      setSyllabi(allDeptSyllabi);
      setCourses(coursesData.subjects || coursesData.courses || []);
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
      const res = await fetch(`/api/syllabi/${syllabusId}/versions/${versionNumber}/submit`, {
        method: 'POST',
      });
      const resData = await res.json();
      if (res.ok) {
        setActionMessage(resData.message || 'Draft syllabus submitted to your Department Head for approval.');
        await fetchEducatorData();
      } else {
        alert(resData.error || 'Failed to submit syllabus version.');
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmittingId(null);
    }
  };

  const stats = data?.stats || {};

  const filteredSyllabi = syllabi.filter((s) => {
    if (statusFilter === 'ALL') return true;
    const latestStatus = s.latestVersion?.approvalStatus || s.status;
    if (statusFilter === 'GRANTED') return s.editPermissionStatus === 'APPROVED';
    if (statusFilter === 'PERM_PENDING') return s.editPermissionStatus === 'PENDING';
    if (statusFilter === 'SUBMITTED') return Boolean(s.pendingVersion) || isPendingReview(latestStatus);
    if (statusFilter === 'REJECTED') return Boolean(s.latestRejectedVersion) || latestStatus === 'REJECTED';
    if (statusFilter === 'APPROVED') return Boolean(s.approvedVersion) || s.status === 'APPROVED';
    return s.status === statusFilter;
  });

  const renderPermissionBadge = (permStatus: string, permReq: any) => {
    if (permStatus === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Edit Access Granted</span>
        </span>
      );
    }
    if (permStatus === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Edit Permission Pending</span>
        </span>
      );
    }
    if (permStatus === 'REJECTED') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Edit Request Denied</span>
          </span>
          {permReq?.reviewRemarks && (
            <p className="text-[10px] text-rose-600 line-clamp-1 italic">&ldquo;{permReq.reviewRemarks}&rdquo;</p>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <Lock className="w-3 h-3 text-slate-400" />
        <span>Request Needed to Edit</span>
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Faculty Electronic Workspace
            </span>
            {data?.department?.code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
                Department: [{data.department.code}] {data.department.name || data.department.code}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Faculty Electronic Syllabus Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View electronic syllabi under your department, request Department Head edit permission, and submit revisions for approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchEducatorData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/subjects"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4 text-[#005A36]" />
            <span>Department Subjects</span>
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#005A36] shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Status Breakdown Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'ALL'
              ? 'border-[#005A36] bg-emerald-50/50 ring-2 ring-[#005A36]/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dept. Syllabi</span>
          <p className="text-2xl font-black text-[#005A36] mt-1">{syllabi.length}</p>
        </button>

        <button
          onClick={() => setStatusFilter('GRANTED')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'GRANTED'
              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Edit Access Granted</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {stats.grantedEditPermissions ?? syllabi.filter((s) => s.editPermissionStatus === 'APPROVED').length}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('PERM_PENDING')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'PERM_PENDING'
              ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Permission Pending</span>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {stats.pendingEditRequests ?? syllabi.filter((s) => s.editPermissionStatus === 'PENDING').length}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('SUBMITTED')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'SUBMITTED'
              ? 'border-sky-600 bg-sky-50/60 ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Revisions Pending</span>
          <p className="text-2xl font-black text-sky-700 mt-1">{stats.submittedCount ?? 0}</p>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'REJECTED'
              ? 'border-rose-600 bg-rose-50/60 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Returned Revisions</span>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.rejectedCount ?? 0}</p>
        </button>
      </div>

      {/* Department Electronic Syllabi & Permission Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#005A36]" />
              <span>Department Electronic Syllabi ({filteredSyllabi.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              View any department syllabus electronically or request Department Head permission to edit.
            </p>
          </div>
        </div>

        {filteredSyllabi.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No syllabi match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Effective Official Version</th>
                  <th className="py-2.5 px-3">Edit Permission</th>
                  <th className="py-2.5 px-3">Latest Revision Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSyllabi.map((s) => {
                  const latest = s.latestVersion;
                  const approved = s.approvedVersion;
                  const pending = s.pendingVersion;
                  const rejected = latest?.approvalStatus === 'REJECTED' ? latest : null;
                  const isDraftLatest = latest?.approvalStatus === 'DRAFT';
                  const permStatus = s.editPermissionStatus || 'NONE';
                  const hasEditAccess = permStatus === 'APPROVED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-[#005A36] text-sm">{s.course.code}</span>
                          {currentUser &&
                            (s.instructorId === Number(currentUser.id) ||
                              (s.subject?.professorName || '').trim().toLowerCase() ===
                                (currentUser.fullName || '').trim().toLowerCase()) && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FEF08A] text-[#854D0E] text-[9px] font-extrabold uppercase">
                                Assigned
                              </span>
                            )}
                        </div>
                        <div className="font-semibold text-slate-800">{s.course.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {s.semester}, AY {s.academicYear} • {s.totalVersions || 1} history record(s)
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        {approved ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Version {approved.versionNumber}</span>
                            </span>
                            {approved.reviewedBy?.fullName && (
                              <div className="text-[10px] text-slate-500">
                                Approved by {approved.reviewedBy.fullName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not yet approved</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        {renderPermissionBadge(permStatus, s.editPermissionRequest)}
                      </td>

                      <td className="py-3.5 px-3 align-top space-y-1 max-w-xs">
                        {latest && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-700">
                              {formatShortVersionLabel(latest)}:
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                latest.approvalStatus === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isPendingReview(latest.approvalStatus)
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : latest.approvalStatus === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isPendingReview(latest.approvalStatus) && <Clock className="w-3 h-3" />}
                              {latest.approvalStatus === 'REJECTED' && <XCircle className="w-3 h-3" />}
                              <span>{syllabusStatusLabel(latest.approvalStatus)}</span>
                            </span>
                          </div>
                        )}
                        {latest?.changeSummary && (
                          <p className="text-[11px] text-slate-600 line-clamp-1">{latest.changeSummary}</p>
                        )}
                        {rejected?.rejectionReason && (
                          <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 italic">
                            Feedback: &ldquo;{rejected.rejectionReason}&rdquo;
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Link
                            href={`/syllabi/${s.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800"
                          >
                            <Eye className="w-3 h-3 text-[#005A36]" />
                            <span>View</span>
                          </Link>

                          {hasEditAccess ? (
                            <Link
                              href={`/syllabi/${s.id}/edit${rejected ? `?fromVersion=${rejected.versionNumber}` : ''}`}
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                rejected
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                  : 'bg-[#005A36] hover:bg-[#004529] text-white'
                              }`}
                            >
                              <FileEdit className="w-3 h-3 text-[#FEF08A]" />
                              <span>{rejected ? 'Revise & Resubmit' : 'Edit Syllabus'}</span>
                            </Link>
                          ) : permStatus === 'PENDING' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Awaiting Approval</span>
                            </span>
                          ) : (
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
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30 cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Request Edit</span>
                            </button>
                          )}

                          {isDraftLatest && hasEditAccess && (
                            <button
                              type="button"
                              disabled={submittingId === s.id}
                              onClick={() => handleSubmitDraftVersion(s.id, latest.versionNumber)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer"
                            >
                              <Send className="w-3 h-3 text-[#FEF08A]" />
                              <span>{submittingId === s.id ? '...' : 'Submit Draft'}</span>
                            </button>
                          )}

                          <Link
                            href={`/syllabi/${s.id}/versions${
                              approved && pending
                                ? `?compareA=${approved.versionNumber}&compareB=${pending.versionNumber}`
                                : ''
                            }`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300"
                          >
                            <GitCompare className="w-3 h-3 text-[#005A36]" />
                            <span>History</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Department Subjects Quick Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#005A36]" />
              <span>Subjects Under My Department ({courses.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Every subject has an electronic syllabus available for viewing directly in SRVS.
            </p>
          </div>
          <Link href="/subjects" className="text-xs font-bold text-[#005A36] hover:underline">
            View Full Catalog →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const activeSyllabus = course.syllabi?.[0];
            const permStatus = activeSyllabus?.editPermissionStatus || 'NONE';
            return (
              <div
                key={course.id}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#005A36] font-mono font-extrabold text-xs">
                      {course.code}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{course.units ?? 3} Units</span>
                  </div>
                  <p className="font-bold text-sm text-slate-900 mt-1.5">{course.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assigned: <strong className="text-slate-700">{course.professorName || 'Department Faculty'}</strong>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs gap-2">
                  {activeSyllabus ? (
                    <>
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <History className="w-3 h-3 text-[#005A36]" />
                        Version {activeSyllabus.currentVersionNumber}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <Link
                          href={`/syllabi/${activeSyllabus.id}`}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-[11px]"
                        >
                          View
                        </Link>
                        {permStatus === 'APPROVED' ? (
                          <Link
                            href={`/syllabi/${activeSyllabus.id}/edit`}
                            className="px-2.5 py-1 rounded-lg bg-[#005A36] text-white font-bold text-[11px]"
                          >
                            Edit
                          </Link>
                        ) : permStatus === 'PENDING' ? (
                          <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                            Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setRequestTarget({
                                syllabusId: activeSyllabus.id,
                                code: course.code,
                                title: course.title,
                                currentVersionNumber: activeSyllabus.currentVersionNumber || 1,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#FEF9C3] text-[#854D0E] font-bold text-[11px] cursor-pointer"
                          >
                            Request Edit
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Initializing syllabus...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Request Edit Permission Modal */}
      {requestTarget && (
        <RequestEditPermissionModal
          isOpen={Boolean(requestTarget)}
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
