'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Maximize2,
  Minimize2,
  List,
  ChevronUp,
  ChevronDown,
  FileText,
  BookOpen,
  X,
} from 'lucide-react';
import {
  ElectronicSyllabusContent,
  USJR_INSTITUTIONAL_HEADER,
  normalizeSyllabusContent,
} from '@/lib/syllabus-template';
import { syllabusStatusLabel, roleLabel, formatVersionLabel, formatShortVersionLabel } from '@/lib/status';

interface ElectronicSyllabusViewerProps {
  syllabus: {
    id?: number;
    academicYear?: string;
    semester?: string;
    section?: string;
    currentVersionNumber?: number;
    departmentId?: string;
    department?: { code?: string; name?: string };
    subject?: {
      code?: string;
      title?: string;
      description?: string | null;
      units?: number;
      lecHours?: number;
      labHours?: number;
      prerequisite?: string | null;
      yearLevel?: string | null;
      semester?: string | null;
      professorName?: string | null;
      departmentId?: string;
    };
    course?: {
      code?: string;
      title?: string;
      description?: string | null;
      units?: number;
      lecHours?: number;
      labHours?: number;
      prerequisite?: string | null;
      yearLevel?: string | null;
      semester?: string | null;
      professorName?: string | null;
      departmentId?: string;
    };
    instructor?: { fullName?: string; email?: string; academicRank?: string } | null;
  };
  version?: {
    versionNumber?: number;
    approvalStatus?: string;
    changeSummary?: string;
    createdAt?: string;
    editor?: { fullName?: string; role?: string } | null;
    reviewedBy?: { fullName?: string; role?: string } | null;
    reviewedAt?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    content?: any;
  } | null;
  contentOverride?: ElectronicSyllabusContent | null;
  versionsHistory?: any[];
  hideApprovalStatus?: boolean;
  defaultZoom?: number;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function ElectronicSyllabusViewer({
  syllabus,
  version,
  contentOverride,
  versionsHistory = [],
  hideApprovalStatus = false,
  defaultZoom = 100,
}: ElectronicSyllabusViewerProps) {
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNavSidebar, setShowNavSidebar] = useState(true);
  const [activeSection, setActiveSection] = useState('sec-course-details');
  const [viewMode, setViewMode] = useState<'electronic' | 'legacy-pdf'>('electronic');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const subject = syllabus.subject || syllabus.course || {};
  const deptCode = syllabus.department?.code || syllabus.departmentId || subject.departmentId || '';
  const deptName = syllabus.department?.name || deptCode || 'Academic Department';

  const content = useMemo(() => {
    if (contentOverride) return contentOverride;
    return normalizeSyllabusContent(version?.content, subject, deptName);
  }, [contentOverride, version?.content, subject, deptName]);

  const hasOutcomes = content.cilos.length > 0;
  const hasOutline = content.weeklyPlan.length > 0;
  const hasGrading =
    content.owatGrading.length > 0 ||
    Boolean(content.assessmentOfOutcomes?.trim()) ||
    Boolean(content.criteriaStandards?.trim());
  const hasReferences = content.references.length > 0;
  const hasPolicies = content.coursePolicies.length > 0;

  const sections = useMemo(() => {
    const list = [
      { id: 'sec-course-details', label: 'Course Details' },
      { id: 'sec-description', label: 'Course Description' },
    ];
    if (hasOutcomes) list.push({ id: 'sec-outcomes', label: 'Learning Outcomes' });
    if (hasOutline) list.push({ id: 'sec-outline', label: 'Course Outline' });
    if (hasGrading) list.push({ id: 'sec-grading', label: 'Grading & Assessment' });
    if (hasReferences) list.push({ id: 'sec-references', label: 'References' });
    if (hasPolicies) list.push({ id: 'sec-policies', label: 'Course Policies' });
    list.push({ id: 'sec-history', label: 'Remarks & History' });
    return list;
  }, [hasOutcomes, hasOutline, hasGrading, hasReferences, hasPolicies]);

