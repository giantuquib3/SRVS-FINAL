'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  StatusBadge,
  useToast,
} from '@/components/ui';

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

const emptyForm = {
  code: '',
  title: '',
  units: 3,
  lecHours: 3,
  labHours: 0,
  prerequisite: 'None',
  yearLevel: '1st Year',
  semester: '1st Semester',
  departmentId: '',
  description: '',
  professorName: '',
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptFaculty, setDeptFaculty] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const { toast, showToast } = useToast(4000);

  // Create / edit course
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [requestTarget, setRequestTarget] = useState<{
    syllabusId: number;
    code: string;
    title: string;
    currentVersionNumber: number;
  } | null>(null);

  const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (departmentId) params.append('departmentId', departmentId);

      const [sRes, dRes, uRes] = await Promise.all([
        fetch(`/api/subjects?${params.toString()}`).then((r) => r.json()),
        fetch('/api/departments').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);
      setSubjects(sRes.subjects || sRes.courses || []);
      setDepartments(dRes.departments || []);
      if (uRes?.user) {
        setCurrentUser(uRes.user);
        const userDept = uRes.user.departmentId || uRes.user.departmentCode;
        if (userDept) setDepartmentId(String(userDept));
        if (uRes.user.role === 'DepartmentHead' || uRes.user.role === 'Admin') {
          fetch('/api/department-head/faculty')
            .then((r) => (r.ok ? r.json() : null))
            .then((fData) => fData?.faculty && setDeptFaculty(fData.faculty))
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [departmentId]);

  const userDeptCode = currentUser?.departmentCode || currentUser?.departmentId;

  const openCreateModal = () => {
    setEditingSubject(null);
    setForm({ ...emptyForm, departmentId: userDeptCode || departmentId || 'CPE' });
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (s: any) => {
    setEditingSubject(s);
    setForm({
      code: s.code || '',
      title: s.title || '',
      units: s.units ?? 3,
      lecHours: s.lecHours ?? 3,
      labHours: s.labHours ?? 0,
      prerequisite: s.prerequisite || 'None',
      yearLevel: s.yearLevel || '1st Year',
      semester: s.semester || '1st Semester',
      departmentId: s.departmentId || userDeptCode || 'CPE',
      description: s.description || '',
      professorName: s.professorName || '',
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);
    try {
      const res = await fetch('/api/subjects', {
        method: editingSubject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingSubject?.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to save course.');
        return;
      }
      setModalOpen(false);
      showToast(editingSubject ? `${form.code.toUpperCase()} updated.` : `${form.code.toUpperCase()} added.`);
      await fetchSubjects();
    } catch {
      setModalError('Could not connect to the server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (s: any) => {
    if (!confirm(`Delete ${s.code} ${s.title}?`)) return;
    try {
      const res = await fetch(`/api/subjects?id=${s.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(`${s.code} deleted.`);
        await fetchSubjects();
      } else {
        showToast(data.error || 'Failed to delete course.', 'error');
      }
    } catch {
      showToast('Network error while deleting course.', 'error');
    }
  };

  const role = currentUser?.role;
  const canEditCourses = role === 'DepartmentHead' || role === 'Admin';
  const canAuthorSyllabus = role === 'Educator' || role === 'Faculty' || role === 'DepartmentHead';
  const isGlobalViewer = role === 'Registrar' || role === 'VPAcademics';
  const canSwitchDepartments =
    role === 'Admin' || isGlobalViewer || (role === 'Dean' && !currentUser?.departmentCode);

  return (
    <div className="space-y-6">
      {toast}

      <PageHeader
        title="Courses"
        description={
          canSwitchDepartments
            ? 'Courses and their syllabi across all departments.'
            : `Courses and syllabi in ${currentUser?.departmentName || userDeptCode || 'your department'}.`
        }
        actions={
          canEditCourses && (
            <button onClick={openCreateModal} className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Add course
            </button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={setSearch}
          onSubmit={fetchSubjects}
          placeholder="Search by code, title, or faculty"
          className="flex-1"
        />
        {canSwitchDepartments && (
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input sm:w-64" aria-label="Department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : subjects.length === 0 ? (
        <div className="card">
          <EmptyState icon={BookOpen} title="No courses found" description="Try a different search or department." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const syl = subject.syllabi?.[0];
            const canEditSyllabus = role === 'DepartmentHead' || syl?.editPermissionStatus === 'APPROVED';
            return (
              <div key={subject.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="code">{subject.code}</span>
                    <Badge>{subject.units ?? 3} units</Badge>
                    {canSwitchDepartments && (
                      <span className="text-xs text-slate-400">{subject.department?.code || subject.departmentId}</span>
                    )}
                  </div>
                  {canEditCourses && (
                    <div className="-mr-2 -mt-1 flex">
                      <button
                        type="button"
                        onClick={() => openEditModal(subject)}
                        className="btn btn-ghost btn-icon"
                        title="Edit course"
                        aria-label={`Edit ${subject.code}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(subject)}
                        className="btn btn-ghost btn-icon hover:text-rose-600"
                        title="Delete course"
                        aria-label={`Delete ${subject.code}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="mt-2 font-semibold text-slate-900">{subject.title}</h3>
                {subject.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{subject.description}</p>}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <dt className="text-slate-500">Faculty</dt>
                  <dd className="truncate text-right text-slate-800">{subject.professorName || 'Unassigned'}</dd>
                  <dt className="text-slate-500">Hours</dt>
                  <dd className="text-right text-slate-800">
                    {subject.lecHours ?? 3} lec · {subject.labHours ?? 0} lab
                  </dd>
                  <dt className="text-slate-500">Prerequisite</dt>
                  <dd className="truncate text-right text-slate-800">{subject.prerequisite || 'None'}</dd>
                  <dt className="text-slate-500">Year level</dt>
                  <dd className="text-right text-slate-800">{subject.yearLevel || '1st Year'}</dd>
                </dl>

                <div className="flex-1" />
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  {syl ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-500">v{syl.currentVersionNumber}</span>
                      {!isGlobalViewer && <StatusBadge status={syl.status} />}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No syllabus yet</span>
                  )}

                  <div className="flex shrink-0 gap-1.5">
                    {syl ? (
                      <>
                        <Link href={`/syllabi/${syl.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                        {canAuthorSyllabus &&
                          (canEditSyllabus ? (
                            <Link href={`/syllabi/${syl.id}/edit`} className="btn btn-primary btn-sm">
                              Edit
                            </Link>
                          ) : syl.editPermissionStatus === 'PENDING' ? (
                            <Badge tone="amber">Access requested</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setRequestTarget({
                                  syllabusId: syl.id,
                                  code: subject.code,
                                  title: subject.title,
                                  currentVersionNumber: syl.currentVersionNumber || 1,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                            >
                              Request edit
                            </button>
                          ))}
                      </>
                    ) : role === 'DepartmentHead' ? (
                      <Link href={`/syllabi/new?subjectId=${subject.id}`} className="btn btn-primary btn-sm">
                        <Plus className="h-3.5 w-3.5" />
                        Create syllabus
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSubject ? `Edit ${editingSubject.code}` : 'Add course'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" form="course-form" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : editingSubject ? 'Save changes' : 'Add course'}
            </button>
          </>
        }
      >
        <form id="course-form" onSubmit={handleSaveSubject} className="space-y-4">
          {modalError && <Alert tone="error">{modalError}</Alert>}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Course code" required className="col-span-2">
              <input
                type="text"
                required
                disabled={Boolean(editingSubject)}
                value={form.code}
                onChange={(e) => setField('code', e.target.value)}
                placeholder="CPE101"
                className="input font-mono uppercase"
              />
            </Field>
            <Field label="Units">
              <select value={form.units} onChange={(e) => setField('units', Number(e.target.value))} className="input">
                {[1, 2, 3, 4, 5].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Course title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Computer Programming 1"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lecture hours / week">
              <input type="number" min={0} value={form.lecHours} onChange={(e) => setField('lecHours', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Lab hours / week">
              <input type="number" min={0} value={form.labHours} onChange={(e) => setField('labHours', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Year level">
              <select value={form.yearLevel} onChange={(e) => setField('yearLevel', e.target.value)} className="input">
                {YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Semester">
              <select value={form.semester} onChange={(e) => setField('semester', e.target.value)} className="input">
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Prerequisite">
            <input type="text" value={form.prerequisite} onChange={(e) => setField('prerequisite', e.target.value)} className="input" />
          </Field>
          <Field label="Assigned faculty">
            {deptFaculty.length > 0 ? (
              <select value={form.professorName} onChange={(e) => setField('professorName', e.target.value)} className="input">
                <option value="">Unassigned</option>
                {deptFaculty.map((f) => (
                  <option key={f.id} value={f.fullName}>
                    {f.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.professorName}
                onChange={(e) => setField('professorName', e.target.value)}
                placeholder="Faculty name"
                className="input"
              />
            )}
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} className="input" />
          </Field>
        </form>
      </Modal>

      {requestTarget && (
        <RequestEditPermissionModal
          isOpen
          syllabusId={requestTarget.syllabusId}
          subjectCode={requestTarget.code}
          subjectTitle={requestTarget.title}
          currentVersionNumber={requestTarget.currentVersionNumber}
          onClose={() => setRequestTarget(null)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchSubjects();
          }}
        />
      )}
    </div>
  );
}
