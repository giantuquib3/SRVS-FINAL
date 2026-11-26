'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  DeptTag,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  formatDate,
  type BadgeTone,
} from '@/components/ui';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  ENROLLED: { label: 'Enrolled', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  COMPLETED: { label: 'Completed', tone: 'blue' },
  DROPPED: { label: 'Dropped', tone: 'gray' },
};

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Enroll modal
  const [modalOpen, setModalOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [status, setStatus] = useState('ENROLLED');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const [eRes, sRes, subjRes, meRes] = await Promise.all([
        fetch('/api/enrollments?status=ALL').then((r) => r.json()),
        fetch('/api/students').then((r) => r.json()),
        fetch('/api/subjects').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);
      setEnrollments(eRes.enrollments || []);
      setStudents(sRes.students || []);
      setSubjects(subjRes.subjects || subjRes.courses || []);
      if (meRes?.user) setCurrentUser(meRes.user);
    } catch (err) {
      console.error('Error loading enrollments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const handleStatusChange = async (en: any, newStatus: string) => {
    if (newStatus === en.status) return;
    setUpdatingId(en.id);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: en.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Failed to update enrollment status.');
      else setEnrollments((prev) => prev.map((row) => (row.id === en.id ? data.enrollment : row)));
    } catch {
      alert('Network error updating enrollment status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnenroll = async (en: any) => {
    const studentName = en.student?.fullName || en.studentName || en.studentId;
    const subjCode = en.subject?.code || en.course?.code;
    if (!confirm(`Unenroll ${studentName} from ${subjCode}?`)) return;
    try {
      const res = await fetch(`/api/enrollments?id=${en.id}`, { method: 'DELETE' });
      if (res.ok) await fetchEnrollments();
      else alert((await res.json()).error || 'Failed to unenroll student.');
    } catch {
      alert('Network error unenrolling student.');
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, subjectId, semester, academicYear, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to create enrollment.');
        return;
      }
      setModalOpen(false);
      setStudentId('');
      setSubjectId('');
      await fetchEnrollments();
    } catch {
      setModalError('Could not connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'DepartmentHead';
  const visible = statusFilter === 'ALL' ? enrollments : enrollments.filter((en) => en.status === statusFilter);
  const pendingCount = enrollments.filter((en) => en.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollments"
        description="Students enrolled in each course. Only enrolled students can view a course’s approved syllabus."
        actions={
          canManage && (
            <button onClick={() => setModalOpen(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Enroll student
            </button>
          )
        }
      />

      {canManage && pendingCount > 0 && statusFilter !== 'PENDING' && (
        <Alert
          tone="warning"
          title={`${pendingCount} enrollment request${pendingCount === 1 ? '' : 's'} awaiting approval`}
          action={
            <button onClick={() => setStatusFilter('PENDING')} className="btn btn-secondary btn-sm">
              Show
            </button>
          }
        />
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <p className="text-sm text-slate-500">
            {visible.length} of {enrollments.length} records
          </p>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-44" aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <LoadingState />
        ) : visible.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No enrollments" description={canManage ? 'Enroll a student to get started.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Syllabus</th>
                  {canManage && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((en) => {
                  const subj = en.subject || en.course;
                  const syllabus = subj?.activeSyllabus || subj?.syllabi?.[0];
                  const st = STATUS[en.status] || { label: en.status, tone: 'gray' as BadgeTone };
                  return (
                    <tr key={en.id}>
                      <td>
                        <p className="font-medium text-slate-900">{en.student?.fullName || en.studentName}</p>
                        <p className="text-xs text-slate-500">{en.student?.email || `ID ${en.studentId}`}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="code">{subj?.code}</span>
                          <DeptTag code={subj?.department?.code} />
                        </div>
                        <p className="text-slate-900">{subj?.title}</p>
                      </td>
                      <td className="whitespace-nowrap text-slate-600">
                        {en.semester}
                        <p className="text-xs text-slate-500">AY {en.academicYear}</p>
                      </td>
                      <td>
                        {canManage ? (
                          <select
                            value={en.status}
                            disabled={updatingId === en.id}
                            onChange={(e) => handleStatusChange(en, e.target.value)}
                            aria-label={`Status for ${en.student?.fullName || en.studentName}`}
                            className="input h-8 w-32 py-1 text-xs"
                          >
                            {Object.entries(STATUS).map(([id, s]) => (
                              <option key={id} value={id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={st.tone}>{st.label}</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">
                        {formatDate(en.createdAt)}
                        {en.enrolledBy?.fullName && <p className="text-xs">by {en.enrolledBy.fullName}</p>}
                      </td>
                      <td>
                        {syllabus ? (
                          <Link href={`/syllabi/${syllabus.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                            v{syllabus.currentVersionNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">None yet</span>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {en.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(en, 'REJECTED')}
                                  disabled={updatingId === en.id}
                                  className="btn btn-danger-outline btn-sm"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleStatusChange(en, 'ENROLLED')}
                                  disabled={updatingId === en.id}
                                  className="btn btn-primary btn-sm"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleUnenroll(en)}
                              className="btn btn-ghost btn-icon text-slate-400 hover:text-rose-600"
                              title="Unenroll"
                              aria-label="Unenroll"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Enroll student"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" form="enroll-form" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Enrolling…' : 'Enroll'}
            </button>
          </>
        }
      >
        <form id="enroll-form" onSubmit={handleEnrollStudent} className="space-y-4">
          {modalError && <Alert tone="error">{modalError}</Alert>}
          <Field label="Student" required>
            <select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input">
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email}){s.departmentCode || s.department ? ` · ${s.departmentCode || s.department}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course" required>
            <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input">
              <option value="">Select a course</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.title} ({s.departmentId || s.department?.code})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Semester">
              <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input">
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="Summer">Summer</option>
              </select>
            </Field>
            <Field label="Academic year" required>
              <input
                type="text"
                required
                pattern="\d{4}-\d{4}"
                title="Format: YYYY-YYYY, e.g. 2026-2027"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="ENROLLED">Enrolled</option>
                <option value="COMPLETED">Completed</option>
                <option value="DROPPED">Dropped</option>
              </select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
