'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Eye,
  RefreshCw,
  Layers,
  Download,
  ExternalLink,
  X,
  FileText,
  Search,
  Filter,
  Building2,
} from 'lucide-react';
import { DEPARTMENTS } from '@/lib/departments';
import { roleLabel } from '@/lib/status';

export default function InstitutionalSyllabusViewerPage() {
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    courseCode: string;
    courseTitle: string;
    syllabusId: number;
  } | null>(null);

  const fetchRepositoryData = async () => {
    setLoading(true);
    try {
      const [meRes, sylRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/syllabi?status=ALL').then((r) => r.json()),
      ]);
      if (meRes?.user) setCurrentUser(meRes.user);
      setSyllabi(sylRes.syllabi || []);
    } catch (err) {
      console.error('Error fetching institutional syllabi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositoryData();
  }, []);

  const filteredSyllabi = syllabi.filter((s) => {
    if (departmentFilter && s.departmentId !== departmentFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (s.subject?.code || s.course?.code || '').toLowerCase();
    const title = (s.subject?.title || s.course?.title || '').toLowerCase();
    const inst = (s.instructor?.fullName || '').toLowerCase();
    const fileName = (s.latestVersion?.fileName || '').toLowerCase();
    return code.includes(q) || title.includes(q) || inst.includes(q) || fileName.includes(q);
  });

  const handleDownloadFile = async (item: any) => {
    const subject = item.subject || item.course || {};
    const latestVersion = item.latestVersion;
    const defaultName = latestVersion?.fileName || `${subject.code || 'Course'}_Syllabus_v${item.currentVersionNumber || 1}.html`;

    // If an uploaded PDF/document fileUrl exists, download it directly
    if (latestVersion?.fileUrl) {
      const link = document.createElement('a');
      link.href = latestVersion.fileUrl;
      link.download = latestVersion.fileName || `${subject.code || 'Course'}_Syllabus.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Otherwise, fetch the syllabus content and download a formatted document file
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/syllabi/${item.id}`);
      const data = await res.json();
      const syl = data.syllabus || item;
      const ver = data.currentVersion || latestVersion || {};
      const content = ver.content || {};
      const outcomes: string[] = content.learningOutcomes || [];
      const topics: any[] = content.topics || [];
      const grading: any[] = content.gradingSystem || [];
      const references: string[] = content.references || [];

      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject.code} - ${subject.title} Syllabus</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; max-width: 840px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #005A36; padding-bottom: 16px; margin-bottom: 24px; }
    .dept { color: #005A36; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
    h1 { margin: 8px 0; font-size: 24px; color: #0f172a; }
    .meta { font-size: 13px; color: #475569; }
    h2 { font-size: 15px; color: #005A36; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; font-weight: bold; }
    ul { padding-left: 20px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="dept">University of San Jose - Recoletos • ${syl.department?.name || item.departmentId}</div>
    <h1>${subject.code}: ${subject.title}</h1>
    <div class="meta">
      Term: ${item.semester} • Academic Year: ${item.academicYear} • Faculty: ${item.instructor?.fullName || subject.professorName || 'Faculty'} • Version ${item.currentVersionNumber}
    </div>
  </div>

  <h2>Course Description</h2>
  <p style="font-size:13px;">${content.courseDescription || subject.description || 'Standard departmental course syllabus.'}</p>

  ${outcomes.length > 0 ? `<h2>Course Learning Outcomes</h2><ul>${outcomes.map((o) => `<li>${o}</li>`).join('')}</ul>` : ''}

  ${
    topics.length > 0
      ? `<h2>Weekly Course Outline</h2>
      <table>
        <thead><tr><th>Week</th><th>Topic</th><th>Activities / Assessment</th></tr></thead>
        <tbody>${topics
          .map(
            (t) =>
              `<tr><td>Week ${t.week || ''}</td><td><strong>${t.title || ''}</strong><br/>${t.description || ''}</td><td>${t.activities || ''} ${t.assessments ? `(${t.assessments})` : ''}</td></tr>`
          )
          .join('')}</tbody>
      </table>`
      : ''
  }

  ${
    grading.length > 0
      ? `<h2>Grading System</h2>
      <table>
        <thead><tr><th>Component</th><th>Weight</th><th>Description</th></tr></thead>
        <tbody>${grading
          .map((g) => `<tr><td>${g.component || ''}</td><td>${g.percentage || 0}%</td><td>${g.description || ''}</td></tr>`)
          .join('')}</tbody>
      </table>`
      : ''
  }

  ${references.length > 0 ? `<h2>References</h2><ul>${references.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName.endsWith('.pdf') ? defaultName.replace(/\.pdf$/i, '.html') : defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download syllabus file:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
              {roleLabel(currentUser?.role) || 'Institutional Syllabus Directory'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005A36] border border-emerald-200">
              All Departments • View & Download Access
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
            Departmental Syllabus Files Repository
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, view, and download course syllabus files uploaded across all engineering departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/subjects"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#00472A] text-white shadow-sm transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FEF08A]" />
            <span>Courses Directory</span>
          </Link>
          <button
            onClick={fetchRepositoryData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005A36] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Department Quick Filter Cards (Replaces approval process status counters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          type="button"
          onClick={() => setDepartmentFilter('')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            departmentFilter === ''
              ? 'bg-[#005A36] text-white border-[#005A36] shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-[#005A36]'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              departmentFilter === '' ? 'text-[#FEF08A]' : 'text-slate-400'
            }`}
          >
            All Departments
          </span>
          <p className="text-2xl font-black mt-0.5">{syllabi.length}</p>
          <span className={`text-[11px] ${departmentFilter === '' ? 'text-emerald-100' : 'text-slate-500'}`}>
            Total Files
          </span>
        </button>

        {DEPARTMENTS.map((dept) => {
          const count = syllabi.filter((s) => s.departmentId === dept.id).length;
          const isSelected = departmentFilter === dept.id;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDepartmentFilter(isSelected ? '' : dept.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#005A36] text-white border-[#005A36] shadow-sm'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-[#005A36]'
              }`}
            >
              <span
                className={`text-[10px] font-extrabold font-mono uppercase tracking-wider block ${
                  isSelected ? 'text-[#FEF08A]' : 'text-[#005A36]'
                }`}
              >
                [{dept.code}]
              </span>
              <p className="text-2xl font-black mt-0.5">{count}</p>
              <span
                className={`text-[11px] truncate block ${
                  isSelected ? 'text-emerald-100' : 'text-slate-500'
                }`}
                title={dept.name}
              >
                {dept.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Department Filter Bar (Process status filter removed) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search syllabus files by course code, course title, file name, or faculty..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full sm:w-64 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
          >
            <option value="">All Engineering Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                [{d.code}] {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Syllabi Files Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
            <p className="text-slate-500 text-xs font-semibold">Loading uploaded syllabus files...</p>
          </div>
        </div>
      ) : filteredSyllabi.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No Syllabus Files Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No uploaded course syllabus files matched the selected department or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSyllabi.map((item: any) => {
            const subject = item.subject || item.course || {};
            const latestVersion = item.latestVersion;
            const pdfUrl = latestVersion?.fileUrl;
            const displayFileName =
              latestVersion?.fileName || `${subject.code}_Syllabus_v${item.currentVersionNumber}.pdf`;

            return (
              <div
                key={item.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-[#005A36] transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#005A36] text-sm font-extrabold tracking-wide">
                        {subject.code}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                        {subject.units || 3} Units
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      <Building2 className="w-3.5 h-3.5 text-[#005A36]" />
                      <span className="font-mono">[{item.departmentId}]</span>
                      <span className="hidden sm:inline text-[11px] font-semibold">
                        {item.department?.name || item.departmentId}
                      </span>
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{subject.title}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Uploaded by:{' '}
                      <strong className="text-slate-900 capitalize">
                        {item.instructor?.fullName || subject.professorName || 'Faculty'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {item.semester}, {item.academicYear}
                      </span>
                    </span>
                  </div>

                  {/* File Attachment Row */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#005A36] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate" title={displayFileName}>
                          {displayFileName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {pdfUrl ? 'Uploaded PDF Document' : 'Structured Syllabus Document'} • Version{' '}
                          {item.currentVersionNumber}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {pdfUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPdfPreviewModal({
                            isOpen: true,
                            fileUrl: pdfUrl,
                            fileName: displayFileName,
                            courseCode: subject.code,
                            courseTitle: subject.title,
                            syllabusId: item.id,
                          })
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#005A36]" />
                        <span>View File</span>
                      </button>
                    ) : (
                      <Link
                        href={`/syllabi/${item.id}`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#005A36]" />
                        <span>View File</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDownloadFile(item)}
                      disabled={downloadingId === item.id}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FEF08A]" />
                      <span>{downloadingId === item.id ? 'Downloading...' : 'Download File'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF Preview Modal */}
      {pdfPreviewModal?.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPdfPreviewModal(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#005A36] text-white flex items-center justify-between border-b-2 border-[#C99700]">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-[#FEF08A]" />
                <div>
                  <h3 className="text-sm font-bold">
                    [{pdfPreviewModal.courseCode}] {pdfPreviewModal.courseTitle}
                  </h3>
                  <p className="text-[11px] text-emerald-100">{pdfPreviewModal.fileName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={pdfPreviewModal.fileUrl}
                  download={pdfPreviewModal.fileName}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <a
                  href={pdfPreviewModal.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>New Tab</span>
                </a>
                <button
                  onClick={() => setPdfPreviewModal(null)}
                  className="p-1.5 rounded-lg hover:bg-white/15 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                src={pdfPreviewModal.fileUrl}
                title={pdfPreviewModal.fileName}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
