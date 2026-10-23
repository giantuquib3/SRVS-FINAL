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
  ArrowRight,
  GitCompare,
  RefreshCw,
  Eye,
  History,
  PlusCircle,
  UserCheck,
  UserX,
  UserPlus,
  GraduationCap,
  Briefcase,
  X,
  CheckCircle2,
  Search,
  Filter,
  ShieldAlert,
  Info
} from 'lucide-react';
import { isPendingReview, syllabusStatusLabel } from '@/lib/status';

export default function DeptHeadDashboard() {
  const [data, setData] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'overview' | 'registrations' | 'users' | 'curriculum'
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'users' | 'curriculum'>('overview');

  // Registration Requests State
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regFilterStatus, setRegFilterStatus] = useState<string>('PendingApproval');
  const [regRoleFilter, setRegRoleFilter] = useState<'all' | 'Student' | 'Faculty'>('all');
  const [pendingCounts, setPendingCounts] = useState({ students: 0, faculty: 0, total: 0 });
  const [regSearch, setRegSearch] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null); // For View modal
  const [rejectingReg, setRejectingReg] = useState<any>(null); // For Reject modal
  const [rejectReason, setRejectReason] = useState('');
  const [regProcessingId, setRegProcessingId] = useState<number | null>(null);

  // User Management State
  const [userTab, setUserTab] = useState<'faculty' | 'students'>('faculty');
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Modals for Create User
  const [createFacultyModal, setCreateFacultyModal] = useState(false);
  const [createStudentModal, setCreateStudentModal] = useState(false);

  // Create Faculty Form
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyRank, setNewFacultyRank] = useState('Faculty Member');
  const [newFacultyPassword, setNewFacultyPassword] = useState('USJR@Faculty2026');

  // Create Student Form
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentYear, setNewStudentYear] = useState('1st Year');
  const [newStudentProgram, setNewStudentProgram] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('USJR@Student2026');

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchDeptData = async () => {
    setLoading(true);
    try {
      const [statsRes, coursesRes, syllabiRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/courses'),
        fetch('/api/syllabi'),
      ]);

      const statsData = await statsRes.json();
      const coursesData = await coursesRes.json();
      const syllabiData = await syllabiRes.json();

      setData(statsData);
      setCourses(coursesData.courses || []);
      setSyllabi(syllabiData.syllabi || []);
    } catch (err) {
      console.error('Error fetching department data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    setRegLoading(true);
    try {
      const params = new URLSearchParams();
      if (regFilterStatus && regFilterStatus !== 'all') params.append('status', regFilterStatus);
      if (regSearch.trim()) params.append('search', regSearch.trim());
      params.append('format', 'detailed');

      const res = await fetch(`/api/department-head/pending-users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.pendingUsers || []);
        setRegistrations(list);
        if (data.counts) {
          setPendingCounts(data.counts);
        } else {
          const sCount = list.filter((u: any) => u.type === 'Student' || u.role === 'Student').length;
          const fCount = list.filter((u: any) => u.type === 'Faculty' || u.role === 'Educator' || u.role === 'Faculty').length;
          setPendingCounts({ students: sCount, faculty: fCount, total: list.length });
        }
      } else {
        // Fallback to student-registrations endpoint
        const fbRes = await fetch(`/api/department-head/student-registrations?${params.toString()}`);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          setRegistrations(fbData.registrations || []);
        }
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setRegLoading(false);
    }
  };

  const fetchDepartmentUsers = async () => {
    setUsersLoading(true);
    try {
      const [facRes, stuRes] = await Promise.all([
        fetch('/api/department-head/faculty'),
        fetch('/api/department-head/students'),
      ]);

      if (facRes.ok) {
        const facData = await facRes.json();
        setFacultyList(facData.faculty || []);
      }
      if (stuRes.ok) {
        const stuData = await stuRes.json();
        setStudentsList(stuData.students || []);
      }
    } catch (err) {
      console.error('Error fetching department users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchDeptData();
    fetchRegistrations();
    fetchDepartmentUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations();
    } else if (activeTab === 'users') {
      fetchDepartmentUsers();
    }
  }, [activeTab, regFilterStatus]);

  // Handle Approve Registration (Unified for Students and Faculty)
  const handleApproveRegistration = async (id: number) => {
    setRegProcessingId(id);
    try {
      const res = await fetch(`/api/department-head/users/${id}/approve`, {
        method: 'POST',
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Registration approved successfully.');
        fetchRegistrations();
        fetchDeptData();
        fetchDepartmentUsers();
        if (selectedReg?.id === id) setSelectedReg(null);
      } else {
        showToast(resData.error || 'Failed to approve registration.', 'error');
      }
    } catch (err: any) {
      showToast('Network error while approving registration.', 'error');
    } finally {
      setRegProcessingId(null);
    }
  };

  // Handle Reject Registration Submit (Unified for Students and Faculty)
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReg) return;
    setRegProcessingId(rejectingReg.id);
    try {
      const res = await fetch(`/api/department-head/users/${rejectingReg.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Registration rejected.');
        setRejectingReg(null);
        setRejectReason('');
        fetchRegistrations();
        fetchDeptData();
        if (selectedReg?.id === rejectingReg.id) setSelectedReg(null);
      } else {
        showToast(resData.error || 'Failed to reject registration.', 'error');
      }
    } catch (err: any) {
      showToast('Network error while rejecting registration.', 'error');
    } finally {
      setRegProcessingId(null);
    }
  };

  // Handle Faculty Account Status Toggle
  const handleToggleFacultyStatus = async (faculty: any) => {
    const nextStatus = faculty.accountStatus === 'Active' ? 'Deactivated' : 'Active';
    try {
      const res = await fetch(`/api/department-head/faculty/${faculty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: nextStatus }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(`Faculty account ${faculty.fullName} is now ${nextStatus}.`);
        fetchDepartmentUsers();
      } else {
        showToast(resData.error || 'Failed to update faculty status.', 'error');
      }
    } catch {
      showToast('Failed to connect to server.', 'error');
    }
  };

  // Handle Student Account Status Toggle
  const handleToggleStudentStatus = async (student: any) => {
    const nextStatus = student.accountStatus === 'Active' ? 'Deactivated' : 'Active';
    try {
      const res = await fetch(`/api/department-head/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: nextStatus }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(`Student account ${student.fullName} is now ${nextStatus}.`);
        fetchDepartmentUsers();
      } else {
        showToast(resData.error || 'Failed to update student status.', 'error');
      }
    } catch {
      showToast('Failed to connect to server.', 'error');
    }
  };

  // Handle Create Faculty
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
        showToast(`Faculty member ${resData.user?.fullName} created successfully.`);
        setCreateFacultyModal(false);
        setNewFacultyId('');
        setNewFacultyName('');
        setNewFacultyEmail('');
        fetchDepartmentUsers();
        fetchDeptData();
      } else {
        showToast(resData.error || 'Failed to create faculty member.', 'error');
      }
    } catch {
      showToast('Network error while creating faculty.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/department-head/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idNumber: newStudentId.trim(),
          fullName: newStudentName.trim(),
          email: newStudentEmail.trim().toLowerCase(),
          yearLevel: newStudentYear,
          program: newStudentProgram.trim() || undefined,
          password: newStudentPassword,
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(`Student ${resData.user?.fullName} created successfully.`);
        setCreateStudentModal(false);
        setNewStudentId('');
        setNewStudentName('');
        setNewStudentEmail('');
        setNewStudentProgram('');
        fetchDepartmentUsers();
        fetchDeptData();
      } else {
        showToast(resData.error || 'Failed to create student.', 'error');
      }
    } catch {
      showToast('Network error while creating student.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const stats = data?.stats || {};
  const currentDept = data?.department;

  // Filtered registrations
  const filteredRegistrations = registrations.filter((r) => {
    if (regRoleFilter !== 'all') {
      const isFac = r.type === 'Faculty' || r.role === 'Faculty' || r.role === 'Educator';
      if (regRoleFilter === 'Faculty' && !isFac) return false;
      if (regRoleFilter === 'Student' && isFac) return false;
    }
    if (!regSearch.trim()) return true;
    const q = regSearch.toLowerCase();
    const name = (r.fullName || r.name || '').toLowerCase();
    return (
      name.includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      String(r.id || r.idNumber).includes(q)
    );
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

  const filteredStudents = studentsList.filter((s) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      String(s.id).includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-2 text-xs font-semibold animate-in slide-in-from-bottom-2 ${
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
              Department Administrator
            </span>
            {currentDept?.code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200 shadow-2xs">
                Department: [{currentDept.code}] {currentDept.name || currentDept.code}
              </span>
            )}
            <span className="text-xs text-slate-500 font-medium">SRVS Department Scope</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Department Head Dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Autonomous administrative management for [{currentDept?.code || 'Department'}] Faculty, Students, Registrations, and Curriculum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              fetchDeptData();
              fetchRegistrations();
              fetchDepartmentUsers();
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
            <span>Syllabus Reviews {stats.pendingApprovals ? `(${stats.pendingApprovals})` : ''}</span>
          </Link>
          <button
            onClick={() => {
              setActiveTab('users');
              setUserTab('faculty');
              setCreateFacultyModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#FEF08A]" />
            <span>Add Faculty</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('users');
              setUserTab('students');
              setCreateStudentModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-[#005A36] border border-[#005A36] shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-[#005A36]" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Department Overview Cards (Requirement 11) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Faculty */}
        <div
          onClick={() => {
            setActiveTab('users');
            setUserTab('faculty');
          }}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#005A36]">
              Total Faculty
            </span>
            <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-slate-800">{stats.educatorsCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Department Educators</p>
        </div>

        {/* Total Students */}
        <div
          onClick={() => {
            setActiveTab('users');
            setUserTab('students');
          }}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#005A36]">
              Total Students
            </span>
            <GraduationCap className="w-4 h-4 text-slate-400 group-hover:text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-slate-800">{stats.studentsCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Enrolled Department Students</p>
        </div>

        {/* Pending User Registrations */}
        <div
          onClick={() => setActiveTab('registrations')}
          className={`p-4 rounded-2xl border shadow-sm space-y-1 transition-all cursor-pointer group ${
            (pendingCounts.total > 0 || (stats.pendingRegistrations ?? 0) > 0)
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Pending Registrations
            </span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#854D0E]">{pendingCounts.total || stats.pendingRegistrations || 0}</p>
          <p className="text-[10px] text-amber-700 font-medium">
            Students: {pendingCounts.students} • Faculty: {pendingCounts.faculty}
          </p>
        </div>

        {/* Total Courses */}
        <div
          onClick={() => setActiveTab('curriculum')}
          className="bg-white hover:border-[#005A36] p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#005A36]">
              Total Courses
            </span>
            <BookOpen className="w-4 h-4 text-[#005A36]" />
          </div>
          <p className="text-2xl font-black text-[#005A36]">{stats.totalCourses ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Curriculum Catalog</p>
        </div>

        {/* Pending Syllabus Reviews */}
        <Link
          href="/department/syllabus-approvals"
          className="bg-white hover:bg-amber-50/50 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Syllabus Reviews
            </span>
            <Clock className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-2xl font-black text-[#854D0E]">{stats.pendingApprovals ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Awaiting Final Sign-off</p>
        </Link>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'overview'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Department Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('registrations')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'registrations'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pending User Registrations</span>
          {(pendingCounts.total > 0 || (stats.pendingRegistrations ?? 0) > 0) && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {pendingCounts.total || stats.pendingRegistrations}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'users'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Department Users</span>
        </button>

        <button
          onClick={() => setActiveTab('curriculum')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'curriculum'
              ? 'border-[#005A36] text-[#005A36]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Curriculum Coverage</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Action Alerts */}
          {(pendingCounts.total > 0 || (stats.pendingRegistrations ?? 0) > 0) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-900">
                    {pendingCounts.total || stats.pendingRegistrations} User Registration{(pendingCounts.total || stats.pendingRegistrations) > 1 ? 's' : ''} Pending Review
                  </h3>
                  <p className="text-[11px] text-amber-700">
                    Students ({pendingCounts.students}) and Faculty ({pendingCounts.faculty}) from your department [{currentDept?.code}] cannot access their accounts until approved.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('registrations')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#854D0E] hover:bg-[#713F12] text-white transition-colors cursor-pointer"
              >
                Review Requests
              </button>
            </div>
          )}

          {/* Department Administrative Authority Notice */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start space-x-3 text-xs text-emerald-950">
            <Info className="w-4 h-4 text-[#005A36] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[#005A36]">Department Scope Enforcement Active</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                As the <strong>{currentDept?.code} Department Head</strong>, your administrative authority is strictly isolated to the <strong>[{currentDept?.code}] {currentDept?.name}</strong>. All faculty creations, student registrations, syllabus approvals, and course assignments are securely enforced server-side.
              </p>
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Registrations snippet */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-[#005A36]" />
                  <span>Recent User Registrations</span>
                </h3>
                <button
                  onClick={() => setActiveTab('registrations')}
                  className="text-xs font-bold text-[#005A36] hover:underline cursor-pointer"
                >
                  View All ({registrations.length})
                </button>
              </div>

              {registrations.slice(0, 4).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">No registration requests found.</p>
              ) : (
                <div className="space-y-2">
                  {registrations.slice(0, 4).map((reg) => (
                    <div
                      key={reg.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <p className="font-bold text-slate-900">{reg.fullName}</p>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              reg.role === 'Student' || reg.type === 'Student'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {reg.role === 'Student' || reg.type === 'Student' ? 'Student' : 'Faculty'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          ID: {reg.id} • {reg.email}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          reg.accountStatus === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : reg.accountStatus === 'PendingApproval'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {reg.accountStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department Faculty Snapshot */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <Briefcase className="w-4 h-4 text-[#005A36]" />
                  <span>Department Faculty ({facultyList.length})</span>
                </h3>
                <button
                  onClick={() => {
                    setActiveTab('users');
                    setUserTab('faculty');
                  }}
                  className="text-xs font-bold text-[#005A36] hover:underline cursor-pointer"
                >
                  Manage Faculty
                </button>
              </div>

              {facultyList.slice(0, 4).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">No faculty members found.</p>
              ) : (
                <div className="space-y-2">
                  {facultyList.slice(0, 4).map((fac) => (
                    <div
                      key={fac.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{fac.fullName}</p>
                        <p className="text-[10px] text-slate-500">
                          {fac.academicRank} • ID: {fac.id}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          fac.accountStatus === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {fac.accountStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING USER REGISTRATIONS (Requirement 1, 4, 18) */}
      {activeTab === 'registrations' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#005A36]" />
                <span>Pending User Registrations</span>
              </h2>
              <p className="text-xs text-slate-500">
                Review and authorize Student and Faculty self-registration requests belonging exclusively to [{currentDept?.code || 'Department'}].
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter Tabs (All / Student / Faculty) */}
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRegRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    regRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({pendingCounts.total || registrations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRegRoleFilter('Student')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
                    regRoleFilter === 'Student' ? 'bg-white text-[#005A36] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-3 h-3" />
                  <span>Students ({pendingCounts.students})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegRoleFilter('Faculty')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
                    regRoleFilter === 'Faculty' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Briefcase className="w-3 h-3" />
                  <span>Faculty ({pendingCounts.faculty})</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, ID..."
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              {/* Status filter */}
              <select
                value={regFilterStatus}
                onChange={(e) => setRegFilterStatus(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:border-[#005A36]"
              >
                <option value="PendingApproval">Pending Approval</option>
                <option value="Active">Approved (Active)</option>
                <option value="Rejected">Rejected</option>
                <option value="all">All Registrations</option>
              </select>

              <button
                onClick={fetchRegistrations}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="Refresh registrations"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Registration Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">ID Number</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Program / Rank</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#005A36]" />
                      <span>Loading pending user registrations...</span>
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                      No pending user registration records found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => {
                    const isFac = reg.type === 'Faculty' || reg.role === 'Faculty' || reg.role === 'Educator';
                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                              isFac
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {isFac ? <Briefcase className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                            <span>{isFac ? 'Faculty' : 'Student'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{reg.id}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">{reg.fullName}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#005A36] font-bold text-[10px] border border-emerald-200">
                            {reg.departmentId}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {reg.program || reg.academicRank || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{reg.email}</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(reg.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              reg.accountStatus === 'Active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : reg.accountStatus === 'PendingApproval'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : reg.accountStatus === 'Rejected'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {reg.accountStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          {/* View Button */}
                          <button
                            onClick={() => setSelectedReg(reg)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            View
                          </button>

                          {/* Approve Button */}
                          {reg.accountStatus === 'PendingApproval' && (
                            <button
                              disabled={regProcessingId === reg.id}
                              onClick={() => handleApproveRegistration(reg.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#00472A] text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {regProcessingId === reg.id ? 'Processing...' : 'Approve'}
                            </button>
                          )}

                          {/* Reject Button */}
                          {reg.accountStatus === 'PendingApproval' && (
                            <button
                              disabled={regProcessingId === reg.id}
                              onClick={() => {
                                setRejectingReg(reg);
                                setRejectReason('');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
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

      {/* TAB 3: USER MANAGEMENT (Faculty & Students) */}
      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-[#005A36]" />
                <span>Department User Directory</span>
              </h2>
              <p className="text-xs text-slate-500">
                Manage Faculty/Educators and Students assigned to [{currentDept?.code || 'Department'}].
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              {userTab === 'faculty' ? (
                <button
                  onClick={() => setCreateFacultyModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#FEF08A]" />
                  <span>Create Faculty</span>
                </button>
              ) : (
                <button
                  onClick={() => setCreateStudentModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#FEF08A]" />
                  <span>Create Student</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-tabs: Faculty vs Students */}
          <div className="flex space-x-2 border-b border-slate-100 pb-2">
            <button
              onClick={() => setUserTab('faculty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                userTab === 'faculty'
                  ? 'bg-emerald-50 text-[#005A36] border border-emerald-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Department Faculty ({facultyList.length})</span>
            </button>

            <button
              onClick={() => setUserTab('students')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                userTab === 'students'
                  ? 'bg-emerald-50 text-[#005A36] border border-emerald-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Department Students ({studentsList.length})</span>
            </button>
          </div>

          {/* FACULTY LIST */}
          {userTab === 'faculty' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                    <th className="py-2.5 px-3">Faculty ID</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Academic Rank</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Must Change Password</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#005A36]" />
                        <span>Loading department faculty...</span>
                      </td>
                    </tr>
                  ) : filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No faculty members registered in this department yet.
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map((fac) => (
                      <tr key={fac.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{fac.id}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">{fac.fullName}</td>
                        <td className="py-3 px-3 text-slate-700">{fac.academicRank}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{fac.email}</td>
                        <td className="py-3 px-3">
                          {fac.mustChangePassword ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Yes
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              No
                            </span>
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
                        <td className="py-3 px-3 text-right space-x-2">
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
          )}

          {/* STUDENTS LIST */}
          {userTab === 'students' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Program / Year</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Enrolled Courses</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#005A36]" />
                        <span>Loading department students...</span>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No students registered in this department yet.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#005A36]">{stu.id}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">{stu.fullName}</td>
                        <td className="py-3 px-3 text-slate-700">
                          {stu.program || `BS ${currentDept?.code}`} • {stu.yearLevel}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{stu.email}</td>
                        <td className="py-3 px-3">
                          {stu.enrolledCourses?.length > 0 ? (
                            <span className="font-semibold text-slate-700">
                              {stu.enrolledCourses.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No enrollments</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              stu.accountStatus === 'Active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : stu.accountStatus === 'PendingApproval'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {stu.accountStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleToggleStudentStatus(stu)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                              stu.accountStatus === 'Active'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {stu.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CURRICULUM COVERAGE MATRIX */}
      {activeTab === 'curriculum' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#005A36]" />
                <span>Department Course Syllabus Coverage Matrix</span>
              </h2>
              <p className="text-xs text-slate-500">
                Live status of each course in your department with missing syllabus indicators
              </p>
            </div>
            <span className="text-xs text-slate-600 font-bold">{courses.length} Department Courses</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Course Title</th>
                  <th className="py-2.5 px-3">Assigned Faculty</th>
                  <th className="py-2.5 px-3">Active Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => {
                  const activeSyllabus = course.syllabi?.[0];
                  return (
                    <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-[#005A36]">{course.code}</td>
                      <td className="py-3 px-3 text-slate-800 font-medium">{course.title}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {course.professorName ? (
                          <span className="font-semibold text-slate-800">{course.professorName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {activeSyllabus ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            <History className="w-3 h-3 text-[#005A36]" />
                            <span>v{activeSyllabus.currentVersionNumber}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No syllabus version</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {activeSyllabus ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              activeSyllabus.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isPendingReview(activeSyllabus.status)
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {syllabusStatusLabel(activeSyllabus.status)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        {activeSyllabus && (
                          <>
                            <Link
                              href={`/syllabi/${activeSyllabus.id}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            >
                              <Eye className="w-3 h-3 text-[#005A36]" />
                              <span>View</span>
                            </Link>
                            <Link
                              href={`/syllabi/${activeSyllabus.id}/versions`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] transition-colors"
                            >
                              <GitCompare className="w-3 h-3 text-[#CA8A04]" />
                              <span>Compare</span>
                            </Link>
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

      {/* MODAL 1: VIEW USER REGISTRATION DETAILS */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                  selectedReg.type === 'Faculty' || selectedReg.role === 'Faculty' || selectedReg.role === 'Educator'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-emerald-50 border-emerald-200 text-[#005A36]'
                }`}>
                  {selectedReg.type === 'Faculty' || selectedReg.role === 'Faculty' || selectedReg.role === 'Educator' ? (
                    <Briefcase className="w-5 h-5" />
                  ) : (
                    <GraduationCap className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedReg.type === 'Faculty' || selectedReg.role === 'Faculty' || selectedReg.role === 'Educator'
                      ? 'Faculty Registration Request'
                      : 'Student Registration Request'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Department of {selectedReg.departmentName || selectedReg.departmentId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {selectedReg.type === 'Faculty' || selectedReg.role === 'Faculty' || selectedReg.role === 'Educator'
                    ? 'Faculty ID Number'
                    : 'Student ID Number'}
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedReg.id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Status</span>
                <span className="font-bold text-slate-900">{selectedReg.accountStatus}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{selectedReg.fullName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Institutional Email</span>
                <span className="font-mono text-slate-900">{selectedReg.email}</span>
              </div>
              {selectedReg.type === 'Faculty' || selectedReg.role === 'Faculty' || selectedReg.role === 'Educator' ? (
                <div className="p-3 bg-slate-50 rounded-xl col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Rank</span>
                  <span className="font-semibold text-slate-900">{selectedReg.academicRank || 'Faculty Member'}</span>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree Program</span>
                    <span className="font-semibold text-slate-900">{selectedReg.program || 'Not specified'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Year Level</span>
                    <span className="font-semibold text-slate-900">{selectedReg.yearLevel || '1st Year'}</span>
                  </div>
                </>
              )}
              <div className="p-3 bg-slate-50 rounded-xl col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Submission Date</span>
                <span className="text-slate-900 font-medium">
                  {new Date(selectedReg.createdAt).toLocaleString()}
                </span>
              </div>

              {selectedReg.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl col-span-2">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">Rejection Reason</span>
                  <p className="text-rose-900 mt-1">{selectedReg.rejectionReason}</p>
                </div>
              )}

              {selectedReg.reviewedBy && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl col-span-2">
                  <span className="text-[10px] uppercase font-bold text-[#005A36] block">Reviewed By</span>
                  <p className="text-slate-800 font-medium mt-0.5">
                    {selectedReg.reviewedBy}{' '}
                    {selectedReg.reviewedAt && (
                      <span className="text-slate-500 font-normal">
                        on {new Date(selectedReg.reviewedAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Actions in view modal */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>

              {selectedReg.accountStatus === 'PendingApproval' && (
                <>
                  <button
                    onClick={() => {
                      setRejectingReg(selectedReg);
                      setRejectReason('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    disabled={regProcessingId === selectedReg.id}
                    onClick={() => handleApproveRegistration(selectedReg.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer shadow-sm"
                  >
                    {regProcessingId === selectedReg.id ? 'Approving...' : 'Approve Registration'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT REGISTRATION WITH REASON */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reject Registration</h3>
                  <p className="text-[11px] text-slate-500">
                    {rejectingReg.type === 'Faculty' || rejectingReg.role === 'Faculty' || rejectingReg.role === 'Educator' ? 'Faculty' : 'Student'}: {rejectingReg.fullName} ({rejectingReg.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingReg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Please provide a rejection reason. This reason will be stored in the database and displayed to the user when they attempt to sign in:
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. ID number does not match departmental records. Please visit the Department office."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-rose-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Preset Quick Reasons */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'ID Number not in official departmental master list',
                    'Incorrect department chosen during registration',
                    'Please contact the Department Chairperson office',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingReg(null)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regProcessingId === rejectingReg.id}
                  className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {regProcessingId === rejectingReg.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE FACULTY ACCOUNT */}
      {createFacultyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#005A36]">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Faculty Member</h3>
                  <p className="text-[11px] text-slate-500">Department of {currentDept?.name || currentDept?.code}</p>
                </div>
              </div>
              <button
                onClick={() => setCreateFacultyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-[#005A36] block">Department Assigned</span>
                <p className="text-[11px] text-slate-600">
                  This faculty member will be registered strictly under <strong>[{currentDept?.code}] {currentDept?.name}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Faculty ID Number (5 Digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  pattern="\d{5}"
                  value={newFacultyId}
                  onChange={(e) => setNewFacultyId(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 10002"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Academic Rank</label>
                <select
                  value={newFacultyRank}
                  onChange={(e) => setNewFacultyRank(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                >
                  <option value="Faculty Member">Faculty Member</option>
                  <option value="Instructor I">Instructor I</option>
                  <option value="Instructor II">Instructor II</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Full Professor">Full Professor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Temporary Password *</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newFacultyPassword}
                  onChange={(e) => setNewFacultyPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  <code>MustChangePassword = true</code> will be set automatically for this account.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateFacultyModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {formSubmitting ? 'Creating...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE STUDENT ACCOUNT */}
      {createStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#005A36]">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Student Account</h3>
                  <p className="text-[11px] text-slate-500">Department of {currentDept?.name || currentDept?.code}</p>
                </div>
              </div>
              <button
                onClick={() => setCreateStudentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-[#005A36] block">Department Assigned</span>
                <p className="text-[11px] text-slate-600">
                  This student will be registered strictly under <strong>[{currentDept?.code}] {currentDept?.name}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Student ID Number (10 Digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  pattern="\d{10}"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 2026010001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="student@usjr.edu.ph"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Year Level</label>
                  <select
                    value={newStudentYear}
                    onChange={(e) => setNewStudentYear(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Degree Program</label>
                  <input
                    type="text"
                    value={newStudentProgram}
                    onChange={(e) => setNewStudentProgram(e.target.value)}
                    placeholder={`e.g. BS ${currentDept?.code || 'Engineering'}`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Temporary Password *</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#005A36] focus:bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  <code>MustChangePassword = true</code> will be set automatically for this account.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateStudentModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#00472A] text-white cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {formSubmitting ? 'Creating...' : 'Create Student Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
