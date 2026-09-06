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
  PlusCircle,
  Eye,
  History
} from 'lucide-react';

export default function DeptHeadDashboard() {
  const [data, setData] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchDeptData();
  }, []);

  const stats = data?.stats || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Curriculum Oversight
            </span>
            <span className="text-xs text-slate-500 font-medium">Department Head Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Department Head Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDeptData}
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
            <span>Review Approvals {stats.pendingApprovals ? `(${stats.pendingApprovals})` : ''}</span>
          </Link>
          <Link
            href="/syllabi/new"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4 text-[#FEF08A]" />
            <span>Create / Upload Syllabus</span>
          </Link>
          <Link
            href="/courses"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4 text-[#005A36]" />
            <span>Courses</span>
          </Link>
        </div>
      </div>

      {/* Real-time Dynamic Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Courses</span>
          <p className="text-2xl font-black text-[#005A36]">{stats.totalCourses ?? 0}</p>
        </div>

        <Link
          href="/department/syllabus-approvals"
          className="bg-white hover:bg-amber-50/50 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Approvals</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-2xl font-black text-[#854D0E]">{stats.pendingApprovals ?? 0}</p>
        </Link>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved</span>
          <p className="text-2xl font-black text-emerald-700">{stats.approvedSyllabi ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Drafts</span>
          <p className="text-2xl font-black text-slate-600">{stats.draftSyllabi ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Missing Syllabi</span>
          <p className="text-2xl font-black text-rose-600">{stats.missingSyllabi ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dept Faculty</span>
          <p className="text-2xl font-black text-slate-800">{stats.educatorsCount ?? 0}</p>
        </div>
      </div>

      {/* Department Course Syllabus Coverage Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#005A36]" />
              <span>Department Course Syllabus Coverage Matrix</span>
            </h2>
            <p className="text-xs text-slate-500">
              Live status of each course in your department with missing indicators
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
                            activeSyllabus.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : activeSyllabus.status === 'Submitted'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {activeSyllabus.status}
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
    </div>
  );
}
