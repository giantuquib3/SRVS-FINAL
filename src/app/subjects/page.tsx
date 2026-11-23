'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Trash2,
  FileEdit,
  Eye,
  KeyRound,
  Clock,
} from 'lucide-react';
import { syllabusStatusLabel } from '@/lib/status';
import RequestEditPermissionModal from '@/components/RequestEditPermissionModal';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptFaculty, setDeptFaculty] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // Create / Edit Course Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formUnits, setFormUnits] = useState<number>(3);
  const [formLecHours, setFormLecHours] = useState<number>(3);
  const [formLabHours, setFormLabHours] = useState<number>(0);
  const [formPrerequisite, setFormPrerequisite] = useState('None');
  const [formYearLevel, setFormYearLevel] = useState('1st Year');
  const [formSemester, setFormSemester] = useState('1st Semester');
  const [formDeptId, setFormDeptId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProfessorName, setFormProfessorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [requestTarget, setRequestTarget] = useState<{
    syllabusId: number;
    code: string;
    title: string;
    currentVersionNumber: number;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        if (userDept) {
          setDepartmentId(String(userDept));
          setFormDeptId(String(userDept));
        }
        if (uRes.user.role === 'DepartmentHead' || uRes.user.role === 'Admin') {
          fetch('/api/department-head/faculty')
            .then((r) => (r.ok ? r.json() : null))
            .then((fData) => {
              if (fData?.faculty) setDeptFaculty(fData.faculty);
            })
            .catch(() => { });
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSubjects();
  };

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormCode('');
    setFormTitle('');
    setFormUnits(3);
    setFormLecHours(3);
    setFormLabHours(0);
    setFormPrerequisite('None');
    setFormYearLevel('1st Year');
    setFormSemester('1st Semester');
    setFormDeptId(currentUser?.departmentCode || currentUser?.departmentId || departmentId || 'CPE');
    setFormDescription('');
    setFormProfessorName('');
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (subject: any) => {
    setEditingSubject(subject);
    setFormCode(subject.code || '');
    setFormTitle(subject.title || '');
    setFormUnits(subject.units ?? 3);
    setFormLecHours(subject.lecHours ?? 3);
    setFormLabHours(subject.labHours ?? 0);
    setFormPrerequisite(subject.prerequisite || 'None');
    setFormYearLevel(subject.yearLevel || '1st Year');
    setFormSemester(subject.semester || '1st Semester');
    setFormDeptId(subject.departmentId || currentUser?.departmentCode || 'CPE');
    setFormDescription(subject.description || '');
    setFormProfessorName(subject.professorName || '');
    setModalError('');
    setModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);

    try {
      const method = editingSubject ? 'PUT' : 'POST';
      const payload: any = {
        id: editingSubject?.id,
        code: formCode,
        title: formTitle,
        units: formUnits,
        lecHours: formLecHours,
        labHours: formLabHours,
        prerequisite: formPrerequisite,
        yearLevel: formYearLevel,
        semester: formSemester,
        departmentId: formDeptId,
        description: formDescription,
        professorName: formProfessorName,
      };

      const res = await fetch('/api/subjects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to save course.');
        setSaving(false);
        return;
      }

      setModalOpen(false);
      showToast(
        editingSubject
          ? `Course [${formCode.toUpperCase()}] updated successfully.`
          : `Course [${formCode.toUpperCase()}] added to curriculum.`
      );
      await fetchSubjects();
    } catch {
      setModalError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subject: any) => {
    if (!confirm(`Are you sure you want to delete course [${subject.code}] ${subject.title}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/subjects?id=${subject.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Course [${subject.code}] deleted.`);
        await fetchSubjects();
      } else {
        showToast(data.error || 'Failed to delete course.', 'error');
      }
    } catch {
      showToast('Network error while deleting course.', 'error');
    }
  };

  // Department Head (and Admin) have full right to create, edit, and delete courses in their department
  const canEditCourses = currentUser?.role === 'DepartmentHead' || currentUser?.role === 'Admin';
  // Faculty and Department Head can create/edit syllabi
  const canAuthorSyllabus =
    currentUser?.role === 'Educator' ||
    currentUser?.role === 'Faculty' ||
    currentUser?.role === 'DepartmentHead';
  const canSwitchDepartments =
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Registrar' ||
    currentUser?.role === 'VPAcademics' ||
    (currentUser?.role === 'Dean' && !currentUser?.departmentCode);

  return (
    <div className="space-y-8">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-2 text-xs font-semibold ${toast.type === 'success'
            ? 'bg-emerald-900 text-white border-emerald-700'
            : 'bg-rose-900 text-white border-rose-700'
            }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Academic Curriculum Catalog
            </span>
            {currentUser?.departmentCode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200 shadow-sm">
                Department: [{currentUser.departmentCode}] {currentUser.departmentName || currentUser.departmentCode}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Department Courses & Syllabi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {canEditCourses
              ? 'Manage and edit courses under your department, assign faculty instructors, and oversee syllabus status.'
              : canAuthorSyllabus
                ? 'View courses and electronic syllabi under your department, and request Department Head permission to edit.'
                : 'Browse academic courses and view official course syllabi.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {canEditCourses && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Department Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by code, title, or assigned faculty..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
          />
        </form>

        {!canSwitchDepartments ? (
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-nowrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Designated Dept:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#005A36] font-mono font-extrabold text-[11px]">
              [{currentUser?.departmentCode || '...'}]
            </span>
            <span className="font-bold text-slate-800 hidden sm:inline">
              {currentUser?.departmentName || `${currentUser?.departmentCode || 'Assigned'} Department`}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full sm:w-56 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.code}] {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
            <p className="text-slate-500 text-xs font-semibold">Loading courses catalog...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && subjects.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No Courses Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No courses matched your filter criteria.
          </p>
        </div>
      )}

      {/* Courses Grid */}
      {!loading && subjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => {
            const activeSyllabus = subject.syllabi?.[0];
            return (
              <div
                key={subject.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#005A36] transition-all hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#005A36] font-extrabold text-sm">
                        {subject.code}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                        {subject.units ?? 3} Units
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-600 font-bold">
                        [{subject.department?.code || subject.departmentId}]
                      </span>
                      {canEditCourses && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(subject)}
                            title="Edit Course Details & Assigned Faculty"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#005A36] hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(subject)}
                            title="Delete Course"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{subject.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {subject.description || 'Standard departmental curriculum course.'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-slate-600">
                    <span className="font-semibold">
                      Lec: {subject.lecHours ?? 3}h • Lab: {subject.labHours ?? 0}h
                    </span>
                    <span className="text-slate-500">
                      Prereq: <strong className="text-slate-700">{subject.prerequisite || 'None'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Assigned Faculty:{' '}
                      <strong className="text-slate-800">{subject.professorName || 'Unassigned'}</strong>
                    </span>
                    <span className="text-slate-400 font-semibold">{subject.yearLevel || '1st Year'}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div>
                    {activeSyllabus ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[#005A36] font-bold flex items-center space-x-1">
                          <History className="w-3.5 h-3.5" />
                          <span>v{activeSyllabus.currentVersionNumber}</span>
                        </span>
                        {currentUser?.role !== 'Registrar' && currentUser?.role !== 'VPAcademics' ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeSyllabus.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : activeSyllabus.status === 'UNDER_REVIEW'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : activeSyllabus.status === 'SUBMITTED'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                          >
                            {syllabusStatusLabel(activeSyllabus.status)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
                            File Uploaded
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px] font-medium">
                        No syllabus file uploaded
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {activeSyllabus ? (
                      <>
                        <Link
                          href={`/syllabi/${activeSyllabus.id}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px]"
                        >
                          <Eye className="w-3 h-3 text-[#005A36]" />
                          <span>View</span>
                        </Link>
                        {canAuthorSyllabus &&
                          (currentUser?.role === 'DepartmentHead' || activeSyllabus.editPermissionStatus === 'APPROVED' ? (
                            <Link
                              href={`/syllabi/${activeSyllabus.id}/edit`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#005A36] hover:bg-[#004529] text-white font-bold text-[11px]"
                            >
                              <FileEdit className="w-3 h-3 text-[#FEF08A]" />
                              <span>Edit Syllabus</span>
                            </Link>
                          ) : activeSyllabus.editPermissionStatus === 'PENDING' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                              <Clock className="w-3 h-3" />
                              <span>Permission Pending</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setRequestTarget({
                                  syllabusId: activeSyllabus.id,
                                  code: subject.code,
                                  title: subject.title,
                                  currentVersionNumber: activeSyllabus.currentVersionNumber || 1,
                                })
                              }
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] font-bold text-[11px] cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3 text-[#CA8A04]" />
                              <span>Request Edit</span>
                            </button>
                          ))}
                      </>
                    ) : currentUser?.role === 'DepartmentHead' ? (
                      <Link
                        href={`/syllabi/new?subjectId=${subject.id}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#005A36] hover:bg-[#004529] text-white font-bold text-[11px]"
                      >
                        <Plus className="w-3 h-3 text-[#FEF08A]" />
                        <span>Create Syllabus</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Course Modal (Department Head & Admin) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl border border-slate-200 shadow-xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-base text-[#005A36]">
                {editingSubject ? `Edit Course: [${editingSubject.code}]` : 'Add New Department Course'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingSubject)}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. CPE101"
                    className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 uppercase font-mono focus:outline-none focus:border-[#005A36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Units</label>
                  <select
                    value={formUnits}
                    onChange={(e) => setFormUnits(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-[#005A36]"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Computer Programming 1"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lec Hours/Week</label>
                  <input
                    type="number"
                    min={0}
                    value={formLecHours}
                    onChange={(e) => setFormLecHours(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lab Hours/Week</label>
                  <input
                    type="number"
                    min={0}
                    value={formLabHours}
                    onChange={(e) => setFormLabHours(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Year Level</label>
                  <select
                    value={formYearLevel}
                    onChange={(e) => setFormYearLevel(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Semester</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prerequisite</label>
                <input
                  type="text"
                  value={formPrerequisite}
                  onChange={(e) => setFormPrerequisite(e.target.value)}
                  placeholder="None or prerequisite course code"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Faculty Member</label>
                {deptFaculty.length > 0 ? (
                  <select
                    value={formProfessorName}
                    onChange={(e) => setFormProfessorName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  >
                    <option value="">-- Select Department Faculty --</option>
                    {deptFaculty.map((fac) => (
                      <option key={fac.id} value={fac.fullName}>
                        {fac.fullName} ({fac.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formProfessorName}
                    onChange={(e) => setFormProfessorName(e.target.value)}
                    placeholder="Faculty name"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Course scope and description..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm cursor-pointer"
                >
                  {saving ? 'Saving...' : editingSubject ? 'Save Changes' : 'Add Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {requestTarget && (
        <RequestEditPermissionModal
          isOpen={Boolean(requestTarget)}
          syllabusId={requestTarget.syllabusId}
          subjectCode={requestTarget.code}
          subjectTitle={requestTarget.title}
          currentVersionNumber={requestTarget.currentVersionNumber}
          onClose={() => setRequestTarget(null)}
          onSuccess={(msg) => {
            showToast(msg, 'success');
            fetchSubjects();
          }}
        />
      )}
    </div>
  );
}
