'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  PlusCircle,
  Search,
  Filter,
  Layers,
  History,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUnits, setNewUnits] = useState<number>(3);
  const [newDeptId, setNewDeptId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (departmentId) params.append('departmentId', departmentId);

      const [cRes, dRes, uRes] = await Promise.all([
        fetch(`/api/courses?${params.toString()}`).then((r) => r.json()),
        fetch('/api/departments').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);

      setCourses(cRes.courses || []);
      setDepartments(dRes.departments || []);
      if (uRes?.user) {
        setCurrentUser(uRes.user);
        if (uRes.user.departmentId) {
          setDepartmentId(String(uRes.user.departmentId));
          setNewDeptId(String(uRes.user.departmentId));
        } else if (uRes.user.departmentCode && dRes.departments) {
          const matched = dRes.departments.find((d: any) => d.code === uRes.user.departmentCode);
          if (matched) {
            setDepartmentId(String(matched.id));
            setNewDeptId(String(matched.id));
          }
        }
      }
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [departmentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses();
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setCreating(true);

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          title: newTitle,
          units: newUnits,
          departmentId: newDeptId,
          description: newDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to create course.');
        setCreating(false);
        return;
      }

      setModalOpen(false);
      setNewCode('');
      setNewTitle('');
      setNewUnits(3);
      setNewDescription('');
      await fetchCourses();
    } catch (err) {
      setModalError('Connection error.');
    } finally {
      setCreating(false);
    }
  };

  const canCreateCourse = currentUser?.role === 'DepartmentHead';
  const canManageSyllabus =
    currentUser?.role === 'Educator' ||
    currentUser?.role === 'DepartmentHead';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Curriculum Catalog
            </span>
            {currentUser?.departmentCode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200 shadow-2xs">
                Department: [{currentUser.departmentCode}] {currentUser.departmentName || currentUser.departmentCode}
              </span>
            )}
            <span className="text-xs text-slate-500 font-medium">USJ-R Academic Offerings</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Course & Subject Directory
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {canManageSyllabus && (
            <Link
              href="/syllabi/new"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm transition-all flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create / Upload Syllabus</span>
            </Link>
          )}
          {canCreateCourse && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Search and Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or title..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
          />
        </form>

        {currentUser?.role !== 'Admin' ? (
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-nowrap shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department:</span>
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

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => {
          const activeSyllabus = course.syllabi?.[0];
          return (
            <div
              key={course.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#005A36] transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#005A36] font-extrabold text-sm">
                      {course.code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                      {course.units ?? 3} Units
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-bold">
                    [{course.department?.code}] {course.department?.name}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{course.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {course.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-slate-600">
                  <span className="font-semibold">Lec: {course.lecHours ?? 3}h • Lab: {course.labHours ?? 0}h</span>
                  <span className="text-slate-500">Prereq: <strong className="text-slate-700">{course.prerequisite || 'None'}</strong></span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  {activeSyllabus ? (
                    <span className="text-[#005A36] font-bold flex items-center space-x-1">
                      <History className="w-3.5 h-3.5" />
                      <span>Version {activeSyllabus.currentVersionNumber}</span>
                    </span>
                  ) : (
                    <span className="text-amber-700 italic text-[11px] font-semibold">
                      {currentUser?.role === 'Student' && !course.isEnrolled ? 'Enrollment Required' : 'No active syllabus'}
                    </span>
                  )}
                </div>

                {activeSyllabus ? (
                  <Link
                    href={`/syllabi/${activeSyllabus.id}`}
                    className="text-[#005A36] hover:underline font-bold"
                  >
                    View Syllabus →
                  </Link>
                ) : currentUser?.role === 'Student' ? (
                  <span className="text-slate-400 text-[11px] italic">Not Enrolled</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl border border-slate-200 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-base text-[#005A36]">Add New Course / Subject</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Course code (e.g. CPE101)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 uppercase focus:outline-none focus:border-[#005A36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Units</label>
                  <select
                    value={newUnits}
                    onChange={(e) => setNewUnits(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-[#005A36]"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Course title"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic Department</label>
                <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-[#005A36] text-xs font-extrabold font-mono shadow-2xs">
                    [{currentUser?.departmentCode || '...'}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.departmentName || (currentUser?.departmentCode ? `${currentUser.departmentCode} Department` : 'Assigned Department')}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-medium block">
                      Recognized automatically from account &bull; Locked
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Course scope, learning goals, and requirements..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm"
                >
                  {creating ? 'Saving...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
