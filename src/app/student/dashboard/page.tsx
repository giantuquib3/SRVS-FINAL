'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Eye,
  RefreshCw,
  Layers
} from 'lucide-react';

export default function StudentDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading your enrolled subjects...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const enrolledSubjects = data?.enrolledSubjects || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Student Academic Portal
            </span>
            <span className="text-xs text-slate-500 font-medium">USJ-R Enrolled Courses</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            My Enrolled Subjects & Syllabi
          </h1>
        </div>

        <button
          onClick={fetchStudentData}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500">Total Enrolled Subjects</span>
          <p className="text-3xl font-black text-[#005A36]">{stats.enrolledCount ?? 0}</p>
          <span className="text-[11px] text-slate-400">Current Academic Term</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500">Available Published Syllabi</span>
          <p className="text-3xl font-black text-[#CA8A04]">{stats.availableSyllabiCount ?? 0}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Approved & available for viewing</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-500">Academic Status</span>
          <div className="flex items-center space-x-2 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                enrolledSubjects.length > 0 ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span
              className={`text-sm font-bold ${
                enrolledSubjects.length > 0 ? 'text-[#005A36]' : 'text-slate-500'
              }`}
            >
              {enrolledSubjects.length > 0 ? 'Active Enrollment' : 'No Active Enrollments'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {enrolledSubjects.length > 0
              ? `${enrolledSubjects.length} enrolled ${enrolledSubjects.length === 1 ? 'course' : 'courses'}`
              : 'Awaiting subject enrollment'}
          </span>
        </div>
      </div>

      {/* Dynamic Enrolled Subjects Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#005A36]" />
            <span>MY ENROLLED SUBJECTS</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Authorized courses linked to your student account
          </span>
        </div>

        {enrolledSubjects.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No Enrolled Subjects Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You are not currently enrolled in any subjects. When the Department Head or Administrator enrolls you, your course syllabi will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enrolledSubjects.map((item: any) => {
              const subject = item.subject || item.course || {};
              const activeSyllabus = item.subject?.syllabi?.[0] || item.course?.syllabi?.[0];
              return (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-[#005A36] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#005A36] text-sm font-extrabold tracking-wide">
                          {subject.code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                          {subject.units || 3} Units
                        </span>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                        Section {item.section}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">{subject.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {subject.description || 'No course description available.'}
                    </p>

                    {/* Academic Subject Details: Units, Lec, Lab, Prerequisite */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Contact Hours</span>
                        <span className="font-bold text-slate-700">Lec: {subject.lecHours ?? 3}h • Lab: {subject.labHours ?? 0}h</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Prerequisite</span>
                        <span className="font-bold text-slate-700">{subject.prerequisite || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Year & Term</span>
                        <span className="font-bold text-slate-700">{subject.yearLevel || '1st Year'}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 pt-1">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{subject.department?.name || item.course?.department?.name}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.semester}, {item.academicYear}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {activeSyllabus ? (
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                            Current Version
                          </span>
                          <span className="text-xs font-bold text-[#005A36]">
                            Version {activeSyllabus.currentVersionNumber} (Approved)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold italic">
                          Syllabus revision in progress
                        </span>
                      )}
                    </div>

                    {activeSyllabus ? (
                      <Link
                        href={`/syllabi/${activeSyllabus.id}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#FEF08A]" />
                        <span>View Syllabus</span>
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        Not Available
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