  const trimmedQuery = searchQuery.trim();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const [matchCount, setMatchCount] = useState(0);
  useEffect(() => {
    if (!trimmedQuery || !scrollContainerRef.current) {
      setMatchCount(0);
      setActiveMatchIdx(0);
      return;
    }
    const marks = scrollContainerRef.current.querySelectorAll('mark[data-syllabus-match="true"]');
    setMatchCount(marks.length);
    setActiveMatchIdx(0);
    if (marks.length > 0) {
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [trimmedQuery, content, viewMode]);

  const jumpToMatch = (direction: 'next' | 'prev') => {
    if (!scrollContainerRef.current || matchCount === 0) return;
    const marks = scrollContainerRef.current.querySelectorAll('mark[data-syllabus-match="true"]');
    if (marks.length === 0) return;
    const nextIdx =
      direction === 'next'
        ? (activeMatchIdx + 1) % marks.length
        : (activeMatchIdx - 1 + marks.length) % marks.length;
    setActiveMatchIdx(nextIdx);
    marks[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = scrollContainerRef.current?.querySelector(`#${sectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const highlight = (text: string | number | null | undefined): React.ReactNode => {
    const str = text == null ? '' : String(text);
    if (!trimmedQuery || !str) return str;
    const parts = str.split(new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === trimmedQuery.toLowerCase() ? (
        <mark
          key={i}
          data-syllabus-match="true"
          className="bg-[#FEF08A] text-slate-950 font-semibold px-0.5 rounded-sm"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  };

  const totalGradingWeight = content.owatGrading.reduce((sum, g) => sum + (Number(g.totalWeight) || 0), 0);
  const assignedInstructor =
    subject.professorName ||
    content.subjectSnapshot?.professorName ||
    syllabus.instructor?.fullName ||
    'To be assigned';
  const units = subject.units ?? content.subjectSnapshot?.units ?? 3;
  const lecHours = subject.lecHours ?? content.subjectSnapshot?.lecHours ?? 3;
  const labHours = subject.labHours ?? content.subjectSnapshot?.labHours ?? 0;
  const prerequisite = subject.prerequisite || content.subjectSnapshot?.prerequisite || 'None';
  const yearLevel = subject.yearLevel || content.subjectSnapshot?.yearLevel || '1st Year';
  const catalogSemester = subject.semester || content.subjectSnapshot?.semester || syllabus.semester || '1st Semester';

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[70] bg-slate-100 flex flex-col'
    : 'rounded-2xl border border-slate-200 bg-slate-100/80 shadow-sm overflow-hidden flex flex-col';

  return (
    <div className={containerClasses}>
      {/* Interactive Viewer Toolbar */}
      <div className="bg-[#005A36] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#C99700] print:hidden shrink-0">
        {/* Left: Nav toggle + Document Label */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNavSidebar((v) => !v)}
            title="Toggle Section Navigation"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showNavSidebar ? 'bg-white/20 text-[#FEF08A]' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sections</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            <BookOpen className="w-4 h-4 text-[#FEF08A] shrink-0" />
            <span className="font-bold tracking-tight">
              {subject.code || 'Course'} Electronic Syllabus
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/15 text-[#FEF08A] font-mono text-[10px] font-bold">
              {version ? formatShortVersionLabel(version) : `v${syllabus.currentVersionNumber || 1}`}
            </span>
          </div>

          {version?.fileUrl && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('electronic')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  viewMode === 'electronic' ? 'bg-[#C99700] text-slate-950' : 'text-emerald-100 hover:text-white'
                }`}
              >
                Electronic View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('legacy-pdf')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors flex items-center gap-1 ${
                  viewMode === 'legacy-pdf' ? 'bg-[#C99700] text-slate-950' : 'text-emerald-100 hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Attached File</span>
              </button>
            </div>
          )}
        </div>

        {/* Center: In-Document Search */}
        {viewMode === 'electronic' && (
          <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-2.5 py-1 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in syllabus..."
              className="bg-transparent text-xs text-white placeholder:text-emerald-100/70 focus:outline-none w-full"
            />
            {trimmedQuery && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono text-[#FEF08A] px-1">
                  {matchCount > 0 ? `${activeMatchIdx + 1}/${matchCount}` : '0'}
                </span>
                <button
                  type="button"
                  onClick={() => jumpToMatch('prev')}
                  className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                  title="Previous match"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMatch('next')}
                  className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                  title="Next match"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right: Zoom & Full-Screen */}
        <div className="flex items-center gap-1.5">
          {viewMode === 'electronic' && (
            <div className="flex items-center bg-white/10 rounded-lg px-1 py-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(75, z - 10))}
                className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 min-w-[42px] text-center">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom !== 100 && (
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer text-[#FEF08A]"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 flex items-center gap-1 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Full-Screen (Esc)' : 'Full-Screen View'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewer Body */}
      <div className="flex flex-1 min-h-0">
        {/* Section Navigation Sidebar */}
        {viewMode === 'electronic' && showNavSidebar && (
          <aside className="w-56 shrink-0 bg-white border-r border-slate-200 p-3 space-y-1 overflow-y-auto hidden lg:block print:hidden">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 pb-1.5">
              Document Sections
            </p>
            {sections.map((sec, idx) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                  activeSection === sec.id
                    ? 'bg-emerald-50 text-[#005A36] border border-emerald-200 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-[10px] font-mono text-slate-400">{idx + 1}.</span>
                <span className="truncate">{sec.label}</span>
              </button>
            ))}
          </aside>
        )}

        {/* Document Viewport */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-auto p-4 sm:p-6 ${isFullscreen ? 'h-full' : 'max-h-[82vh]'}`}
        >
          {viewMode === 'legacy-pdf' && version?.fileUrl ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[75vh]">
              <iframe
                src={version.fileUrl}
                className="w-full h-full border-0"
                title={version.fileName || 'Attached Syllabus Document'}
              />
            </div>
          ) : (
            <div
              className="mx-auto transition-transform origin-top"
              style={{
                maxWidth: '900px',
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                marginBottom: zoom > 100 ? `${(zoom - 100) * 8}px` : undefined,
              }}
            >
              {/* Official USJ-R Electronic Course Syllabus Document */}
              <article className="bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden text-slate-900">
                {/* Institutional Header Banner */}
                <div className="bg-gradient-to-r from-[#005A36] via-[#006B41] to-[#005A36] px-6 py-4 flex flex-wrap items-center justify-between gap-2 border-b-4 border-[#C99700]">
                  <div>
                    <div className="text-base sm:text-lg font-black tracking-tight text-white">
                      {USJR_INSTITUTIONAL_HEADER.university}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-100">
                      {USJR_INSTITUTIONAL_HEADER.location} • {USJR_INSTITUTIONAL_HEADER.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full bg-[#FEF08A] text-[#854D0E] text-[11px] font-extrabold font-mono uppercase">
                      {version ? formatVersionLabel(version) : `Version ${syllabus.currentVersionNumber || 1}`}
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-9 space-y-7 text-xs leading-relaxed">
                  {/* Department & Course Title Header */}
                  <div className="text-center space-y-1.5 border-b border-slate-200 pb-5">
                    <p className="text-xs font-extrabold tracking-widest text-[#005A36] uppercase">
                      {highlight(deptName)}
                    </p>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                      {highlight(subject.code ? `${subject.code}: ${subject.title}` : subject.title || 'Course Syllabus')}
                    </h2>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Official Electronic Course Syllabus • {highlight(syllabus.semester || catalogSemester)}, AY{' '}
                      {highlight(syllabus.academicYear || '2026-2027')}
                    </p>
                  </div>

                  {/* SECTION 1: Course Details & Specifications (Strictly from Subject Details) */}
                  <section id="sec-course-details" className="scroll-mt-4 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Course Details & Specifications</span>
                    </h3>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <th className="w-40 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Subject Code
                            </th>
                            <td className="px-3.5 py-2.5 font-mono font-extrabold text-[#005A36] border-r border-slate-200">
                              {highlight(subject.code || '—')}
                            </td>
                            <th className="w-40 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Department
                            </th>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                              {highlight(deptCode ? `[${deptCode}] ${deptName}` : deptName)}
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Course Title
                            </th>
                            <td colSpan={3} className="px-3.5 py-2.5 font-bold text-slate-900">
                              {highlight(subject.title || '—')}
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Credit Units
                            </th>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800 border-r border-slate-200">
                              {highlight(`${units} Unit${Number(units) === 1 ? '' : 's'}`)}
                            </td>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Contact Hours
                            </th>
                            <td className="px-3.5 py-2.5 text-slate-800">
                              {highlight(`${lecHours} hr(s) Lecture • ${labHours} hr(s) Laboratory`)}
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Prerequisite(s)
                            </th>
                            <td className="px-3.5 py-2.5 text-slate-800 border-r border-slate-200">
                              {highlight(prerequisite)}
                            </td>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Co-Requisite(s)
                            </th>
                            <td className="px-3.5 py-2.5 text-slate-800">
                              {highlight(content.coRequisites || 'None')}
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Curriculum Level
                            </th>
                            <td className="px-3.5 py-2.5 text-slate-800 border-r border-slate-200">
                              {highlight(`${yearLevel} — ${catalogSemester}`)}
                            </td>
                            <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                              Assigned Faculty
                            </th>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                              {highlight(assignedInstructor)}
                            </td>
                          </tr>
                          {(content.schedule?.trim() || content.curriculumYear?.trim()) && (
                            <tr>
                              <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                                Class Schedule
                              </th>
                              <td className="px-3.5 py-2.5 text-slate-800 border-r border-slate-200">
                                {highlight(content.schedule || '—')}
                              </td>
                              <th className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 border-r border-slate-200">
                                Curriculum Year
                              </th>
                              <td className="px-3.5 py-2.5 text-slate-800">
                                {highlight(content.curriculumYear || '—')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* SECTION 2: Course Description */}
                  <section id="sec-description" className="scroll-mt-4 space-y-2.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Course Description</span>
                    </h3>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 whitespace-pre-line leading-relaxed">
                      {highlight(content.courseDescription)}
                    </div>
                  </section>

                  {/* SECTION 3 (Optional): Course Learning Outcomes */}
                  {hasOutcomes && (
                    <section id="sec-outcomes" className="scroll-mt-4 space-y-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                        <span>Course Learning Outcomes ({content.cilos.length})</span>
                      </h3>
                      <div className="border border-slate-300 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                              <th className="px-3.5 py-2 w-28 border-r border-slate-200">Code</th>
                              <th className="px-3.5 py-2">Outcome Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {content.cilos.map((c, idx) => (
                              <tr key={idx}>
                                <td className="px-3.5 py-2.5 font-mono font-bold text-[#005A36] border-r border-slate-200 align-top">
                                  {highlight(c.code || `CLO ${idx + 1}`)}
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-800 whitespace-pre-line">
                                  {highlight(c.description)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* SECTION 4 (Optional): Course Outline / Weekly Plan */}
                  {hasOutline && (
                    <section id="sec-outline" className="scroll-mt-4 space-y-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                        <span>Course Outline & Weekly Plan ({content.weeklyPlan.length})</span>
                      </h3>
                      <div className="overflow-x-auto border border-slate-300 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                              <th className="px-3 py-2 w-28 border-r border-slate-200">Time Frame</th>
                              <th className="px-3 py-2 border-r border-slate-200">Topic / Content</th>
                              <th className="px-3 py-2 border-r border-slate-200">Intended Outcome</th>
                              <th className="px-3 py-2 border-r border-slate-200">Activities</th>
                              <th className="px-3 py-2">Assessment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {content.weeklyPlan.map((w, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2.5 font-bold text-[#005A36] border-r border-slate-200 align-top">
                                  {highlight(w.timeFrame || `Week ${idx + 1}`)}
                                </td>
                                <td className="px-3 py-2.5 font-medium text-slate-900 border-r border-slate-200 align-top whitespace-pre-line">
                                  {highlight(w.learningContent)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200 align-top whitespace-pre-line">
                                  {highlight(w.intendedLearningOutcome || '—')}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200 align-top whitespace-pre-line">
                                  {highlight(w.teachingLearningActivities || '—')}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 align-top whitespace-pre-line">
                                  {highlight(w.assessment || '—')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* SECTION 5 (Optional): Grading System & Assessment */}
                  {hasGrading && (
                    <section id="sec-grading" className="scroll-mt-4 space-y-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                        <span>Grading System & Assessment</span>
                      </h3>
                      {content.owatGrading.length > 0 && (
                        <div className="border border-slate-300 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                                <th className="px-3.5 py-2 border-r border-slate-200">Grading Component</th>
                                <th className="px-3.5 py-2 border-r border-slate-200">Assessment Tools</th>
                                <th className="px-3.5 py-2 w-28 text-right">Weight (%)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {content.owatGrading.map((g, idx) => (
                                <tr key={idx}>
                                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200">
                                    {highlight(g.outcome)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-slate-700 border-r border-slate-200">
                                    {g.items.length > 0
                                      ? highlight(g.items.map((it) => `${it.tool}${it.points ? ` (${it.points} pts)` : ''}`).join(', '))
                                      : '—'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-[#005A36]">
                                    {g.totalWeight}%
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-emerald-50/70 font-extrabold">
                                <td colSpan={2} className="px-3.5 py-2 text-right text-slate-800 border-r border-slate-200">
                                  Total Weight
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-[#005A36]">
                                  {totalGradingWeight}%
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      {content.assessmentOfOutcomes?.trim() && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-700 mb-1">Assessment Methods</p>
                          <p className="text-slate-800 whitespace-pre-line">{highlight(content.assessmentOfOutcomes)}</p>
                        </div>
                      )}
                      {content.criteriaStandards?.trim() && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-700 mb-1">Passing Criteria & Standards</p>
                          <p className="text-slate-800 whitespace-pre-line">{highlight(content.criteriaStandards)}</p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* SECTION 6 (Optional): References */}
                  {hasReferences && (
                    <section id="sec-references" className="scroll-mt-4 space-y-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                        <span>Learning Resources & References</span>
                      </h3>
                      <ol className="list-decimal list-inside space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                        {content.references.map((ref, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {highlight(ref)}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {/* SECTION 7 (Optional): Course Policies */}
                  {hasPolicies && (
                    <section id="sec-policies" className="scroll-mt-4 space-y-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                        <span>Course Policies & Guidelines</span>
                      </h3>
                      <div className="space-y-2.5">
                        {content.coursePolicies.map((sec, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <p className="font-bold text-slate-900">{highlight(sec.section || `Policy ${idx + 1}`)}</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                              {sec.items.map((item, j) => (
                                <li key={j}>{highlight(item)}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* SECTION 8: Remarks & Revision History */}
                  <section id="sec-history" className="scroll-mt-4 space-y-3 pt-2 border-t border-slate-200">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Remarks & Revision History</span>
                    </h3>

                    {content.remarks?.trim() && (
                      <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-slate-800 whitespace-pre-line">
                        {highlight(content.remarks)}
                      </div>
                    )}

                    {versionsHistory.length > 0 && (
                      <div className="overflow-x-auto border border-slate-300 rounded-xl">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                              <th className="px-3 py-2 border-r border-slate-200">Version</th>
                              <th className="px-3 py-2 border-r border-slate-200">Author / Editor</th>
                              <th className="px-3 py-2 border-r border-slate-200">Change Summary</th>
                              <th className="px-3 py-2 border-r border-slate-200">Date</th>
                              {!hideApprovalStatus && <th className="px-3 py-2">Status / Approver</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {versionsHistory.map((v: any) => (
                              <tr key={v.id || v.versionNumber}>
                                <td className="px-3 py-2 font-mono font-bold text-[#005A36] border-r border-slate-200 whitespace-nowrap">
                                  {formatVersionLabel(v)}
                                </td>
                                <td className="px-3 py-2 text-slate-800 border-r border-slate-200">
                                  <div className="font-semibold">{v.editor?.fullName || 'System'}</div>
                                  {v.editor?.role && (
                                    <div className="text-[10px] text-slate-500">{roleLabel(v.editor.role)}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-700 border-r border-slate-200">
                                  {highlight(v.changeSummary || '—')}
                                </td>
                                <td className="px-3 py-2 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                  {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
                                </td>
                                {!hideApprovalStatus && (
                                  <td className="px-3 py-2">
                                    <span className="font-bold text-slate-800">
                                      {syllabusStatusLabel(v.approvalStatus)}
                                    </span>
                                    {v.reviewedBy?.fullName && (
                                      <div className="text-[10px] text-slate-500">
                                        by {v.reviewedBy.fullName}
                                      </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
