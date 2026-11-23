'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Search,
  Maximize2,
  Minimize2,
  List,
  ChevronUp,
  ChevronDown,
  FileText,
  X,
} from 'lucide-react';
import {
  ElectronicSyllabusContent,
  USJR_INSTITUTIONAL_HEADER,
  USJR_EVALUATION_RATING_SCALE,
  getDepartmentHeaderName,
  getProgramNameForDepartment,
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

const NAV_SECTIONS = [
  { id: 'sec-page-1', label: 'Course Details & Identity' },
  { id: 'sec-peo', label: 'PEO & Mission Mapping' },
  { id: 'sec-pilo-map', label: 'PILO – PEO Mapping' },
  { id: 'sec-overview', label: 'Course Overview & Standards' },
  { id: 'sec-cilo', label: 'CILOs & Assessment' },
  { id: 'sec-learning-plan', label: 'Course Learning Plan' },
  { id: 'sec-integration', label: 'Integration & OWAT' },
  { id: 'sec-references', label: 'References & Rating Scale' },
  { id: 'sec-policies', label: 'Course Policies & Standards' },
  { id: 'sec-revision', label: 'Revision History & Remarks' },
];

// Exact rowSpan metadata matching Pages 8-9 of the official USJ-R Syllabus PDF
const QUALITATIVE_SPANS: Record<number, { label: string; span: number }> = {
  0: { label: 'Failed', span: 20 },
  20: { label: 'Passing', span: 1 },
  21: { label: 'Fairly Satisfactory', span: 3 },
  24: { label: 'Satisfactory', span: 3 },
  27: { label: 'Very Satisfactory', span: 3 },
  30: { label: 'Meritorious', span: 3 },
  33: { label: 'Good', span: 2 },
  35: { label: 'Very Good', span: 2 },
  37: { label: 'Superior', span: 2 },
  39: { label: 'Excellent', span: 2 },
};

const PROFICIENCY_SPANS: Record<number, { label: string; rubric: string; span: number }> = {
  0: { label: 'POOR', rubric: '1', span: 15 },
  15: { label: 'FAMILIAR', rubric: '2', span: 5 },
  20: { label: 'KNOWLEDGEABLE', rubric: '3', span: 7 },
  27: { label: 'PROFICIENT', rubric: '4', span: 8 },
  35: { label: 'EXPERT', rubric: '5', span: 6 },
};

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
  const [activeSection, setActiveSection] = useState(NAV_SECTIONS[0].id);
  const [viewMode, setViewMode] = useState<'electronic' | 'legacy-pdf'>('electronic');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const subject = syllabus.subject || syllabus.course || {};
  const deptCode = syllabus.department?.code || syllabus.departmentId || subject.departmentId || '';
  const deptName = syllabus.department?.name || deptCode || '';
  const deptHeaderTitle = getDepartmentHeaderName(deptCode, deptName);
  const programLabel = getProgramNameForDepartment(deptCode, deptName);

  const content = useMemo(() => {
    if (contentOverride) return contentOverride;
    return normalizeSyllabusContent(version?.content, subject, deptName);
  }, [contentOverride, version?.content, subject, deptName]);

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

  const units = subject.units ?? content.subjectSnapshot?.units ?? 3;
  const lecHours = subject.lecHours ?? content.subjectSnapshot?.lecHours ?? 3;
  const labHours = subject.labHours ?? content.subjectSnapshot?.labHours ?? 0;
  const unitsText = `${units} Unit${Number(units) === 1 ? '' : 's'} (${lecHours} hr${Number(lecHours) === 1 ? '' : 's'} Lecture, ${labHours} hr${Number(labHours) === 1 ? '' : 's'} Lab)`;
  const prerequisite = subject.prerequisite || content.subjectSnapshot?.prerequisite || 'None';
  const termOffered =
    content.termOffered ||
    [subject.semester || syllabus.semester || '1st Semester', subject.yearLevel || ''].filter(Boolean).join(' — ');

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[70] bg-slate-100 flex flex-col'
    : 'rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex flex-col';

  const footerDocLabel = `${subject.code || 'COURSE'}_${subject.title || 'Syllabus'} • ${
    version ? formatVersionLabel(version) : `Version ${syllabus.currentVersionNumber || 1}`
  }`;

  const toolBtn =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer';

  return (
    <div className={containerClasses}>
      {/* Viewer toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNavSidebar((v) => !v)}
            title="Toggle section list"
            aria-pressed={showNavSidebar}
            className={`${toolBtn} hidden lg:inline-flex ${showNavSidebar ? 'bg-slate-100 text-slate-900' : ''}`}
          >
            <List className="h-4 w-4" />
            <span>Sections</span>
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-900">{subject.code || 'Course'}</span>
            <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] text-slate-600">
              {version ? formatShortVersionLabel(version) : `v${syllabus.currentVersionNumber || 1}`}
            </span>
          </div>

          {version?.fileUrl && (
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('electronic')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  viewMode === 'electronic' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Syllabus
              </button>
              <button
                type="button"
                onClick={() => setViewMode('legacy-pdf')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  viewMode === 'legacy-pdf' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3 w-3" />
                <span>Attached PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* In-document search */}
        {viewMode === 'electronic' && (
          <div className="flex h-8 max-w-xs flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 focus-within:border-brand-700">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this syllabus"
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {trimmedQuery && (
              <div className="flex shrink-0 items-center gap-0.5 text-slate-500">
                <span className="px-1 font-mono text-[10px]">
                  {matchCount > 0 ? `${activeMatchIdx + 1}/${matchCount}` : '0'}
                </span>
                <button type="button" onClick={() => jumpToMatch('prev')} className="rounded p-0.5 hover:bg-slate-100 cursor-pointer" title="Previous match">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => jumpToMatch('next')} className="rounded p-0.5 hover:bg-slate-100 cursor-pointer" title="Next match">
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setSearchQuery('')} className="rounded p-0.5 hover:bg-slate-100 cursor-pointer" title="Clear search">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zoom & full screen */}
        <div className="flex items-center gap-1">
          {viewMode === 'electronic' && (
            <div className="flex items-center rounded-lg border border-slate-200">
              <button type="button" onClick={() => setZoom((z) => Math.max(75, z - 10))} className={toolBtn} title="Zoom out" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                className="min-w-[44px] text-center font-mono text-[11px] text-slate-600 cursor-pointer"
                title="Reset zoom"
              >
                {zoom}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className={toolBtn} title="Zoom in" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className={toolBtn}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewer Body */}
      <div className="flex flex-1 min-h-0">
        {/* Section navigation */}
        {viewMode === 'electronic' && showNavSidebar && (
          <aside className="hidden w-56 shrink-0 space-y-0.5 overflow-y-auto border-r border-slate-200 bg-white p-2 lg:block print:hidden">
            <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-slate-500">Sections</p>
            {NAV_SECTIONS.map((sec, idx) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="w-4 font-mono text-[10px] text-slate-400">{idx + 1}</span>
                <span className="truncate">{sec.label}</span>
              </button>
            ))}
          </aside>
        )}

        {/* Document Paper Viewport */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-auto p-4 sm:p-6 ${isFullscreen ? 'h-full' : 'max-h-[84vh]'}`}
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
                maxWidth: '980px',
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                marginBottom: zoom > 100 ? `${(zoom - 100) * 14}px` : undefined,
              }}
            >
              {/* EXACT OFFICIAL USJ-R SYLLABUS DOCUMENT FORMAT */}
              <article
                className="bg-white border border-slate-400 shadow-lg text-black px-6 sm:px-10 py-6 space-y-6"
                style={{ fontFamily: 'Cambria, Georgia, "Times New Roman", serif' }}
              >
                {/* Exact Official Top Banner from PDF */}
                <div className="w-full">
                  <img
                    src="/images/usjr-header-banner.png"
                    alt="University of San Jose-Recoletos — Cebu City, Philippines — CHED Autonomous Status"
                    className="w-full h-auto block"
                  />
                </div>

                {/* PAGE 1: Seals, School & Department Title, 7-Row Course Info, Institutional Attributes */}
                <section id="sec-page-1" className="scroll-mt-4 space-y-5">
                  <div className="flex items-center justify-center gap-6 sm:gap-10 py-1">
                    <img
                      src="/images/usjr-seal.png"
                      alt="USJ-R Seal"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                    />
                    <div className="text-center leading-snug">
                      <h2 className="text-base sm:text-lg font-bold tracking-wide text-black uppercase">
                        {USJR_INSTITUTIONAL_HEADER.school}
                      </h2>
                      <p className="text-sm sm:text-base font-bold text-black">
                        {highlight(deptHeaderTitle)}
                      </p>
                      <p className="text-xs sm:text-sm text-black mt-0.5">
                        {highlight(content.curriculumYear || 'Curriculum 2022')}
                      </p>
                    </div>
                    <img
                      src="/images/soe-seal.png"
                      alt="School of Engineering Seal"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                    />
                  </div>

                  {/* 7-Row Course Identification Table */}
                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-[24%] bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          COURSE NUMBER
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold">{highlight(subject.code || '')}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          COURSE TITLE
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold">{highlight(subject.title || '')}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          COURSE UNITS
                        </td>
                        <td className="px-2.5 py-1.5">{highlight(unitsText)}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          PRE-REQUISITES
                        </td>
                        <td className="px-2.5 py-1.5">{highlight(prerequisite)}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          CO-REQUISITES
                        </td>
                        <td className="px-2.5 py-1.5">{highlight(content.coRequisites || 'None')}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          TERM OFFERED
                        </td>
                        <td className="px-2.5 py-1.5">{highlight(termOffered)}</td>
                      </tr>
                      <tr>
                        <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                          PROGRAM/S
                        </td>
                        <td className="px-2.5 py-1.5">{highlight(content.programs || programLabel)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Institutional Attributes Table (Exact Word-for-Word Match from Pages 1-2) */}
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <tbody>
                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Catholic Attributes</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-6 py-1 italic">
                          <div className="flex flex-wrap gap-x-6 gap-y-1">
                            {USJR_INSTITUTIONAL_HEADER.catholicAttributes.map((attr, idx) => (
                              <span key={idx}>{highlight(attr)}</span>
                            ))}
                          </div>
                        </td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Augustinian Recollect Attributes</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-6 py-1 italic">
                          <div className="flex flex-wrap gap-x-6 gap-y-1">
                            {USJR_INSTITUTIONAL_HEADER.augustinianAttributes.map((attr, idx) => (
                              <span key={idx}>{highlight(attr)}</span>
                            ))}
                          </div>
                        </td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">USJ-R&apos;s Vision</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-2.5 py-1.5 italic">{highlight(USJR_INSTITUTIONAL_HEADER.vision)}</td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Mission</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-2.5 py-1.5 italic">{highlight(USJR_INSTITUTIONAL_HEADER.mission)}</td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Core Values</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-6 py-1 italic">
                          <div className="flex flex-wrap gap-x-5 gap-y-1">
                            {USJR_INSTITUTIONAL_HEADER.coreValues.map((val, idx) => (
                              <span key={idx}>{highlight(val)}</span>
                            ))}
                          </div>
                        </td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Quality Statement</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="px-2.5 py-1.5 italic leading-relaxed">
                          {highlight(USJR_INSTITUTIONAL_HEADER.qualityStatement)}
                        </td>
                      </tr>

                      <tr className="border-b border-black bg-[#D9D9D9]">
                        <td className="font-bold px-2.5 py-1">Josenian Graduate Attributes</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1.5 italic">
                          <div className="flex flex-wrap gap-x-5 gap-y-1">
                            {USJR_INSTITUTIONAL_HEADER.graduateAttributes.map((attr, idx) => (
                              <span key={idx}>{highlight(attr)}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* PAGE 2: PEO & Mission-to-PEO Mapping */}
                <section id="sec-peo" className="scroll-mt-4 space-y-5 pt-2">
                  {/* PROGRAM EDUCATIONAL OBJECTIVES (PEO) */}
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th className="text-left font-bold px-2.5 py-1.5 uppercase">
                          PROGRAM EDUCATIONAL OBJECTIVES (PEO)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-3 min-h-[76px] whitespace-pre-line align-top">
                          {content.peoStatement?.trim() ? (
                            highlight(content.peoStatement)
                          ) : (
                            <div className="h-14" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Mapping of Mission Statement to PEO */}
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th colSpan={2} className="text-left font-bold px-2.5 py-1">
                          Mapping of Mission Statement to Program Educational Objectives (PEO)
                        </th>
                      </tr>
                      <tr className="bg-[#BFBFBF] border-b border-black">
                        <th className="w-[34%] text-left font-bold px-2.5 py-1 border-r border-black">
                          Mission Statement
                        </th>
                        <th className="text-left font-bold px-2.5 py-1">PEO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.missionPeoMapping.map((row, idx) => (
                        <tr key={idx} className="border-b border-black last:border-b-0">
                          <td className="px-2.5 py-1.5 border-r border-black align-top">
                            {row.mission.includes('Caritas et Scientia') ? (
                              <>
                                {highlight(row.mission.split('Caritas et Scientia')[0])}
                                <span className="italic">{highlight('Caritas et Scientia')}</span>
                                {highlight(row.mission.split('Caritas et Scientia').slice(1).join('Caritas et Scientia'))}
                              </>
                            ) : (
                              highlight(row.mission)
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 align-top">{highlight(row.peo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* PAGES 2-3: Mapping of PILO and PEO (a-l) */}
                <section id="sec-pilo-map" className="scroll-mt-4 pt-2">
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th colSpan={4} className="text-left font-bold px-2.5 py-1">
                          Mapping of Program Intended Learning Outcomes (PILO) and Program Educational Objectives (PEO)
                        </th>
                      </tr>
                      <tr className="bg-[#BFBFBF] border-b border-black text-center">
                        <th className="font-bold px-2.5 py-1 border-r border-black">
                          Program Intended Learning Outcomes (PILO)
                        </th>
                        <th className="w-16 font-bold px-1.5 py-1 border-r border-black">PEO 1</th>
                        <th className="w-16 font-bold px-1.5 py-1 border-r border-black">PEO 2</th>
                        <th className="w-16 font-bold px-1.5 py-1">PEO 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.piloPeoMapping.map((row) => (
                        <tr key={row.letter} className="border-b border-black last:border-b-0">
                          <td className="px-2.5 py-1.5 border-r border-black leading-snug">
                            <div className="flex gap-2">
                              <span className="w-5 text-right shrink-0">{row.letter}.</span>
                              <span>{highlight(row.outcome)}</span>
                            </div>
                          </td>
                          <td className="text-center border-r border-black font-bold">
                            {row.peo1 ? '✔' : ''}
                          </td>
                          <td className="text-center border-r border-black font-bold">
                            {row.peo2 ? '✔' : ''}
                          </td>
                          <td className="text-center font-bold">{row.peo3 ? '✔' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* PAGE 3: COURSE OVERVIEW & PILO STANDARDS TABLE */}
                <section id="sec-overview" className="scroll-mt-4 space-y-5 pt-2">
                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b-2 border-black">
                        <th className="text-center font-bold px-2.5 py-1.5 uppercase">COURSE OVERVIEW</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-3 whitespace-pre-line leading-relaxed align-top">
                          {content.courseDescription?.trim() ? (
                            highlight(content.courseDescription)
                          ) : (
                            <div className="h-12" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b-2 border-black text-center">
                        <th className="w-1/2 font-bold px-2.5 py-1.5 border-r border-black uppercase">
                          PROGRAM INTENDED LEARNING OUTCOMES
                        </th>
                        <th className="w-1/2 font-bold px-2.5 py-1.5 uppercase">
                          STANDARDS FOR NEW ENGINEERING GRADUATES
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.piloStandards.map((row, idx) => (
                        <tr key={idx} className="border-b border-black last:border-b-0">
                          <td className="px-2.5 py-3 border-r border-black align-top whitespace-pre-line">
                            {row.pilo?.trim() ? highlight(row.pilo) : <div className="h-6" />}
                          </td>
                          <td className="px-2.5 py-3 align-top whitespace-pre-line">
                            {row.standard?.trim() ? highlight(row.standard) : <div className="h-6" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* PAGE 4: COURSE INTENDED LEARNING OUTCOMES + ASSESSMENT OF OUTCOMES & CRITERIA STANDARDS */}
                <section id="sec-cilo" className="scroll-mt-4 space-y-5 pt-2">
                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black text-center">
                        <th rowSpan={2} className="font-bold px-2.5 py-1.5 border-r border-black uppercase">
                          COURSE INTENDED LEARNING OUTCOMES
                        </th>
                        <th rowSpan={2} className="w-32 font-bold px-2 py-1.5 border-r border-black uppercase">
                          MAPPED PILO
                        </th>
                        <th colSpan={3} className="font-bold px-2 py-1 border-b border-black uppercase">
                          MAPPED PEO
                        </th>
                      </tr>
                      <tr className="bg-[#D9D9D9] border-b-2 border-black text-center text-[11px]">
                        <th className="w-16 font-bold px-1 py-1 border-r border-black">PEO 1</th>
                        <th className="w-16 font-bold px-1 py-1 border-r border-black">PEO 2</th>
                        <th className="w-16 font-bold px-1 py-1">PEO 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.cilos.map((row, idx) => (
                        <tr key={idx} className="border-b border-black last:border-b-0">
                          <td className="px-2.5 py-2.5 border-r border-black align-top whitespace-pre-line">
                            {idx === 0 && (
                              <div className="italic mb-1.5">
                                Within and upon completion of this course, the students are expected to:
                              </div>
                            )}
                            {row.description?.trim() ? (
                              <div>{highlight(row.description)}</div>
                            ) : (
                              <div className="h-6" />
                            )}
                          </td>
                          <td className="px-2 py-2.5 border-r border-black text-center align-middle">
                            {highlight(row.mappedPilo)}
                          </td>
                          <td className="text-center border-r border-black align-middle font-bold text-sm">
                            {row.peo1 ? '✔' : ''}
                          </td>
                          <td className="text-center border-r border-black align-middle font-bold text-sm">
                            {row.peo2 ? '✔' : ''}
                          </td>
                          <td className="text-center align-middle font-bold text-sm">
                            {row.peo3 ? '✔' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b-2 border-black text-center">
                        <th className="w-1/2 font-bold px-2.5 py-1.5 border-r border-black uppercase">
                          ASSESSMENT OF OUTCOMES
                        </th>
                        <th className="w-1/2 font-bold px-2.5 py-1.5 uppercase">CRITERIA STANDARDS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-3 border-r border-black align-top whitespace-pre-line">
                          {content.assessmentOfOutcomes?.trim() ? (
                            highlight(content.assessmentOfOutcomes)
                          ) : (
                            <div className="h-10" />
                          )}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-pre-line">
                          {content.criteriaStandards?.trim() ? (
                            highlight(content.criteriaStandards)
                          ) : (
                            <div className="h-10" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* PAGES 4-6: 7-Column Course Learning Plan Table */}
                <section id="sec-learning-plan" className="scroll-mt-4 pt-2 overflow-x-auto">
                  <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black text-center">
                        <th rowSpan={2} className="w-20 font-bold px-2 py-2 border-r border-black">
                          Time Frame
                        </th>
                        <th rowSpan={2} className="font-bold px-2 py-2 border-r border-black">
                          Intended Learning Outcome
                        </th>
                        <th colSpan={3} className="w-24 font-bold px-1.5 py-1.5 border-r border-black border-b border-black">
                          TOPIC – CILO Mapping
                        </th>
                        <th rowSpan={2} className="font-bold px-2 py-2 border-r border-black">
                          Assessment (Intended Learning Outcomes)
                        </th>
                        <th rowSpan={2} className="font-bold px-2 py-2 border-r border-black">
                          Teaching - Learning Activities
                        </th>
                        <th rowSpan={2} className="font-bold px-2 py-2 border-r border-black">
                          Learning Content
                        </th>
                        <th rowSpan={2} className="font-bold px-2 py-2">
                          Resources
                        </th>
                      </tr>
                      <tr className="bg-[#D9D9D9] border-b border-black text-center">
                        <th className="w-8 font-normal py-1 border-r border-black">1</th>
                        <th className="w-8 font-normal py-1 border-r border-black">2</th>
                        <th className="w-8 font-normal py-1 border-r border-black">3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.weeklyPlan.map((row, idx) => (
                        <tr key={idx} className="border-b border-black last:border-b-0">
                          <td className="px-2 py-3 border-r border-black align-top whitespace-pre-line">
                            {row.timeFrame?.trim() ? highlight(row.timeFrame) : <div className="h-10" />}
                          </td>
                          <td className="px-2 py-3 border-r border-black align-top whitespace-pre-line">
                            {highlight(row.intendedLearningOutcome)}
                          </td>
                          <td className="text-center border-r border-black align-middle font-bold">
                            {row.ciloMapping.includes('1') ? '✔' : ''}
                          </td>
                          <td className="text-center border-r border-black align-middle font-bold">
                            {row.ciloMapping.includes('2') ? '✔' : ''}
                          </td>
                          <td className="text-center border-r border-black align-middle font-bold">
                            {row.ciloMapping.includes('3') ? '✔' : ''}
                          </td>
                          <td className="px-2 py-3 border-r border-black align-top whitespace-pre-line">
                            {highlight(row.assessment)}
                          </td>
                          <td className="px-2 py-3 border-r border-black align-top whitespace-pre-line">
                            {highlight(row.teachingLearningActivities)}
                          </td>
                          <td className="px-2 py-3 border-r border-black align-top whitespace-pre-line">
                            {highlight(row.learningContent)}
                          </td>
                          <td className="px-2 py-3 align-top whitespace-pre-line">
                            {highlight(row.resources)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* PAGES 7-8: INTEGRATION SCHEMES & OWAT GRADING SYSTEM */}
                <section id="sec-integration" className="scroll-mt-4 space-y-6 pt-2">
                  <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b-2 border-black">
                        <th className="text-left font-bold px-2.5 py-1 uppercase">INTEGRATION SCHEMES</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-6 py-3">
                          <ul className="list-disc pl-5 space-y-1.5 italic leading-relaxed">
                            {content.integrationSchemes.map((item, idx) => (
                              <li key={idx}>
                                <strong className="font-bold">{highlight(item.coreValue)}</strong>{' '}
                                {highlight(item.description)}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* OWAT Table (Exact Maroon Border Style Matching Pages 7-8 of PDF) */}
                  <div className="max-w-3xl mx-auto overflow-x-auto">
                    <table className="w-full border-collapse border border-[#B06C6C] text-xs sm:text-[13px]">
                      <thead>
                        <tr className="bg-[#D9D9D9] border-b border-[#B06C6C]">
                          <th colSpan={4} className="text-left font-bold px-2.5 py-1.5 uppercase">
                            OWAT (OUTCOME WEIGHT ASSESSMENT TABLE) GRADING SYSTEM
                          </th>
                        </tr>
                        <tr className="border-b border-[#B06C6C] text-left bg-white">
                          <th className="w-[28%] font-normal px-2.5 py-1 border-r border-[#B06C6C]">Outcomes</th>
                          <th className="w-[22%] font-normal px-2.5 py-1 border-r border-[#B06C6C]">Total Weight</th>
                          <th className="w-[22%] font-normal px-2.5 py-1 border-r border-[#B06C6C]">Points Scoring</th>
                          <th className="w-[28%] font-normal px-2.5 py-1">Assessment Tool</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.owatGrading.map((group, gIdx) => {
                          const items = group.items.length > 0 ? group.items : [{ points: 0, tool: '' }];
                          return items.map((it, iIdx) => (
                            <tr key={`${gIdx}-${iIdx}`} className="border-b border-[#B06C6C]">
                              {iIdx === 0 && (
                                <>
                                  <td
                                    rowSpan={items.length}
                                    className="px-2.5 py-2 border-r border-[#B06C6C] align-top leading-snug"
                                  >
                                    {highlight(group.outcome)}
                                  </td>
                                  <td
                                    rowSpan={items.length}
                                    className="px-2.5 py-2 border-r border-[#B06C6C] text-center align-middle"
                                  >
                                    {group.totalWeight}%
                                  </td>
                                </>
                              )}
                              <td className="px-2.5 py-1 border-r border-[#B06C6C] text-center">
                                {it.points || ''}
                              </td>
                              <td className="px-2.5 py-1 leading-snug">{highlight(it.tool)}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* PAGES 8-9: REFERENCES & EXACT 41-ROW EVALUATION RATING SCALE */}
                <section id="sec-references" className="scroll-mt-4 space-y-6 pt-2">
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th className="text-left font-bold px-2.5 py-1 uppercase">REFERENCES</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 align-top">
                          {content.references.filter((r) => r.trim()).length > 0 ? (
                            <ol className="list-decimal pl-5 space-y-1.5">
                              {content.references
                                .filter((r) => r.trim())
                                .map((ref, idx) => (
                                  <li key={idx}>{highlight(ref)}</li>
                                ))}
                            </ol>
                          ) : (
                            <div className="h-24" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Exact Evaluation Rating Scale Table (41 rows with merged rowSpan cells) */}
                  <div className="max-w-2xl mx-auto space-y-1.5">
                    <p className="text-center font-bold text-xs sm:text-[13px] uppercase">
                      EVALUATION RATING SCALE
                    </p>
                    <table className="w-full border-collapse border border-black text-xs text-center">
                      <thead>
                        <tr className="border-b border-black bg-white font-bold">
                          <th className="w-24 py-1 px-2 border-r border-black">Score</th>
                          <th className="w-14 py-1 px-2 border-r border-black">FG</th>
                          <th colSpan={2} className="py-1 px-2 border-r border-black">
                            Qualitative Remarks
                          </th>
                          <th className="w-20 py-1 px-2">Rubrics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {USJR_EVALUATION_RATING_SCALE.map((row, idx) => {
                          const qual = QUALITATIVE_SPANS[idx];
                          const prof = PROFICIENCY_SPANS[idx];
                          return (
                            <tr key={idx} className="border-b border-black last:border-b-0">
                              <td className="py-0.5 px-2 border-r border-black">{row.score}</td>
                              <td className="py-0.5 px-2 border-r border-black">{row.fg}</td>
                              {qual && (
                                <td
                                  rowSpan={qual.span}
                                  className="py-1 px-2 border-r border-black align-middle"
                                >
                                  {qual.label}
                                </td>
                              )}
                              {prof && (
                                <>
                                  <td
                                    rowSpan={prof.span}
                                    className="py-1 px-2 border-r border-black align-middle"
                                  >
                                    {prof.label}
                                  </td>
                                  <td rowSpan={prof.span} className="py-1 px-2 align-middle">
                                    {prof.rubric}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-center text-xs italic pt-1">
                      Reference:{' '}
                      <span className="underline">
                        Outcome Based Education: Critical Issues and Answers
                      </span>{' '}
                      by Dr. William G. Spady and Dr. Francis Aldrine A. Uy
                    </p>
                  </div>
                </section>

                {/* PAGES 10-11: COURSE POLICIES AND STANDARDS */}
                <section id="sec-policies" className="scroll-mt-4 pt-2">
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th className="text-left font-bold px-2.5 py-1 uppercase">
                          COURSE POLICIES AND STANDARDS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 space-y-3.5 leading-relaxed">
                          <p className="italic">
                            (Specific classroom guidelines of the course and the teacher, please describe policy as to:)
                          </p>
                          {content.coursePolicies.map((pol, idx) => (
                            <div key={idx} className="space-y-1 pl-2">
                              <p className="font-bold">{highlight(pol.section)}</p>
                              <ol className="list-decimal pl-7 space-y-1">
                                {pol.items.map((item, j) => (
                                  <li key={j}>{highlight(item)}</li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* PAGE 11: SYLLABUS REVISION HISTORY & REMARKS SECTION */}
                <section id="sec-revision" className="scroll-mt-4 space-y-5 pt-2">
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th colSpan={hideApprovalStatus ? 3 : 4} className="text-left font-bold px-2.5 py-1 uppercase">
                          SYLLABUS REVISION HISTORY
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {versionsHistory.length > 0 ? (
                        versionsHistory.map((v: any) => (
                          <tr key={v.id || v.versionNumber} className="border-b border-black last:border-b-0">
                            <td className="w-32 px-2.5 py-1.5 border-r border-black font-bold whitespace-nowrap">
                              {formatVersionLabel(v)}
                            </td>
                            <td className="w-44 px-2.5 py-1.5 border-r border-black">
                              <div>{v.editor?.fullName || 'Department'}</div>
                              {v.editor?.role && (
                                <div className="text-[11px] text-slate-600">{roleLabel(v.editor.role)}</div>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-black last:border-r-0">
                              <div>{highlight(v.changeSummary || '')}</div>
                              <div className="text-[11px] text-slate-600">
                                {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}
                              </div>
                            </td>
                            {!hideApprovalStatus && (
                              <td className="w-40 px-2.5 py-1.5">
                                <div className="font-semibold">{syllabusStatusLabel(v.approvalStatus)}</div>
                                {v.reviewedBy?.fullName && (
                                  <div className="text-[11px] text-slate-600">by {v.reviewedBy.fullName}</div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        [1, 2, 3, 4].map((n) => (
                          <tr key={n} className="border-b border-black last:border-b-0">
                            <td className="w-1/4 h-6 px-2.5 border-r border-black" />
                            <td className="h-6 px-2.5" colSpan={hideApprovalStatus ? 2 : 3} />
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] border-b border-black">
                        <th className="text-left font-bold px-2.5 py-1 uppercase">REMARKS SECTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 whitespace-pre-line align-top">
                          {content.remarks?.trim() ? (
                            highlight(content.remarks)
                          ) : (
                            <div className="h-14" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Official Document Footer Matching PDF */}
                  <div className="pt-2 text-[11px] text-black leading-snug border-t border-slate-200 flex items-center justify-between">
                    <span>{footerDocLabel}</span>
                    <span className="font-semibold">{deptHeaderTitle}</span>
                  </div>
                </section>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
