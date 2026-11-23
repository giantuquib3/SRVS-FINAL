'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Eye,
  RefreshCw,
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
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
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
      const [meRes, sylRes, deptRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/syllabi?status=ALL').then((r) => r.json()),
        fetch('/api/departments').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (meRes?.user) setCurrentUser(meRes.user);
      setSyllabi(sylRes.syllabi || []);
      if (deptRes?.departments?.length) setDepartmentsList(deptRes.departments);
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
      const cilos: any[] = Array.isArray(content.cilos) ? content.cilos : [];
      const weeklyPlan: any[] = Array.isArray(content.weeklyPlan) ? content.weeklyPlan : [];
      const owatGrading: any[] = Array.isArray(content.owatGrading) ? content.owatGrading : [];
      const coursePolicies: any[] = Array.isArray(content.coursePolicies) ? content.coursePolicies : [];
      const piloPeoMapping: any[] = Array.isArray(content.piloPeoMapping) ? content.piloPeoMapping : [];
      const integrationSchemes: any[] = Array.isArray(content.integrationSchemes) ? content.integrationSchemes : [];
      const references: string[] = Array.isArray(content.references) ? content.references.filter((r: string) => r && r.trim()) : [];
      const units = subject.units ?? 3;
      const lecHours = subject.lecHours ?? 3;
      const labHours = subject.labHours ?? 0;

      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject.code} - ${subject.title} Syllabus</title>
  <style>
    body { font-family: Cambria, Georgia, "Times New Roman", serif; color: #000; max-width: 920px; margin: 28px auto; padding: 0 24px; line-height: 1.45; font-size: 13px; }
    .title { text-align: center; margin-bottom: 16px; }
    .title h1 { margin: 2px 0; font-size: 18px; text-transform: uppercase; }
    .title p { margin: 2px 0; font-size: 14px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
    th.bar { background: #D9D9D9; font-weight: bold; text-transform: uppercase; }
    th.sub { background: #BFBFBF; font-weight: bold; }
    table.owat, table.owat th, table.owat td { border-color: #B06C6C; }
  </style>
</head>
<body>
  <div class="title">
    <h1>SCHOOL OF ENGINEERING</h1>
    <p>${syl.department?.name || item.departmentId}</p>
    <div style="font-size:12px;">${content.curriculumYear || 'Curriculum 2022'} • Version ${item.currentVersionNumber || 1}</div>
  </div>

  <table>
    <tbody>
      <tr><td style="width:25%;background:#D9D9D9;font-weight:bold;">COURSE NUMBER</td><td><strong>${subject.code || ''}</strong></td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">COURSE TITLE</td><td><strong>${subject.title || ''}</strong></td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">COURSE UNITS</td><td>${units} Units (${lecHours} hrs Lecture, ${labHours} hrs Lab)</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">PRE-REQUISITES</td><td>${subject.prerequisite || 'None'}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">CO-REQUISITES</td><td>${content.coRequisites || 'None'}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">TERM OFFERED</td><td>${content.termOffered || item.semester || ''}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">PROGRAM/S</td><td>${content.programs || syl.department?.name || ''}</td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th class="bar" style="text-align:center;">COURSE OVERVIEW</th></tr></thead>
    <tbody><tr><td>${content.courseDescription || subject.description || ''}</td></tr></tbody>
  </table>

  ${
    piloPeoMapping.length > 0
      ? `<table>
      <thead>
        <tr><th class="bar" colspan="4">Mapping of Program Intended Learning Outcomes (PILO) and Program Educational Objectives (PEO)</th></tr>
        <tr><th class="sub">Program Intended Learning Outcomes (PILO)</th><th class="sub" style="text-align:center;">PEO 1</th><th class="sub" style="text-align:center;">PEO 2</th><th class="sub" style="text-align:center;">PEO 3</th></tr>
      </thead>
      <tbody>${piloPeoMapping
        .map(
          (r) =>
            `<tr><td>${r.letter}. ${r.outcome || ''}</td><td style="text-align:center;">${r.peo1 ? '✔' : ''}</td><td style="text-align:center;">${r.peo2 ? '✔' : ''}</td><td style="text-align:center;">${r.peo3 ? '✔' : ''}</td></tr>`
        )
        .join('')}</tbody>
    </table>`
      : ''
  }

  ${
    cilos.length > 0
      ? `<table>
      <thead><tr><th class="bar">COURSE INTENDED LEARNING OUTCOMES</th><th class="bar">MAPPED PILO</th><th class="bar" style="text-align:center;">PEO 1</th><th class="bar" style="text-align:center;">PEO 2</th><th class="bar" style="text-align:center;">PEO 3</th></tr></thead>
      <tbody>${cilos
        .map(
          (c, i) =>
            `<tr><td>${i === 0 ? '<em>Within and upon completion of this course, the students are expected to:</em><br/>' : ''}${c.description || ''}</td><td style="text-align:center;">${c.mappedPilo || ''}</td><td style="text-align:center;">${c.peo1 ? '✔' : ''}</td><td style="text-align:center;">${c.peo2 ? '✔' : ''}</td><td style="text-align:center;">${c.peo3 ? '✔' : ''}</td></tr>`
        )
        .join('')}</tbody>
    </table>`
      : ''
  }

  ${
    weeklyPlan.some((w) => w.timeFrame || w.intendedLearningOutcome || w.learningContent)
      ? `<table>
      <thead><tr><th class="bar">Time Frame</th><th class="bar">Intended Learning Outcome</th><th class="bar">Assessment</th><th class="bar">Teaching - Learning Activities</th><th class="bar">Learning Content</th><th class="bar">Resources</th></tr></thead>
      <tbody>${weeklyPlan
        .map(
          (w) =>
            `<tr><td>${w.timeFrame || ''}</td><td>${w.intendedLearningOutcome || ''}</td><td>${w.assessment || ''}</td><td>${w.teachingLearningActivities || ''}</td><td>${w.learningContent || ''}</td><td>${w.resources || ''}</td></tr>`
        )
        .join('')}</tbody>
    </table>`
      : ''
  }

  ${
    integrationSchemes.length > 0
      ? `<table>
      <thead><tr><th class="bar">INTEGRATION SCHEMES</th></tr></thead>
      <tbody><tr><td><ul>${integrationSchemes
        .map((it) => `<li><em><strong>${it.coreValue || ''}</strong> ${it.description || ''}</em></li>`)
        .join('')}</ul></td></tr></tbody>
    </table>`
      : ''
  }

  ${
    owatGrading.length > 0
      ? `<table class="owat">
      <thead>
        <tr><th class="bar" colspan="4">OWAT (OUTCOME WEIGHT ASSESSMENT TABLE) GRADING SYSTEM</th></tr>
        <tr><th>Outcomes</th><th>Total Weight</th><th>Points Scoring</th><th>Assessment Tool</th></tr>
      </thead>
      <tbody>${owatGrading
        .map((g) => {
          const items = Array.isArray(g.items) && g.items.length > 0 ? g.items : [{ points: '', tool: '' }];
          return items
            .map(
              (it: any, idx: number) =>
                `<tr>${
                  idx === 0
                    ? `<td rowspan="${items.length}">${g.outcome || ''}</td><td rowspan="${items.length}" style="text-align:center;vertical-align:middle;">${g.totalWeight || 0}%</td>`
                    : ''
                }<td style="text-align:center;">${it.points || ''}</td><td>${it.tool || ''}</td></tr>`
            )
            .join('');
        })
        .join('')}</tbody>
    </table>`
      : ''
  }

  ${
    references.length > 0
      ? `<table><thead><tr><th class="bar">REFERENCES</th></tr></thead><tbody><tr><td><ol>${references
          .map((r) => `<li>${r}</li>`)
          .join('')}</ol></td></tr></tbody></table>`
      : ''
  }

  ${
    coursePolicies.length > 0
      ? `<table>
      <thead><tr><th class="bar">COURSE POLICIES AND STANDARDS</th></tr></thead>
      <tbody><tr><td><p><em>(Specific classroom guidelines of the course and the teacher, please describe policy as to:)</em></p>${coursePolicies
        .map(
          (p) =>
            `<p><strong>${p.section || ''}</strong></p><ol>${(p.items || []).map((x: string) => `<li>${x}</li>`).join('')}</ol>`
        )
        .join('')}</td></tr></tbody>
    </table>`
      : ''
  }
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
            Browse, view electronically, and download course syllabi across all academic departments.
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

        {departmentsList.map((dept) => {
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
            <option value="">All Academic Departments</option>
            {departmentsList.map((d) => (
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
                    <Link
                      href={`/syllabi/${item.id}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#005A36]" />
                      <span>View Syllabus</span>
                    </Link>

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
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4"
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
