'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileEdit,
  History,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function EducatorDashboard() {
  const [data, setData] = useState<any>(null);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchEducatorData = async () => {
    setLoading(true);
    try {
      const [statsRes, syllabiRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/syllabi?mySyllabi=true'),
      ]);

      const statsData = await statsRes.json();
      const syllabiData = await syllabiRes.json();

      setData(statsData);
      setSyllabi(syllabiData.syllabi || []);
    } catch (err) {
      console.error('Error fetching educator data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducatorData();
  }, []);

  const handleSubmitSyllabus = async (id: string) => {
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/syllabi/${id}/submit`, { method: 'POST' });
      if (res.ok) {
        await fetchEducatorData();
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
    return s.status === statusFilter;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              Faculty Workspace
            </span>
            <span className="text-xs text-slate-500 font-medium">USJ-R Course Instructors</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Faculty Syllabus Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchEducatorData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/courses"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4 text-[#005A36]" />
            <span>Course Catalog</span>
          </Link>
        </div>
      </div>

      {/* Dynamic Status Breakdown Tiles (Clickable to Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'ALL'
              ? 'border-[#005A36] bg-emerald-50/50 ring-2 ring-[#005A36]/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">All Syllabi</span>
          <p className="text-2xl font-black text-[#005A36] mt-1">{stats.totalMySyllabi ?? 0}</p>
        </button>

        <button
          onClick={() => setStatusFilter('Draft')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'Draft'
              ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Drafts</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.draftCount ?? 0}</p>
        </button>

        <button
          onClick={() => setStatusFilter('Submitted')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'Submitted'
              ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-600/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Submitted</span>
          <p className="text-2xl font-black text-sky-700 mt-1">{stats.submittedCount ?? 0}</p>
        </button>

        <button
          onClick={() => setStatusFilter('Approved')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'Approved'
              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approvedCount ?? 0}</p>
        </button>

        <button
          onClick={() => setStatusFilter('Rejected')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border shadow-sm ${
            statusFilter === 'Rejected'
              ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-600/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected</span>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.rejectedCount ?? 0}</p>
        </button>
      </div>

      {/* Syllabi Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#005A36]" />
              <span>My Course Syllabi</span>
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredSyllabi.length} syllabi {statusFilter !== 'ALL' && `filtered by: ${statusFilter}`}
            </p>
          </div>
        </div>

        {filteredSyllabi.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No syllabi found in this category.</p>
            <p className="text-xs text-slate-500">Create your course syllabus to begin.</p>
            <Link
              href="/courses"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-[#FEF08A]" />
              <span>Browse Courses</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Course Title</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Current Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSyllabi.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#005A36]">{s.course.code}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{s.course.title}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {s.semester}, {s.academicYear}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        <History className="w-3 h-3 text-[#005A36]" />
                        <span>v{s.currentVersionNumber}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : s.status === 'Submitted'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : s.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      <Link
                        href={`/syllabi/${s.id}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3 h-3 text-[#005A36]" />
                        <span>View</span>
                      </Link>

                      {s.status !== 'Submitted' && (
                        <Link
                          href={`/syllabi/${s.id}/edit`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] transition-colors"
                        >
                          <FileEdit className="w-3 h-3 text-[#CA8A04]" />
                          <span>Edit</span>
                        </Link>
                      )}

                      <Link
                        href={`/syllabi/${s.id}/versions`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <History className="w-3 h-3" />
                        <span>Versions</span>
                      </Link>

                      {s.status === 'Draft' && (
                        <button
                          onClick={() => handleSubmitSyllabus(s.id)}
                          disabled={submittingId === s.id}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors cursor-pointer shadow-sm"
                        >
                          <Send className="w-3 h-3 text-[#FEF08A]" />
                          <span>Submit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
