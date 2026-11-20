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
  Plus,
  UserCheck,
  UserPlus,
  X,
  CheckCircle2,
  Search,
  Edit3,
  Trash2,
  ShieldCheck,
  FileEdit,
  Send,
  PlusCircle,
  KeyRound,
  XCircle,
} from 'lucide-react';
import {
  syllabusStatusLabel,
  roleLabel,
  getApprovalRouteLabel,
  formatVersionLabel,
  formatShortVersionLabel,
} from '@/lib/status';
import { DEPARTMENTS } from '@/lib/departments';

export default function DeptHeadAndDeanDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [myDeanSubmissions, setMyDeanSubmissions] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [editReqFilter, setEditReqFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'ALL'>('PENDING');
  const [deanDeptFilter, setDeanDeptFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'approvals' | 'edit-requests' | 'syllabi' | 'my-dean' | 'courses' | 'faculty' | 'registrations'>('approvals');

  // Deny / Revoke Edit Permission Modal
  const [editReqModal, setEditReqModal] = useState<{ request: any; action: 'REJECT' | 'REVOKE' } | null>(null);
  const [editReqRemarks, setEditReqRemarks] = useState('');

  // Faculty & Pending Registrations State (Dept Head)
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
  const [newFacultyRank] = useState('Full-Time');
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

  // Quick Approve / Reject Modals for Pending Version
  const [approvingVersion, setApprovingVersion] = useState<any | null>(null);
  const [approveComments, setApproveComments] = useState('');
  const [rejectingVersion, setRejectingVersion] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

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
        fetch(`/api/syllabus-approvals?status=PENDING_APPROVAL${deptQuery}`).then((r) => (r.ok ? r.json() : { approvals: [], mySubmissions: [] })),
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
  }, [deanDeptFilter]);

  useEffect(() => {
    fetchFacultyAndRegistrations();
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'edit-requests') setActiveTab('edit-requests');
    }
  }, []);

  const handleGrantEditPermission = async (requestItem: any) => {
    setProcessingId(`edit-req-${requestItem.id}`);
    try {
      const res = await fetch(`/api/syllabus-edit-requests/${requestItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Edit permission granted to Faculty member.');
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to grant edit permission.', 'error');
      }
    } catch {
      showToast('Network error while granting edit permission.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmDenyOrRevokeEditPermission = async () => {
    if (!editReqModal || !editReqRemarks.trim()) return;
    setProcessingId(`edit-req-${editReqModal.request.id}`);
    try {
      const res = await fetch(`/api/syllabus-edit-requests/${editReqModal.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editReqModal.action,
          remarks: editReqRemarks.trim(),
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Edit permission updated.');
        setEditReqModal(null);
        setEditReqRemarks('');
        await fetchAllData();
      } else {
        showToast(resData.error || 'Failed to update edit permission.', 'error');
      }
    } catch {
      showToast('Network error while updating edit permission.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const isDean = currentUser?.role === 'Dean' || data?.role === 'Dean';
  const isDeptHead = currentUser?.role === 'DepartmentHead' || data?.role === 'DepartmentHead';
  const currentDept = data?.department;
  const stats = data?.stats || {};

  // Version-Level Approve / Reject Handlers
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
        showToast(resData.message || 'Proposed version approved and promoted as current effective syllabus.');
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
        showToast(resData.message || 'Proposed version returned for revision with feedback.');
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

  const filteredFaculty = facultyList.filter((f) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      f.fullName?.toLowerCase().includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      String(f.id).includes(q)
    );
  });

  const pendingDeanFromDeptHead = myDeanSubmissions.filter((v) => v.approvalStatus === 'UNDER_REVIEW').length;

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              {isDean ? 'College of Engineering — Dean Portal' : 'Department Head Electronic Workspace'}
            </span>
            {isDeptHead && currentDept?.code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
                Assigned Department: [{currentDept.code}] {currentDept.name || currentDept.code}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            {isDean ? 'Dean Electronic Syllabus Review Portal' : 'Department Head Syllabus & Course Dashboard'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {isDean
              ? 'Review, preview, compare side-by-side, and approve or reject electronic syllabus revisions submitted by Department Heads across all academic departments.'
              : `Manage Faculty edit permission requests, review Faculty syllabus revisions in [${currentDept?.code || 'your department'}], and edit syllabi directly for Dean approval.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDean && (
            <select
              value={deanDeptFilter}
              onChange={(e) => setDeanDeptFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">All Academic Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.code}] {d.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              fetchAllData();
              if (isDeptHead) fetchFacultyAndRegistrations();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isDeptHead && (
            <button
              onClick={() => {
                setActiveTab('courses');
                openAddCourseModal();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FEF08A]" />
              <span>Add Subject</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className={`grid grid-cols-2 ${isDeptHead ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-4`}>
        <div
          onClick={() => setActiveTab('approvals')}
          className={`p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
            pendingQueue.length > 0
              ? 'bg-amber-50/75 border-amber-300 hover:border-amber-500'
              : 'bg-white border-slate-200 hover:border-[#005A36]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              {isDean ? 'Awaiting Dean Approval' : 'Faculty Revisions Pending'}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#854D0E]">{pendingQueue.length}</p>
          <p className="text-[10px] text-amber-700 font-medium">
            {isDean ? 'Submitted by Dept. Heads' : 'Submitted by Department Faculty'}
          </p>
        </div>

        {isDeptHead && (
          <div
            onClick={() => setActiveTab('edit-requests')}
            className={`p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer ${
              editRequests.filter((r) => r.status === 'PENDING').length > 0
                ? 'bg-[#FEF9C3]/70 border-[#CA8A04]/40 hover:border-[#CA8A04]'
                : 'bg-white border-slate-200 hover:border-[#005A36]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#854D0E] uppercase tracking-wider">
                Edit Permission Req.
              </span>
              <KeyRound className="w-4 h-4 text-[#CA8A04]" />
            </div>
            <p className="text-2xl font-black text-[#854D0E]">
              {editRequests.filter((r) => r.status === 'PENDING').length}
            </p>
            <p className="text-[10px] text-amber-800 font-medium">
              {editRequests.filter((r) => r.status === 'APPROVED').length} active granted
            </p>
          </div>
        )}

        <div
          onClick={() => setActiveTab('syllabi')}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Effective Approved Syllabi
            </span>
            <CheckCircle className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-[#005A36]">{stats.approvedSyllabi ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Active official versions</p>
        </div>

        {isDeptHead ? (
          <div
            onClick={() => setActiveTab('my-dean')}
            className="bg-white hover:border-purple-400 p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                My Edits → Dean
              </span>
              <Send className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-900">{myDeanSubmissions.length}</p>
            <p className="text-[10px] text-purple-600 font-medium">
              {pendingDeanFromDeptHead} awaiting Dean decision
            </p>
          </div>
        ) : (
          <div
            onClick={() => setActiveTab('syllabi')}
            className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Electronic Syllabi
              </span>
              <Layers className="w-4 h-4 text-[#005A36]" />
            </div>
            <p className="text-2xl font-black text-slate-800">{syllabi.length}</p>
            <p className="text-[10px] text-slate-500 font-medium">Across selected departments</p>
          </div>
        )}

        <div
          onClick={() => setActiveTab('courses')}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isDeptHead ? 'Department Subjects' : 'Academic Subjects'}
            </span>
            <BookOpen className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-slate-800">{courses.length}</p>
          <p className="text-[10px] text-slate-500 font-medium">
            {isDeptHead ? 'Manage department catalog' : 'All departments catalog'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'approvals'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isDean ? 'Dept. Head Submissions Awaiting Dean' : 'Faculty Revisions Queue'}</span>
          {pendingQueue.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {pendingQueue.length}
            </span>
          )}
        </button>

        {isDeptHead && (
          <button
            onClick={() => setActiveTab('edit-requests')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'edit-requests'
                ? 'border-[#005A36] text-[#005A36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Edit Permission Requests</span>
            {editRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#C99700] text-slate-950">
                {editRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('syllabi')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'syllabi'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isDean ? 'All Syllabi & Version History' : 'Department Syllabi'} ({syllabi.length})</span>
        </button>

        {isDeptHead && (
          <button
            onClick={() => setActiveTab('my-dean')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'my-dean'
                ? 'border-[#005A36] text-[#005A36]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>My Revisions → Dean ({myDeanSubmissions.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'courses'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isDeptHead ? 'Manage Courses' : 'Courses Overview'} ({courses.length})</span>
        </button>

        {isDeptHead && (
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
        )}

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
            <span>Pending Registrations ({registrations.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1B: FACULTY EDIT PERMISSION REQUESTS (DEPARTMENT HEAD ONLY) */}
      {isDeptHead && activeTab === 'edit-requests' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-[#005A36]" />
                <span>Faculty Syllabus Edit Permission Requests ({currentDept?.code || ''})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Faculty members must receive your approval here before they can edit a syllabus. Once granted, their proposed changes will come back to you for final version approval.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEditReqFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    editReqFilter === st
                      ? 'bg-[#005A36] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {st === 'APPROVED' ? 'Granted' : st === 'REJECTED' ? 'Denied' : st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {editRequests.filter((r) => editReqFilter === 'ALL' || r.status === editReqFilter).length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                No {editReqFilter === 'ALL' ? '' : editReqFilter.toLowerCase()} edit permission requests
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When Faculty members request permission to revise a department syllabus, their requests will appear here for your approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                    <th className="py-2.5 px-3">Faculty Member</th>
                    <th className="py-2.5 px-3">Subject & Current Version</th>
                    <th className="py-2.5 px-3">Reason for Edit Request</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editRequests
                    .filter((r) => editReqFilter === 'ALL' || r.status === editReqFilter)
                    .map((reqItem) => {
                      const isBusy = processingId === `edit-req-${reqItem.id}`;
                      return (
                        <tr key={reqItem.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-3 align-top">
                            <div className="font-bold text-slate-900 capitalize">{reqItem.faculty?.fullName}</div>
                            <div className="text-[11px] text-slate-500">{reqItem.faculty?.email}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Requested {new Date(reqItem.requestedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-[#005A36]">
                                {reqItem.syllabus?.subject?.code}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#005A36] border border-emerald-200 font-mono text-[10px] font-bold">
                                v{reqItem.syllabus?.currentVersionNumber || 1}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-800">{reqItem.syllabus?.subject?.title}</div>
                          </td>
                          <td className="py-3.5 px-3 align-top max-w-sm">
                            <p className="text-slate-700 leading-relaxed">{reqItem.reason}</p>
                            {reqItem.reviewRemarks && reqItem.status !== 'PENDING' && (
                              <p className="text-[11px] text-slate-500 italic mt-1">
                                Remarks: &ldquo;{reqItem.reviewRemarks}&rdquo;
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-3 align-top">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                reqItem.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : reqItem.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : reqItem.status === 'COMPLETED'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {reqItem.status === 'APPROVED'
                                ? 'Permission Granted'
                                : reqItem.status === 'REJECTED'
                                ? 'Denied'
                                : reqItem.status === 'COMPLETED'
                                ? 'Revision Completed'
                                : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right align-top">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Link
                                href={`/syllabi/${reqItem.syllabusId}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                              >
                                <Eye className="w-3 h-3 text-[#005A36]" />
                                <span>View</span>
                              </Link>
                              {reqItem.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleGrantEditPermission(reqItem)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-[#FEF08A]" />
                                    <span>{isBusy ? '...' : 'Grant Permission'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setEditReqModal({ request: reqItem, action: 'REJECT' });
                                      setEditReqRemarks('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer disabled:opacity-50"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Deny</span>
                                  </button>
                                </>
                              )}
                              {reqItem.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setEditReqModal({ request: reqItem, action: 'REVOKE' });
                                    setEditReqRemarks('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Revoke</span>
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
        </div>
      )}

      {/* TAB 1: PENDING VERSION APPROVAL QUEUE (DEPT HEAD REVIEWS FACULTY / DEAN REVIEWS DEPT HEAD) */}
      {activeTab === 'approvals' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#005A36]" />
                <span>
                  {isDean
                    ? 'Department Head Submissions Awaiting Dean Approval'
                    : `Faculty Submissions Awaiting Department Head Approval (${currentDept?.code || ''})`}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Preview electronic syllabus changes and compare side-by-side directly in SRVS before approving or rejecting with feedback.
              </p>
            </div>
            <Link
              href="/department/syllabus-approvals"
              className="text-xs font-bold text-[#005A36] hover:underline"
            >
              Open Full Approval Queue →
            </Link>
          </div>

          {pendingQueue.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No Pending Submissions Awaiting Your Review</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isDean
                  ? 'When a Department Head edits and submits a syllabus revision, it will appear here immediately for your Dean review.'
                  : 'When Faculty members in your department submit new syllabi or proposed revisions, they will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                    <th className="py-2.5 px-3">Course & Dept</th>
                    <th className="py-2.5 px-3">Submitted By</th>
                    <th className="py-2.5 px-3">Proposed Version & Change Summary</th>
                    <th className="py-2.5 px-3">Submitted</th>
                    <th className="py-2.5 px-3 text-right">Review & Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingQueue.map((item) => {
                    const subj = item.syllabus?.subject || item.syllabus?.course;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-[#005A36]">{subj?.code}</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#005A36] border border-emerald-200 text-[10px] font-mono font-bold">
                              [{item.syllabus?.departmentId}]
                            </span>
                          </div>
                          <div className="font-semibold text-slate-800 mt-0.5">{subj?.title}</div>
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <div className="font-bold text-slate-900 capitalize">{item.editor?.fullName}</div>
                          <div className="text-[10px] text-slate-500">{roleLabel(item.editor?.role)}</div>
                        </td>
                        <td className="py-3.5 px-3 align-top max-w-sm">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30">
                            {formatVersionLabel(item)}
                          </span>
                          <p className="text-slate-700 mt-1">{item.changeSummary}</p>
                        </td>
                        <td className="py-3.5 px-3 align-top font-mono text-[11px] text-slate-500">
                          {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-3 text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Link
                              href={`/department/syllabus-approvals/${item.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30"
                            >
                              <GitCompare className="w-3 h-3" />
                              <span>Preview & Compare</span>
                            </Link>
                            {item.canReview && (
                              <>
                                <button
                                  type="button"
                                  disabled={processingId === item.id}
                                  onClick={() => {
                                    setApprovingVersion(item);
                                    setApproveComments('');
                                  }}
                                  className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId === item.id}
                                  onClick={() => {
                                    setRejectingVersion(item);
                                    setRejectRemarks('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                                >
                                  Reject
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
          )}
        </div>
      )}

      {/* TAB 2: ALL SYLLABI & VERSION HISTORY */}
      {activeTab === 'syllabi' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Layers className="w-5 h-5 text-[#005A36]" />
                <span>
                  {isDean ? 'All Electronic Syllabi & Versions' : `Department Electronic Syllabi (${currentDept?.code || ''})`}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isDeptHead
                  ? 'View, compare versions, or edit any syllabus in your department (Department Head edits are routed to the Dean for approval).'
                  : 'Inspect effective approved versions and complete revision histories across departments.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Effective Official Version</th>
                  <th className="py-2.5 px-3">Latest Activity / Pending Revision</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syllabi.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400 italic">
                      No electronic syllabi found.
                    </td>
                  </tr>
                ) : (
                  syllabi.map((s) => {
                    const subj = s.subject || s.course;
                    const approved = s.approvedVersion;
                    const pending = s.pendingVersion;
                    const latest = s.latestVersion;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-[#005A36]">{subj?.code}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                              [{s.departmentId}]
                            </span>
                          </div>
                          <div className="font-bold text-slate-900">{subj?.title}</div>
                          <div className="text-[10px] text-slate-500">
                            {s.semester}, AY {s.academicYear} • {s.totalVersions || 1} version(s)
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          {approved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              v{approved.versionNumber} Approved
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No approved version yet</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 align-top space-y-1">
                          {pending ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                {formatShortVersionLabel(pending)} • {syllabusStatusLabel(pending.approvalStatus)}
                              </span>
                              <div className="text-[10px] text-slate-500">
                                by <strong className="capitalize">{pending.editor?.fullName}</strong> ({roleLabel(pending.editor?.role)})
                              </div>
                            </div>
                          ) : latest ? (
                            <span className="text-[11px] text-slate-600">
                              Latest: {formatShortVersionLabel(latest)} ({syllabusStatusLabel(latest.approvalStatus)})
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-3 text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Link
                              href={`/syllabi/${s.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800"
                            >
                              <Eye className="w-3 h-3 text-[#005A36]" />
                              <span>View</span>
                            </Link>
                            {isDeptHead && (
                              <Link
                                href={`/syllabi/${s.id}/edit`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white"
                                title="Edit syllabus and submit proposed revision to Dean"
                              >
                                <FileEdit className="w-3 h-3 text-[#FEF08A]" />
                                <span>Edit (To Dean)</span>
                              </Link>
                            )}
                            <Link
                              href={`/syllabi/${s.id}/versions`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E]"
                            >
                              <GitCompare className="w-3 h-3 text-[#CA8A04]" />
                              <span>Versions & Compare</span>
                            </Link>
                          </div>
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

      {/* TAB 3 (DEPT HEAD ONLY): MY PROPOSED REVISIONS SUBMITTED TO DEAN */}
      {isDeptHead && activeTab === 'my-dean' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-700" />
              <span>My Proposed Syllabus Revisions — Dean Approval Tracker</span>
            </h2>
            <p className="text-xs text-slate-500">
              Track approval status and review comments from the Dean for all electronic syllabus revisions you authored as Department Head.
            </p>
          </div>

          {myDeanSubmissions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 italic">
              You have not proposed any syllabus revisions yet. Click &ldquo;Edit (To Dean)&rdquo; on any department syllabus to propose changes for Dean approval.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/70">
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Version & Change Summary</th>
                    <th className="py-2.5 px-3">Dean Approval Status</th>
                    <th className="py-2.5 px-3">Dean Review Feedback</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myDeanSubmissions.map((item) => {
                    const subj = item.syllabus?.subject || item.syllabus?.course;
                    const isRejected = item.approvalStatus === 'REJECTED';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-3 align-top">
                          <span className="font-mono font-extrabold text-[#005A36]">{subj?.code}</span>
                          <div className="font-semibold text-slate-800">{subj?.title}</div>
                        </td>
                        <td className="py-3.5 px-3 align-top max-w-xs">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF9C3] text-[#854D0E]">
                            {formatVersionLabel(item)}
                          </span>
                          <p className="text-slate-600 mt-1">{item.changeSummary}</p>
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.approvalStatus === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : item.approvalStatus === 'UNDER_REVIEW'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {syllabusStatusLabel(item.approvalStatus)}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {getApprovalRouteLabel(item.approvalStatus, 'DepartmentHead')}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top max-w-xs">
                          {item.reviewComments ? (
                            <p className={`italic text-[11px] ${isRejected ? 'text-rose-700' : 'text-emerald-800'}`}>
                              &ldquo;{item.reviewComments}&rdquo;
                              {item.reviewedBy?.fullName && (
                                <span className="block not-italic text-[10px] text-slate-500">
                                  — {item.reviewedBy.fullName}
                                </span>
                              )}
                            </p>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Awaiting Dean review</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right align-top">
                          <div className="flex justify-end gap-1.5">
                            <Link
                              href={`/syllabi/${item.syllabusId}?version=${item.versionNumber}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px]"
                            >
                              View
                            </Link>
                            {isRejected && (
                              <Link
                                href={`/syllabi/${item.syllabusId}/edit?fromVersion=${item.versionNumber}`}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                              >
                                Revise & Resubmit
                              </Link>
                            )}
                            <Link
                              href={`/syllabi/${item.syllabusId}/versions`}
                              className="px-2.5 py-1 rounded-lg bg-[#FEF9C3] text-[#854D0E] font-bold text-[11px]"
                            >
                              Compare
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
      )}

      {/* TAB 4: COURSES MANAGEMENT */}
      {activeTab === 'courses' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#005A36]" />
                <span>
                  {isDeptHead ? `[${currentDept?.code}] Department Subjects & Syllabus Coverage` : 'Academic Subjects Overview'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isDeptHead
                  ? 'Add, edit, or delete courses under your department and manage electronic syllabi.'
                  : 'Read-only overview of academic courses and active syllabi.'}
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
                      <td className="py-3 px-3 font-mono font-bold text-[#005A36]">
                        {course.code}
                        {isDean && (
                          <span className="ml-1.5 text-[10px] text-slate-500">[{course.departmentId}]</span>
                        )}
                      </td>
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
                        {activeSyllabus ? (
                          <Link
                            href={`/syllabi/${activeSyllabus.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Eye className="w-3 h-3 text-[#005A36]" />
                            <span>View Syllabus</span>
                          </Link>
                        ) : isDeptHead ? (
                          <Link
                            href={`/syllabi/new?subjectId=${course.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] text-[#854D0E]"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>Create Syllabus</span>
                          </Link>
                        ) : null}
                        {isDeptHead && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditCourseModal(course)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
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

      {/* TAB 5: DEPARTMENT FACULTY DIRECTORY (DEPT HEAD) */}
      {isDeptHead && activeTab === 'faculty' && (
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
              <button
                onClick={() => setCreateFacultyModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#FEF08A]" />
                <span>Add Faculty</span>
              </button>
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
                  <th className="py-2.5 px-3 text-right">Actions</th>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PENDING FACULTY REGISTRATIONS (DEPT HEAD) */}
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

      {/* MODAL: APPROVE VERSION WITH REVIEW COMMENTS */}
      {approvingVersion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#005A36]">
                Approve [{approvingVersion.syllabus?.subject?.code}] {formatVersionLabel(approvingVersion)}
              </h3>
              <button onClick={() => setApprovingVersion(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Approving these proposed changes automatically generates the next official version (<strong>Version {(approvingVersion.syllabus?.currentVersionNumber || 1) + 1}</strong>) while retaining all previous versions in revision history.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Review Comments (Optional)</label>
                <textarea
                  rows={3}
                  value={approveComments}
                  onChange={(e) => setApproveComments(e.target.value)}
                  placeholder="Add review comments..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingVersion(null)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingId === approvingVersion.id}
                  onClick={handleConfirmApprove}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white cursor-pointer"
                >
                  {processingId === approvingVersion.id ? 'Approving...' : 'Confirm & Make Effective'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT VERSION WITH MANDATORY FEEDBACK */}
      {rejectingVersion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-700">
                Reject [{rejectingVersion.syllabus?.subject?.code}] Version {rejectingVersion.versionNumber}
              </h3>
              <button onClick={() => setRejectingVersion(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                This proposed version remains in version history and the author will receive your feedback to revise and resubmit. Any existing effective approved syllabus stays unchanged.
              </p>
              <label className="block font-bold text-slate-700">Rejection Reason / Review Feedback *</label>
              <textarea
                rows={4}
                required
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Provide clear, actionable revision feedback..."
                className="w-full bg-slate-50 border border-rose-300 rounded-xl p-3 text-slate-900"
              />
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingVersion(null)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectRemarks.trim() || processingId === rejectingVersion.id}
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {processingId === rejectingVersion.id ? 'Returning...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT COURSE (DEPARTMENT HEAD) */}
      {courseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#005A36]">
                {editingCourse ? `Edit Course: [${editingCourse.code}]` : 'Add New Department Course'}
              </h3>
              <button onClick={() => setCourseModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
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
                      <option key={u} value={u}>{u}</option>
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lec Hours</label>
                  <input type="number" min={0} value={courseLecHours} onChange={(e) => setCourseLecHours(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lab Hours</label>
                  <input type="number" min={0} value={courseLabHours} onChange={(e) => setCourseLabHours(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Year Level</label>
                  <select value={courseYearLevel} onChange={(e) => setCourseYearLevel(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Semester</label>
                  <select value={courseSemester} onChange={(e) => setCourseSemester(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Faculty Instructor</label>
                <select value={courseProfessor} onChange={(e) => setCourseProfessor(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
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
                <input type="text" value={coursePrereq} onChange={(e) => setCoursePrereq(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setCourseModalOpen(false)} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={formSubmitting} className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer">
                  {formSubmitting ? 'Saving...' : editingCourse ? 'Save Course Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DENY OR REVOKE FACULTY EDIT PERMISSION */}
      {editReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editReqModal.action === 'REVOKE' ? 'Revoke Edit Permission' : 'Deny Edit Permission Request'}
              </h3>
              <button
                type="button"
                onClick={() => setEditReqModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600">
              {editReqModal.action === 'REVOKE' ? 'Revoking edit access for' : 'Denying edit permission request from'}{' '}
              <strong className="text-slate-900">{editReqModal.request.faculty?.fullName}</strong> on{' '}
              <strong className="text-[#005A36] font-mono">
                [{editReqModal.request.syllabus?.subject?.code}]
              </strong>{' '}
              {editReqModal.request.syllabus?.subject?.title}.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reason / Remarks <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={editReqRemarks}
                onChange={(e) => setEditReqRemarks(e.target.value)}
                placeholder="Explain why the request is being denied or revoked..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditReqModal(null)}
                className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editReqRemarks.trim() || processingId === `edit-req-${editReqModal.request.id}`}
                onClick={handleConfirmDenyOrRevokeEditPermission}
                className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                {editReqModal.action === 'REVOKE' ? 'Confirm Revoke' : 'Confirm Deny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE FACULTY ACCOUNT (DEPARTMENT HEAD) */}
      {createFacultyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Department Faculty</h3>
              <button onClick={() => setCreateFacultyModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
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
                <input type="text" required value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)} placeholder="e.g. Engr. Juan Dela Cruz" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Institutional Email *</label>
                <input type="email" required value={newFacultyEmail} onChange={(e) => setNewFacultyEmail(e.target.value)} placeholder="name@usjr.edu.ph" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Initial Password *</label>
                <input type="text" required minLength={6} value={newFacultyPassword} onChange={(e) => setNewFacultyPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setCreateFacultyModal(false)} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 text-slate-700 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={formSubmitting} className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer">
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
