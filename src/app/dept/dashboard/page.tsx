'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  BookOpen,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  GitCompare,
  RefreshCw,
  Eye,
  History,
  Plus,
  UserCheck,
  UserX,
  UserPlus,
  Briefcase,
  X,
  CheckCircle2,
  Search,
  Edit3,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { syllabusStatusLabel } from '@/lib/status';

export default function DeptHeadAndDeanDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'syllabi' | 'courses' | 'faculty' | 'registrations'
  const [activeTab, setActiveTab] = useState<'syllabi' | 'courses' | 'faculty' | 'registrations'>('syllabi');
  const [syllabusStatusFilter, setSyllabusStatusFilter] = useState<string>('ACTION_REQUIRED');

  // Faculty & Pending Faculty Registrations State
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | string | null>(null);

  // Create Faculty Modal
  const [createFacultyModal, setCreateFacultyModal] = useState(false);
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyRank, setNewFacultyRank] = useState('Full-Time');
  const [newFacultyPassword, setNewFacultyPassword] = useState('USJR@Faculty2026');

  // Add / Edit Course Modal (Department Head)
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseUnits, setCourseUnits] = useState<number>(3);
  const [courseLecHours, setCourseLecHours] = useState<number>(3);
  const [courseLabHours, setCourseLabHours] = useState<number>(0);
  const [coursePrereq, setCoursePrereq] = useState('None');
  const [courseYearLevel, setCourseYearLevel] = useState('1st Year');
  const [courseSemester, setCourseSemester] = useState('1st Semester');
  const [courseProfessor, setCourseProfessor] = useState('');
  const [courseDescription, setCourseDescription] = useState('');

  // Reject Syllabus Modal
  const [rejectingSyllabus, setRejectingSyllabus] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [meRes, statsRes, coursesRes, syllabiRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/dashboard/stats').then((r) => r.json()),
        fetch('/api/subjects').then((r) => r.json()),
        fetch('/api/syllabi?status=ALL').then((r) => r.json()),
      ]);

      if (meRes?.user) setCurrentUser(meRes.user);
      setData(statsRes);
      setCourses(coursesRes.subjects || coursesRes.courses || []);
      setSyllabi(syllabiRes.syllabi || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacultyAndRegistrations = async () => {
    setUsersLoading(true);
    try {
      const [facRes, regRes] = await Promise.all([
        fetch('/api/department-head/faculty'),
        fetch('/api/department-head/pending-users?format=detailed'),
      ]);
      if (facRes.ok) {
        const facData = await facRes.json();
        setFacultyList(facData.faculty || []);
      }
      if (regRes.ok) {
        const regData = await regRes.json();
        const list = Array.isArray(regData) ? regData : regData.pendingUsers || [];
        setRegistrations(list);
      }
    } catch (err) {
      console.error('Error fetching department faculty:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchFacultyAndRegistrations();
  }, []);

  const isDean = currentUser?.role === 'Dean' || data?.role === 'Dean';
  const isDeptHead = currentUser?.role === 'DepartmentHead' || data?.role === 'DepartmentHead';
  const currentDept = data?.department;
  const stats = data?.stats || {};

  // Syllabus Approval / Rejection Handler
  const handleSyllabusDecision = async (syllabusId: number, action: 'Approve' | 'Reject', remarks?: string) => {
    setProcessingId(syllabusId);
    try {
      const res = await fetch(`/api/syllabi/${syllabusId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || `Syllabus ${action.toLowerCase()}d successfully.`);
        setRejectingSyllabus(null);
        setRejectRemarks('');
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to process syllabus review.', 'error');
      }
    } catch {
      showToast('Network error while reviewing syllabus.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Course Create / Edit Handlers (Department Head only)
  const openAddCourseModal = () => {
    setEditingCourse(null);
    setCourseCode('');
    setCourseTitle('');
    setCourseUnits(3);
    setCourseLecHours(3);
    setCourseLabHours(0);
    setCoursePrereq('None');
    setCourseYearLevel('1st Year');
    setCourseSemester('1st Semester');
    setCourseProfessor('');
    setCourseDescription('');
    setCourseModalOpen(true);
  };

  const openEditCourseModal = (course: any) => {
    setEditingCourse(course);
    setCourseCode(course.code || '');
    setCourseTitle(course.title || '');
    setCourseUnits(course.units ?? 3);
    setCourseLecHours(course.lecHours ?? 3);
    setCourseLabHours(course.labHours ?? 0);
    setCoursePrereq(course.prerequisite || 'None');
    setCourseYearLevel(course.yearLevel || '1st Year');
    setCourseSemester(course.semester || '1st Semester');
    setCourseProfessor(course.professorName || '');
    setCourseDescription(course.description || '');
    setCourseModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const method = editingCourse ? 'PUT' : 'POST';
      const res = await fetch('/api/subjects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCourse?.id,
          code: courseCode,
          title: courseTitle,
          units: courseUnits,
          lecHours: courseLecHours,
          labHours: courseLabHours,
          prerequisite: coursePrereq,
          yearLevel: courseYearLevel,
          semester: courseSemester,
          professorName: courseProfessor,
          description: courseDescription,
          departmentId: currentDept?.code,
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(
          editingCourse
            ? `Course [${courseCode.toUpperCase()}] updated successfully.`
            : `Course [${courseCode.toUpperCase()}] created successfully.`
        );
        setCourseModalOpen(false);
        await fetchAllData();
        await fetchFacultyAndRegistrations();
      } else {
        showToast(resData.error || 'Failed to save course.', 'error');
      }
    } catch {
      showToast('Network error while saving course.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteCourse = async (course: any) => {
    if (!confirm(`Are you sure you want to delete course [${course.code}] ${course.title}?`)) return;
    try {
      const res = await fetch(`/api/subjects?id=${course.id}`, { method: 'DELETE' });
      const resData = await res.json();
      if (res.ok) {
        showToast(`Course [${course.code}] deleted.`);
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to delete course.', 'error');
      }
    } catch {
      showToast('Network error while deleting course.', 'error');
    }
  };

  // Faculty Management Handlers (Department Head only)
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/department-head/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idNumber: newFacultyId.trim(),
          fullName: newFacultyName.trim(),
          email: newFacultyEmail.trim().toLowerCase(),
          academicRank: newFacultyRank,
          password: newFacultyPassword,
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(`Faculty member ${resData.user?.fullName} created.`);
        setCreateFacultyModal(false);
        setNewFacultyId('');
        setNewFacultyName('');
        setNewFacultyEmail('');
        fetchFacultyAndRegistrations();
        fetchAllData();
      } else {
        showToast(resData.error || 'Failed to create faculty.', 'error');
      }
    } catch {
      showToast('Network error while creating faculty.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleFacultyStatus = async (faculty: any) => {
    const nextStatus = faculty.accountStatus === 'Active' ? 'Deactivated' : 'Active';
    try {
      const res = await fetch(`/api/department-head/faculty/${faculty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: nextStatus }),
      });
      if (res.ok) {
        showToast(`Faculty ${faculty.fullName} is now ${nextStatus}.`);
        fetchFacultyAndRegistrations();
      }
    } catch {
      showToast('Failed to update faculty status.', 'error');
    }
  };

  const handleApproveFacultyRegistration = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/department-head/users/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('Faculty registration approved.');
        fetchFacultyAndRegistrations();
        fetchAllData();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectFacultyRegistration = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/department-head/users/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Registration declined by Department Head.' }),
      });
      if (res.ok) {
        showToast('Faculty registration rejected.');
        fetchFacultyAndRegistrations();
        fetchAllData();
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Filter syllabi based on role & selected filter
  // For Dept Head: ACTION_REQUIRED = 'SUBMITTED' (from Faculty)
  // For Dean: ACTION_REQUIRED = 'UNDER_REVIEW' (approved by Dept Head)
  const actionRequiredStatus = isDean ? 'UNDER_REVIEW' : 'SUBMITTED';
  const actionRequiredSyllabi = syllabi.filter((s) => s.status === actionRequiredStatus);

  const filteredSyllabi = syllabi.filter((s) => {
    if (syllabusStatusFilter === 'ACTION_REQUIRED') return s.status === actionRequiredStatus;
    if (syllabusStatusFilter === 'ALL') return true;
    return s.status === syllabusStatusFilter;
  });

  const filteredFaculty = facultyList.filter((f) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      f.fullName?.toLowerCase().includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      String(f.id).includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-2 text-xs font-semibold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              {isDean ? 'College Dean Portal' : 'Department Head Portal'}
            </span>
            {currentDept?.code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
                Designated Department: [{currentDept.code}] {currentDept.name || currentDept.code}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            {isDean ? 'Dean Departmental Syllabus Portal' : 'Department Head Dashboard'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {isDean
              ? `View all syllabi and courses under [${currentDept?.code || 'your department'}] and approve syllabi endorsed by the Department Head.`
              : `Approve syllabi submitted by [${currentDept?.code || 'department'}] Faculty and manage all courses under your department.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              fetchAllData();
              fetchFacultyAndRegistrations();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/department/syllabus-approvals"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Clock className="w-4 h-4" />
            <span>
              {isDean ? 'Dean Approval Queue' : 'Faculty Approval Queue'}{' '}
              {actionRequiredSyllabi.length > 0 ? `(${actionRequiredSyllabi.length})` : ''}
            </span>
          </Link>

          {isDeptHead && (
            <>
              <button
                onClick={() => {
                  setActiveTab('courses');
                  openAddCourseModal();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FEF08A]" />
                <span>Add Course</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('faculty');
                  setCreateFacultyModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-[#005A36] border border-[#005A36] shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#005A36]" />
                <span>Add Faculty</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Role Workflow Banner */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start space-x-3 text-xs text-emerald-950">
        <ShieldCheck className="w-4 h-4 text-[#005A36] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-[#005A36]">
            {isDean
              ? `Dean Authority — Designated Department [${currentDept?.code}]`
              : `Department Head Authority — Designated Department [${currentDept?.code}]`}
          </p>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            {isDean
              ? 'Approval Workflow: Faculty submits syllabus → Department Head reviews & endorses → Dean grants final approval.'
              : 'Approval Workflow: Faculty submits syllabus → Department Head approves (forwards to Dean) & manages all department courses.'}
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setActiveTab('syllabi');
            setSyllabusStatusFilter('ACTION_REQUIRED');
          }}
          className={`p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            actionRequiredSyllabi.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500'
              : 'bg-white border-slate-200 hover:border-[#005A36]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              {isDean ? 'Awaiting Dean Approval' : 'From Faculty (Pending)'}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#854D0E]">{actionRequiredSyllabi.length}</p>
          <p className="text-[10px] text-amber-700 font-medium">
            {isDean ? 'Endorsed by Department Head' : 'Awaiting Dept. Head endorsement'}
          </p>
        </div>

        <div
          onClick={() => {
            setActiveTab('syllabi');
            setSyllabusStatusFilter('APPROVED');
          }}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Final Approved Syllabi
            </span>
            <CheckCircle className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-[#005A36]">{stats.approvedSyllabi ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Approved by Dean</p>
        </div>

        <div
          onClick={() => setActiveTab('courses')}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Department Courses
            </span>
            <BookOpen className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-slate-800">{courses.length}</p>
          <p className="text-[10px] text-slate-500 font-medium">
            {isDeptHead ? 'Click to add or edit courses' : 'Designated department catalog'}
          </p>
        </div>

        <div
          onClick={() => setActiveTab('faculty')}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Department Faculty
            </span>
            <Briefcase className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800">{facultyList.length || (stats.educatorsCount ?? 0)}</p>
          <p className="text-[10px] text-slate-500 font-medium">Assigned to [{currentDept?.code}]</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('syllabi')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'syllabi'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isDean ? 'Department Syllabi & Dean Approvals' : 'Faculty Syllabus Approvals'}</span>
          {actionRequiredSyllabi.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {actionRequiredSyllabi.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'courses'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isDeptHead ? 'Manage Department Courses' : 'Department Courses'} ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('faculty')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'faculty'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Department Faculty ({facultyList.length})</span>
        </button>

        {isDeptHead && registrations.length > 0 && (
          <button
            onClick={() => setActiveTab('registrations')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'registrations'
                ? 'border-[#005A36] text-[#005A36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Pending Faculty Registrations</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {registrations.length}
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: SYLLABI & APPROVALS */}
      {activeTab === 'syllabi' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#005A36]" />
                <span>
                  {isDean
                    ? `All Syllabi Under [${currentDept?.code}] & Dean Approval Queue`
                    : `Faculty Syllabus Submissions Under [${currentDept?.code}]`}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isDean
                  ? 'Approve syllabi endorsed by the Department Head or inspect any syllabus in your designated department.'
                  : 'Approve syllabi submitted by Faculty to endorse them to the Dean, or return them for revision.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: 'ACTION_REQUIRED',
                  label: isDean ? 'Awaiting Dean Approval' : 'Awaiting Dept. Head Approval',
                  count: actionRequiredSyllabi.length,
                },
                {
                  id: isDean ? 'SUBMITTED' : 'UNDER_REVIEW',
                  label: isDean ? 'Pending Dept. Head' : 'Endorsed to Dean',
                  count: syllabi.filter((s) => s.status === (isDean ? 'SUBMITTED' : 'UNDER_REVIEW')).length,
                },
                {
                  id: 'APPROVED',
                  label: 'Final Approved',
                  count: syllabi.filter((s) => s.status === 'APPROVED').length,
                },
                {
                  id: 'ALL',
                  label: 'All Dept. Syllabi',
                  count: syllabi.length,
                },
              ].map((f) => {
                const active = syllabusStatusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSyllabusStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      active
                        ? 'bg-[#005A36] text-white shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        active ? 'bg-[#FEF08A] text-[#854D0E]' : 'bg-white text-slate-600'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Course Code & Title</th>
                  <th className="py-2.5 px-3">Faculty Author</th>
                  <th className="py-2.5 px-3">Term & AY</th>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Approval Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSyllabi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 italic">
                      No syllabi found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredSyllabi.map((s) => {
                    const subj = s.subject || s.course;
                    const canApproveHere =
                      (isDeptHead && s.status === 'SUBMITTED') ||
                      (isDean && s.status === 'UNDER_REVIEW');

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-extrabold text-[#005A36] mr-1.5">
                            [{subj?.code}]
                          </span>
                          <span className="font-bold text-slate-900">{subj?.title}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="font-semibold text-slate-800">{s.instructor?.fullName || subj?.professorName || 'Faculty'}</p>
                          <p className="text-[10px] font-mono text-slate-500">{s.instructor?.email || ''}</p>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          {s.semester}, {s.academicYear}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            <History className="w-3 h-3 text-[#005A36]" />
                            <span>v{s.currentVersionNumber}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : s.status === 'UNDER_REVIEW'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : s.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : s.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {syllabusStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right space-x-1.5">
                          <Link
                            href={`/syllabi/${s.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-[#005A36]" />
                            <span>View</span>
                          </Link>

                          <Link
                            href={`/syllabi/${s.id}/versions`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] transition-colors"
                          >
                            <GitCompare className="w-3 h-3 text-[#CA8A04]" />
                            <span>Versions</span>
                          </Link>

                          {canApproveHere && (
                            <>
                              <button
                                type="button"
                                disabled={processingId === s.id}
                                onClick={() => handleSyllabusDecision(s.id, 'Approve')}
                                className="inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                              >
                                {processingId === s.id
                                  ? 'Processing...'
                                  : isDean
                                  ? 'Final Approve'
                                  : 'Approve (To Dean)'}
                              </button>
                              <button
                                type="button"
                                disabled={processingId === s.id}
                                onClick={() => {
                                  setRejectingSyllabus(s);
                                  setRejectRemarks('');
                                }}
                                className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COURSES MANAGEMENT (EDITABLE FOR DEPT HEAD, READ-ONLY FOR DEAN) */}
      {activeTab === 'courses' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#005A36]" />
                <span>[{currentDept?.code}] Department Courses & Syllabus Coverage</span>
              </h2>
              <p className="text-xs text-slate-500">
                {isDeptHead
                  ? 'Add, edit, or delete courses under your department and assign faculty instructors.'
                  : 'Read-only overview of all courses and active syllabi in your designated department.'}
              </p>
            </div>

            {isDeptHead && (
              <button
                onClick={openAddCourseModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#FEF08A]" />
                <span>Add Course</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Course Title</th>
                  <th className="py-2.5 px-3">Units & Hours</th>
                  <th className="py-2.5 px-3">Assigned Faculty</th>
                  <th className="py-2.5 px-3">Syllabus Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => {
                  const activeSyllabus = course.syllabi?.[0];
                  return (
                    <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{course.code}</td>
                      <td className="py-3 px-3 text-slate-900 font-semibold">{course.title}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {course.units ?? 3} Units ({course.lecHours ?? 3}h Lec / {course.labHours ?? 0}h Lab)
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {course.professorName || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="py-3 px-3">
                        {activeSyllabus ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              activeSyllabus.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : activeSyllabus.status === 'UNDER_REVIEW'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : activeSyllabus.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            v{activeSyllabus.currentVersionNumber} • {syllabusStatusLabel(activeSyllabus.status)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            No Syllabus
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {activeSyllabus && (
                          <Link
                            href={`/syllabi/${activeSyllabus.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Eye className="w-3 h-3 text-[#005A36]" />
                            <span>View Syllabus</span>
                          </Link>
                        )}
                        {isDeptHead && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditCourseModal(course)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Course</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCourse(course)}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENT FACULTY DIRECTORY */}
      {activeTab === 'faculty' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-[#005A36]" />
                <span>Department Faculty Directory</span>
              </h2>
              <p className="text-xs text-slate-500">
                Faculty members assigned to [{currentDept?.code}] and their assigned courses.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              {isDeptHead && (
                <button
                  onClick={() => setCreateFacultyModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#FEF08A]" />
                  <span>Add Faculty</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Faculty ID</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Assigned Courses</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isDeptHead && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading department faculty...
                    </td>
                  </tr>
                ) : filteredFaculty.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No faculty members found.
                    </td>
                  </tr>
                ) : (
                  filteredFaculty.map((fac) => (
                    <tr key={fac.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{fac.id}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{fac.fullName}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{fac.email}</td>
                      <td className="py-3 px-3">
                        {fac.assignedSubjects?.length > 0 ? (
                          <span className="font-mono font-bold text-[#005A36] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {fac.assignedSubjects.join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            fac.accountStatus === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {fac.accountStatus}
                        </span>
                      </td>
                      {isDeptHead && (
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleToggleFacultyStatus(fac)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                              fac.accountStatus === 'Active'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {fac.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PENDING FACULTY REGISTRATIONS */}
      {isDeptHead && activeTab === 'registrations' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-base text-slate-900">Pending Faculty Self-Registrations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Faculty ID</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{reg.id}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{reg.fullName}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{reg.email}</td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleApproveFacultyRegistration(reg.id)}
                        disabled={processingId === reg.id}
                        className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] text-white cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectFacultyRegistration(reg.id)}
                        disabled={processingId === reg.id}
                        className="px-3 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT COURSE (DEPARTMENT HEAD) */}
      {courseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#005A36]">
                {editingCourse ? `Edit Course: [${editingCourse.code}]` : 'Add New Department Course'}
              </h3>
              <button
                onClick={() => setCourseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingCourse)}
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CPE101"
                    className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-mono uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Units</label>
                  <select
                    value={courseUnits}
                    onChange={(e) => setCourseUnits(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    {[1, 2, 3, 4, 5].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Course title"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lec Hours</label>
                  <input
                    type="number"
                    min={0}
                    value={courseLecHours}
                    onChange={(e) => setCourseLecHours(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lab Hours</label>
                  <input
                    type="number"
                    min={0}
                    value={courseLabHours}
                    onChange={(e) => setCourseLabHours(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Year Level</label>
                  <select
                    value={courseYearLevel}
                    onChange={(e) => setCourseYearLevel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Semester</label>
                  <select
                    value={courseSemester}
                    onChange={(e) => setCourseSemester(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Faculty Instructor</label>
                <select
                  value={courseProfessor}
                  onChange={(e) => setCourseProfessor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="">-- Select Department Faculty --</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.fullName}>
                      {f.fullName} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prerequisite</label>
                <input
                  type="text"
                  value={coursePrereq}
                  onChange={(e) => setCoursePrereq(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : editingCourse ? 'Save Course Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT SYLLABUS WITH FEEDBACK */}
      {rejectingSyllabus && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Return Syllabus for Revision: [{rejectingSyllabus.subject?.code || rejectingSyllabus.course?.code}]
              </h3>
              <button
                onClick={() => setRejectingSyllabus(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700">Revision Remarks / Feedback *</label>
              <textarea
                rows={3}
                required
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Provide feedback for the faculty author..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900"
              />
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingSyllabus(null)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectRemarks.trim() || processingId === rejectingSyllabus.id}
                  onClick={() => handleSyllabusDecision(rejectingSyllabus.id, 'Reject', rejectRemarks)}
                  className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
                >
                  Return for Revision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE FACULTY ACCOUNT (DEPARTMENT HEAD) */}
      {createFacultyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Department Faculty</h3>
              <button
                onClick={() => setCreateFacultyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Faculty ID Number (5 Digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  pattern="\d{5}"
                  value={newFacultyId}
                  onChange={(e) => setNewFacultyId(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 10018"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  placeholder="e.g. Engr. Juan Dela Cruz"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newFacultyEmail}
                  onChange={(e) => setNewFacultyEmail(e.target.value)}
                  placeholder="name@usjr.edu.ph"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Initial Password *</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newFacultyPassword}
                  onChange={(e) => setNewFacultyPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateFacultyModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer"
                >
                  {formSubmitting ? 'Creating...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
