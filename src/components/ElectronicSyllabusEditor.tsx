'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  Eye,
  GitCompare,
  GitBranch,
  Edit3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import {
  ElectronicSyllabusContent,
  USJR_INSTITUTIONAL_HEADER,
  USJR_EVALUATION_RATING_SCALE,
  createDefaultSyllabusContent,
  getDepartmentHeaderName,
  getProgramNameForDepartment,
} from '@/lib/syllabus-template';
import ElectronicSyllabusViewer from '@/components/ElectronicSyllabusViewer';
import SyllabusVersionCompare from '@/components/SyllabusVersionCompare';
import { PROPOSAL_VERSION_OFFSET } from '@/lib/status';

interface ElectronicSyllabusEditorProps {
  mode: 'create' | 'edit';
  currentUser: any;
  subjects?: any[];
  initialSubjectId?: string;
  syllabus?: any;
  baseVersion?: any;
  initialContent: ElectronicSyllabusContent;
  versionsHistory?: any[];
  submitting: boolean;
  error: string;
  onSubmit: (payload: {
    subjectId?: string;
    semester?: string;
    academicYear?: string;
    section?: string;
    changeSummary: string;
    content: ElectronicSyllabusContent;
    saveAsDraft: boolean;
    submitForApproval: boolean;
  }) => Promise<void>;
}

type ViewMode = 'edit' | 'preview' | 'diff';

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

export default function ElectronicSyllabusEditor({
  mode,
  currentUser,
  subjects = [],
  initialSubjectId = '',
  syllabus,
  baseVersion,
  initialContent,
  versionsHistory = [],
  submitting,
  error,
  onSubmit,
}: ElectronicSyllabusEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [zoom, setZoom] = useState<number>(100);

  const [subjectId, setSubjectId] = useState<string>(initialSubjectId || String(syllabus?.subjectId || ''));
  const [semester, setSemester] = useState<string>(syllabus?.semester || '1st Semester');
  const [academicYear] = useState<string>(syllabus?.academicYear || '2026-2027');
  const [section] = useState<string>(syllabus?.section || 'A');
  const [changeSummary, setChangeSummary] = useState<string>(
    mode === 'create' ? 'Initial electronic syllabus (Version 1)' : ''
  );
  const [localError, setLocalError] = useState('');
  const [content, setContent] = useState<ElectronicSyllabusContent>(initialContent);

  const selectedSubject = useMemo(() => {
    if (mode === 'edit') return syllabus?.subject || syllabus?.course || null;
    return subjects.find((s) => String(s.id) === String(subjectId)) || null;
  }, [mode, syllabus, subjects, subjectId]);

  const deptCode =
    selectedSubject?.departmentId ||
    syllabus?.departmentId ||
    currentUser?.departmentId ||
    currentUser?.departmentCode ||
    '';

  const deptName =
    selectedSubject?.department?.name ||
    syllabus?.department?.name ||
    currentUser?.departmentName ||
    deptCode;

  const deptHeaderTitle = getDepartmentHeaderName(deptCode, deptName);
  const programLabel = getProgramNameForDepartment(deptCode, deptName);

  const isDeptHead = currentUser?.role === 'DepartmentHead';
  const maxApprovedVer = versionsHistory
    .filter((v: any) => v.approvalStatus === 'APPROVED' && v.versionNumber <= PROPOSAL_VERSION_OFFSET)
    .reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
  const nextVersionNumber = mode === 'create' ? 1 : maxApprovedVer + 1;

  const handleSubjectSelect = (newId: string) => {
    setSubjectId(newId);
    const subj = subjects.find((s) => String(s.id) === String(newId));
    if (subj) {
      const defaults = createDefaultSyllabusContent(subj, subj.department?.name || subj.departmentId);
      setContent(defaults);
    }
  };

  const totalOwatWeight = content.owatGrading.reduce((sum, g) => sum + (Number(g.totalWeight) || 0), 0);

  const previewSyllabusObj = useMemo(
    () => ({
      id: syllabus?.id,
      academicYear,
      semester,
      section,
      currentVersionNumber: nextVersionNumber,
      departmentId: deptCode,
      department:
        selectedSubject?.department ||
        syllabus?.department || {
          code: deptCode,
          name: deptName,
        },
      subject: selectedSubject || {
        code: 'SELECT SUBJECT',
        title: 'Untitled Course Syllabus',
        units: 3,
        lecHours: 3,
        labHours: 0,
        prerequisite: 'None',
        yearLevel: '1st Year',
        semester,
      },
      instructor: syllabus?.instructor || { fullName: currentUser?.fullName, email: currentUser?.email },
    }),
    [syllabus, academicYear, semester, section, nextVersionNumber, deptCode, deptName, selectedSubject, currentUser]
  );

  const triggerSave = async (submitForApproval: boolean) => {
    setLocalError('');
    if (mode === 'create' && !subjectId) {
      setLocalError('Please select a subject first.');
      return;
    }
    if (mode === 'edit' && !changeSummary.trim()) {
      setLocalError('A Change Summary is required so reviewers and version history record what changed.');
      return;
    }

    await onSubmit({
      subjectId,
      semester,
      academicYear,
      section,
      changeSummary: changeSummary.trim() || 'Initial electronic syllabus (Version 1)',
      content,
      saveAsDraft: !submitForApproval,
      submitForApproval,
    });
  };

  const displayedError = localError || error;
  const cellInput =
    'w-full bg-transparent hover:bg-emerald-50/40 focus:bg-emerald-50/70 focus:outline-none focus:ring-1 focus:ring-[#005A36] px-1.5 py-1 text-xs sm:text-[13px] text-black transition-colors';

  const units = selectedSubject?.units ?? content.subjectSnapshot?.units ?? 3;
  const lecHours = selectedSubject?.lecHours ?? content.subjectSnapshot?.lecHours ?? 3;
  const labHours = selectedSubject?.labHours ?? content.subjectSnapshot?.labHours ?? 0;
  const unitsText = `${units} Unit${Number(units) === 1 ? '' : 's'} (${lecHours} hr${Number(lecHours) === 1 ? '' : 's'} Lecture, ${labHours} hr${Number(labHours) === 1 ? '' : 's'} Lab)`;
  const prerequisite = selectedSubject?.prerequisite || content.subjectSnapshot?.prerequisite || 'None';
  const defaultTermOffered = [selectedSubject?.semester || semester, selectedSubject?.yearLevel || '']
    .filter(Boolean)
    .join(' — ');

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={
              mode === 'edit' && syllabus?.id
                ? `/syllabi/${syllabus.id}`
                : isDeptHead
                  ? '/dept/dashboard'
                  : '/educator/dashboard'
            }
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                Electronic Syllabus Editor
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#005A36] border border-emerald-200 font-mono">
                {mode === 'create' ? 'Version 1' : `Target: Version ${nextVersionNumber} (on Approval)`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
              {mode === 'create'
                ? 'Electronic Course Syllabus'
                : `Edit Syllabus: ${selectedSubject?.code || ''} — ${selectedSubject?.title || ''}`}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => triggerSave(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-[#005A36]" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => triggerSave(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
            <span>
              {submitting
                ? 'Submitting...'
                : isDeptHead
                  ? 'Submit for Dean Approval'
                  : 'Submit for Dept. Head Approval'}
            </span>
          </button>
        </div>
      </div>

      {displayedError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{displayedError}</span>
        </div>
      )}

      {/* Subject Selector (Create Mode Only) */}
      {mode === 'create' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Subject *</label>
            <select
              value={subjectId}
              onChange={(e) => handleSubjectSelect(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            >
              <option value="">-- Select Department Subject --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Semester *</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            >
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
        </div>
      )}

      {/* Change Summary Input */}
      <div className="bg-[#FEF9C3]/45 p-4 rounded-2xl border border-[#CA8A04]/30 shadow-sm space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-[#854D0E] flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            <span>Change Summary {mode === 'edit' ? '(Mandatory) *' : '(Optional)'}</span>
          </label>
          <span className="text-[11px] text-slate-500 font-medium">Recorded in Syllabus Revision History</span>
        </div>
        <input
          type="text"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="Summarize what you revised (e.g., Updated Course Overview, CILOs, Weekly Plan, and OWAT weights)"
          className="w-full bg-white border border-[#CA8A04]/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
        />
      </div>

      {/* Mode Switcher Bar: Edit | Preview | Preview Changes */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'edit'
              ? 'bg-[#005A36] text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Electronic Syllabus</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'preview'
              ? 'bg-[#005A36] text-white shadow-sm'
              : 'bg-amber-50 hover:bg-amber-100 text-[#854D0E] border border-amber-200'
              }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Syllabus</span>
          </button>

          {mode === 'edit' && baseVersion && (
            <button
              type="button"
              onClick={() => setViewMode('diff')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'diff'
                ? 'bg-[#005A36] text-white shadow-sm'
                : 'bg-amber-50 hover:bg-amber-100 text-[#854D0E] border border-amber-200'
                }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Preview Changes</span>
            </button>
          )}
        </div>

        {viewMode === 'edit' && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${totalOwatWeight === 100
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
            >
              OWAT Weight: {totalOwatWeight}%
            </span>
            <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 px-1 py-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(80, z - 10))}
                className="p-1 rounded hover:bg-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 text-slate-700">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(130, z + 10))}
                className="p-1 rounded hover:bg-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {zoom !== 100 && (
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="p-1 rounded hover:bg-white cursor-pointer text-[#005A36]"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODE 1: DIRECT INLINE WYSIWYG EDITOR IN EXACT OFFICIAL USJ-R SYLLABUS FORMAT */}
      {viewMode === 'edit' && (
        <div className="rounded-2xl border border-slate-300 bg-slate-200/80 p-4 sm:p-6 overflow-auto">
          <div
            className="mx-auto transition-transform origin-top"
            style={{
              maxWidth: '980px',
              transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
              marginBottom: zoom > 100 ? `${(zoom - 100) * 14}px` : undefined,
            }}
          >
            <article
              className="bg-white border border-slate-400 shadow-lg text-black px-6 sm:px-10 py-6 space-y-6"
              style={{ fontFamily: 'Cambria, Georgia, "Times New Roman", serif' }}
            >
              {/* Exact Official Top Banner */}
              <div className="w-full">
                <img
                  src="/images/usjr-header-banner.png"
                  alt="University of San Jose-Recoletos"
                  className="w-full h-auto block"
                />
              </div>

              {/* Seals + School / Department Header */}
              <div className="flex items-center justify-center gap-6 sm:gap-10 py-1">
                <img src="/images/usjr-seal.png" alt="USJ-R Seal" className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" />
                <div className="text-center leading-snug">
                  <h2 className="text-base sm:text-lg font-bold tracking-wide text-black uppercase">
                    {USJR_INSTITUTIONAL_HEADER.school}
                  </h2>
                  <p className="text-sm sm:text-base font-bold text-black">{deptHeaderTitle}</p>
                  <input
                    type="text"
                    value={content.curriculumYear}
                    onChange={(e) => setContent({ ...content, curriculumYear: e.target.value })}
                    className="text-center text-xs sm:text-sm text-black bg-transparent hover:bg-emerald-50/50 focus:bg-emerald-50/70 focus:outline-none focus:ring-1 focus:ring-[#005A36] rounded px-2 py-0.5 mt-0.5"
                  />
                </div>
                <img src="/images/soe-seal.png" alt="School of Engineering Seal" className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" />
              </div>

              {/* 7-Row Course Identification Table */}
              <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[24%] bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      COURSE NUMBER
                    </td>
                    <td className="px-2.5 py-1.5 font-semibold">{selectedSubject?.code || ''}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      COURSE TITLE
                    </td>
                    <td className="px-2.5 py-1.5 font-semibold">{selectedSubject?.title || ''}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      COURSE UNITS
                    </td>
                    <td className="px-2.5 py-1.5">{unitsText}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      PRE-REQUISITES
                    </td>
                    <td className="px-2.5 py-1.5">{prerequisite}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      CO-REQUISITES
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={content.coRequisites}
                        onChange={(e) => setContent({ ...content, coRequisites: e.target.value })}
                        placeholder="None"
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      TERM OFFERED
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={content.termOffered ?? defaultTermOffered}
                        onChange={(e) => setContent({ ...content, termOffered: e.target.value })}
                        placeholder={defaultTermOffered}
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-[#D9D9D9] font-bold px-2.5 py-1.5 border-r-2 border-black uppercase">
                      PROGRAM/S
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={content.programs || programLabel}
                        onChange={(e) => setContent({ ...content, programs: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Institutional Attributes Box (Fixed Official Statements) */}
              <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                <tbody>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">Catholic Attributes</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-6 py-1 italic">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        {USJR_INSTITUTIONAL_HEADER.catholicAttributes.map((a, i) => (
                          <span key={i}>{a}</span>
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
                        {USJR_INSTITUTIONAL_HEADER.augustinianAttributes.map((a, i) => (
                          <span key={i}>{a}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">USJ-R&apos;s Vision</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-2.5 py-1.5 italic">{USJR_INSTITUTIONAL_HEADER.vision}</td>
                  </tr>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">Mission</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-2.5 py-1.5 italic">{USJR_INSTITUTIONAL_HEADER.mission}</td>
                  </tr>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">Core Values</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-6 py-1 italic">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {USJR_INSTITUTIONAL_HEADER.coreValues.map((v, i) => (
                          <span key={i}>{v}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">Quality Statement</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-2.5 py-1.5 italic leading-relaxed">
                      {USJR_INSTITUTIONAL_HEADER.qualityStatement}
                    </td>
                  </tr>
                  <tr className="border-b border-black bg-[#D9D9D9]">
                    <td className="font-bold px-2.5 py-1">Josenian Graduate Attributes</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 italic">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {USJR_INSTITUTIONAL_HEADER.graduateAttributes.map((g, i) => (
                          <span key={i}>{g}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

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
                    <td className="p-1.5">
                      <textarea
                        rows={3}
                        value={content.peoStatement || ''}
                        onChange={(e) => setContent({ ...content, peoStatement: e.target.value })}
                        placeholder="Enter Program Educational Objectives (PEO 1, PEO 2, PEO 3)..."
                        className={`${cellInput} leading-relaxed`}
                      />
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
                    <th className="w-[34%] text-left font-bold px-2.5 py-1 border-r border-black">Mission Statement</th>
                    <th className="text-left font-bold px-2.5 py-1">PEO</th>
                  </tr>
                </thead>
                <tbody>
                  {content.missionPeoMapping.map((row, idx) => (
                    <tr key={idx} className="border-b border-black last:border-b-0">
                      <td className="p-0.5 border-r border-black">
                        <input
                          type="text"
                          value={row.mission}
                          onChange={(e) => {
                            const next = [...content.missionPeoMapping];
                            next[idx] = { ...next[idx], mission: e.target.value };
                            setContent({ ...content, missionPeoMapping: next });
                          }}
                          className={cellInput}
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          type="text"
                          value={row.peo}
                          onChange={(e) => {
                            const next = [...content.missionPeoMapping];
                            next[idx] = { ...next[idx], peo: e.target.value };
                            setContent({ ...content, missionPeoMapping: next });
                          }}
                          placeholder="Enter mapped PEO statement..."
                          className={cellInput}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mapping of PILO and PEO (a-l) */}
              <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                <thead>
                  <tr className="bg-[#D9D9D9] border-b border-black">
                    <th colSpan={4} className="text-left font-bold px-2.5 py-1">
                      Mapping of Program Intended Learning Outcomes (PILO) and Program Educational Objectives (PEO)
                    </th>
                  </tr>
                  <tr className="bg-[#BFBFBF] border-b border-black text-center">
                    <th className="font-bold px-2.5 py-1 border-r border-black">Program Intended Learning Outcomes (PILO)</th>
                    <th className="w-16 font-bold px-1.5 py-1 border-r border-black">PEO 1</th>
                    <th className="w-16 font-bold px-1.5 py-1 border-r border-black">PEO 2</th>
                    <th className="w-16 font-bold px-1.5 py-1">PEO 3</th>
                  </tr>
                </thead>
                <tbody>
                  {content.piloPeoMapping.map((row, idx) => (
                    <tr key={row.letter} className="border-b border-black last:border-b-0">
                      <td className="px-2.5 py-1.5 border-r border-black leading-snug">
                        <div className="flex gap-2">
                          <span className="w-5 text-right shrink-0">{row.letter}.</span>
                          <span>{row.outcome}</span>
                        </div>
                      </td>
                      {(['peo1', 'peo2', 'peo3'] as const).map((key) => (
                        <td key={key} className="text-center border-r last:border-r-0 border-black">
                          <input
                            type="checkbox"
                            checked={row[key]}
                            onChange={(e) => {
                              const next = [...content.piloPeoMapping];
                              next[idx] = { ...next[idx], [key]: e.target.checked };
                              setContent({ ...content, piloPeoMapping: next });
                            }}
                            className="w-4 h-4 accent-[#005A36] cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* COURSE OVERVIEW */}
              <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                <thead>
                  <tr className="bg-[#D9D9D9] border-b-2 border-black">
                    <th className="text-center font-bold px-2.5 py-1.5 uppercase">COURSE OVERVIEW</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1.5">
                      <textarea
                        rows={4}
                        value={content.courseDescription}
                        onChange={(e) => setContent({ ...content, courseDescription: e.target.value })}
                        placeholder="Enter Course Overview..."
                        className={`${cellInput} leading-relaxed`}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* PILO & STANDARDS FOR NEW ENGINEERING GRADUATES */}
              <div className="space-y-1.5">
                <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b-2 border-black text-center">
                      <th className="w-[48%] font-bold px-2.5 py-1.5 border-r border-black uppercase">
                        PROGRAM INTENDED LEARNING OUTCOMES
                      </th>
                      <th className="w-[48%] font-bold px-2.5 py-1.5 border-r border-black uppercase">
                        STANDARDS FOR NEW ENGINEERING GRADUATES
                      </th>
                      <th className="w-10 px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {content.piloStandards.map((row, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0">
                        <td className="p-1 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.pilo}
                            onChange={(e) => {
                              const next = [...content.piloStandards];
                              next[idx] = { ...next[idx], pilo: e.target.value };
                              setContent({ ...content, piloStandards: next });
                            }}
                            placeholder="PILO..."
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.standard}
                            onChange={(e) => {
                              const next = [...content.piloStandards];
                              next[idx] = { ...next[idx], standard: e.target.value };
                              setContent({ ...content, piloStandards: next });
                            }}
                            placeholder="Standard..."
                            className={cellInput}
                          />
                        </td>
                        <td className="text-center align-middle p-1">
                          <button
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                piloStandards: content.piloStandards.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({ ...content, piloStandards: [...content.piloStandards, { pilo: '', standard: '' }] })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Standard Row</span>
                  </button>
                </div>
              </div>

              {/* COURSE INTENDED LEARNING OUTCOMES (CILO) */}
              <div className="space-y-1.5">
                <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b border-black text-center">
                      <th rowSpan={2} className="font-bold px-2.5 py-1.5 border-r border-black uppercase">
                        COURSE INTENDED LEARNING OUTCOMES
                      </th>
                      <th rowSpan={2} className="w-28 font-bold px-2 py-1.5 border-r border-black uppercase">
                        MAPPED PILO
                      </th>
                      <th colSpan={3} className="font-bold px-2 py-1 border-r border-black border-b border-black uppercase">
                        MAPPED PEO
                      </th>
                      <th rowSpan={2} className="w-10" />
                    </tr>
                    <tr className="bg-[#D9D9D9] border-b-2 border-black text-center text-[11px]">
                      <th className="w-14 font-bold py-1 border-r border-black">PEO 1</th>
                      <th className="w-14 font-bold py-1 border-r border-black">PEO 2</th>
                      <th className="w-14 font-bold py-1 border-r border-black">PEO 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.cilos.map((row, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0">
                        <td className="p-1.5 border-r border-black align-top">
                          {idx === 0 && (
                            <div className="italic text-xs mb-1 px-1">
                              Within and upon completion of this course, the students are expected to:
                            </div>
                          )}
                          <textarea
                            rows={2}
                            value={row.description}
                            onChange={(e) => {
                              const next = [...content.cilos];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setContent({ ...content, cilos: next });
                            }}
                            placeholder={`CILO ${idx + 1} statement...`}
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1 border-r border-black align-middle">
                          <input
                            type="text"
                            value={row.mappedPilo}
                            onChange={(e) => {
                              const next = [...content.cilos];
                              next[idx] = { ...next[idx], mappedPilo: e.target.value };
                              setContent({ ...content, cilos: next });
                            }}
                            placeholder="a, c, g"
                            className={`${cellInput} text-center`}
                          />
                        </td>
                        {(['peo1', 'peo2', 'peo3'] as const).map((key) => (
                          <td key={key} className="text-center border-r border-black align-middle">
                            <input
                              type="checkbox"
                              checked={row[key]}
                              onChange={(e) => {
                                const next = [...content.cilos];
                                next[idx] = { ...next[idx], [key]: e.target.checked };
                                setContent({ ...content, cilos: next });
                              }}
                              className="w-4 h-4 accent-[#005A36] cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="text-center align-middle p-1">
                          <button
                            type="button"
                            onClick={() =>
                              setContent({ ...content, cilos: content.cilos.filter((_, i) => i !== idx) })
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remove CILO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({
                        ...content,
                        cilos: [
                          ...content.cilos,
                          {
                            code: `CILO ${content.cilos.length + 1}`,
                            description: '',
                            mappedPilo: '',
                            peo1: false,
                            peo2: false,
                            peo3: false,
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add CILO Row</span>
                  </button>
                </div>
              </div>

              {/* ASSESSMENT OF OUTCOMES & CRITERIA STANDARDS */}
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
                    <td className="p-1.5 border-r border-black align-top">
                      <textarea
                        rows={3}
                        value={content.assessmentOfOutcomes}
                        onChange={(e) => setContent({ ...content, assessmentOfOutcomes: e.target.value })}
                        placeholder="Describe outcome assessments..."
                        className={cellInput}
                      />
                    </td>
                    <td className="p-1.5 align-top">
                      <textarea
                        rows={3}
                        value={content.criteriaStandards}
                        onChange={(e) => setContent({ ...content, criteriaStandards: e.target.value })}
                        placeholder="Describe passing criteria & standards..."
                        className={cellInput}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 7-COLUMN COURSE LEARNING PLAN TABLE */}
              <div className="space-y-1.5 overflow-x-auto">
                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b border-black text-center">
                      <th rowSpan={2} className="w-20 font-bold px-1.5 py-1.5 border-r border-black">Time Frame</th>
                      <th rowSpan={2} className="font-bold px-1.5 py-1.5 border-r border-black">Intended Learning Outcome</th>
                      <th colSpan={3} className="w-20 font-bold px-1 py-1 border-r border-black border-b border-black">
                        TOPIC – CILO Mapping
                      </th>
                      <th rowSpan={2} className="font-bold px-1.5 py-1.5 border-r border-black">
                        Assessment (Intended Learning Outcomes)
                      </th>
                      <th rowSpan={2} className="font-bold px-1.5 py-1.5 border-r border-black">
                        Teaching - Learning Activities
                      </th>
                      <th rowSpan={2} className="font-bold px-1.5 py-1.5 border-r border-black">Learning Content</th>
                      <th rowSpan={2} className="font-bold px-1.5 py-1.5 border-r border-black">Resources</th>
                      <th rowSpan={2} className="w-8" />
                    </tr>
                    <tr className="bg-[#D9D9D9] border-b border-black text-center">
                      <th className="w-6 font-normal py-0.5 border-r border-black">1</th>
                      <th className="w-6 font-normal py-0.5 border-r border-black">2</th>
                      <th className="w-6 font-normal py-0.5 border-r border-black">3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.weeklyPlan.map((row, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0">
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.timeFrame}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], timeFrame: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            placeholder="Wk 1-2"
                            className={cellInput}
                          />
                        </td>
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.intendedLearningOutcome}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], intendedLearningOutcome: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            className={cellInput}
                          />
                        </td>
                        {(['1', '2', '3'] as const).map((cNum) => {
                          const checked = row.ciloMapping.includes(cNum);
                          return (
                            <td key={cNum} className="text-center border-r border-black align-middle">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = [...content.weeklyPlan];
                                  const cur = new Set(next[idx].ciloMapping);
                                  if (e.target.checked) cur.add(cNum);
                                  else cur.delete(cNum);
                                  next[idx] = { ...next[idx], ciloMapping: Array.from(cur).sort() };
                                  setContent({ ...content, weeklyPlan: next });
                                }}
                                className="w-3.5 h-3.5 accent-[#005A36] cursor-pointer"
                              />
                            </td>
                          );
                        })}
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.assessment}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], assessment: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            className={cellInput}
                          />
                        </td>
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.teachingLearningActivities}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], teachingLearningActivities: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            className={cellInput}
                          />
                        </td>
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.learningContent}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], learningContent: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            className={cellInput}
                          />
                        </td>
                        <td className="p-0.5 border-r border-black align-top">
                          <textarea
                            rows={2}
                            value={row.resources}
                            onChange={(e) => {
                              const next = [...content.weeklyPlan];
                              next[idx] = { ...next[idx], resources: e.target.value };
                              setContent({ ...content, weeklyPlan: next });
                            }}
                            className={cellInput}
                          />
                        </td>
                        <td className="text-center align-middle p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                weeklyPlan: content.weeklyPlan.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({
                        ...content,
                        weeklyPlan: [
                          ...content.weeklyPlan,
                          {
                            timeFrame: '',
                            intendedLearningOutcome: '',
                            ciloMapping: [],
                            assessment: '',
                            teachingLearningActivities: '',
                            learningContent: '',
                            resources: '',
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Learning Plan Row</span>
                  </button>
                </div>
              </div>

              {/* INTEGRATION SCHEMES */}
              <div className="space-y-1.5">
                <table className="w-full border-collapse border-2 border-black text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b-2 border-black">
                      <th className="text-left font-bold px-2.5 py-1 uppercase">INTEGRATION SCHEMES</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 space-y-2">
                        {content.integrationSchemes.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="mt-1.5">●</span>
                            <input
                              type="text"
                              value={item.coreValue}
                              onChange={(e) => {
                                const next = [...content.integrationSchemes];
                                next[idx] = { ...next[idx], coreValue: e.target.value };
                                setContent({ ...content, integrationSchemes: next });
                              }}
                              className="w-44 font-bold italic bg-transparent hover:bg-emerald-50/40 focus:bg-emerald-50/70 focus:outline-none focus:ring-1 focus:ring-[#005A36] px-1.5 py-1"
                            />
                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={(e) => {
                                const next = [...content.integrationSchemes];
                                next[idx] = { ...next[idx], description: e.target.value };
                                setContent({ ...content, integrationSchemes: next });
                              }}
                              className={`${cellInput} italic flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setContent({
                                  ...content,
                                  integrationSchemes: content.integrationSchemes.filter((_, i) => i !== idx),
                                })
                              }
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({
                        ...content,
                        integrationSchemes: [...content.integrationSchemes, { coreValue: '', description: '' }],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Integration Scheme</span>
                  </button>
                </div>
              </div>

              {/* OWAT GRADING SYSTEM (Exact Maroon-Bordered Table) */}
              <div className="space-y-2 max-w-3xl mx-auto">
                <table className="w-full border-collapse border border-[#B06C6C] text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b border-[#B06C6C]">
                      <th colSpan={5} className="text-left font-bold px-2.5 py-1.5 uppercase">
                        OWAT (OUTCOME WEIGHT ASSESSMENT TABLE) GRADING SYSTEM
                      </th>
                    </tr>
                    <tr className="border-b border-[#B06C6C] text-left bg-white">
                      <th className="w-[28%] font-normal px-2 py-1 border-r border-[#B06C6C]">Outcomes</th>
                      <th className="w-[16%] font-normal px-2 py-1 border-r border-[#B06C6C]">Total Weight</th>
                      <th className="w-[18%] font-normal px-2 py-1 border-r border-[#B06C6C]">Points Scoring</th>
                      <th className="font-normal px-2 py-1 border-r border-[#B06C6C]">Assessment Tool</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {content.owatGrading.map((group, gIdx) => {
                      const items = group.items.length > 0 ? group.items : [{ points: 0, tool: '' }];
                      return items.map((it, iIdx) => (
                        <tr key={`${gIdx}-${iIdx}`} className="border-b border-[#B06C6C]">
                          {iIdx === 0 && (
                            <>
                              <td rowSpan={items.length} className="p-1 border-r border-[#B06C6C] align-top">
                                <textarea
                                  rows={3}
                                  value={group.outcome}
                                  onChange={(e) => {
                                    const next = [...content.owatGrading];
                                    next[gIdx] = { ...next[gIdx], outcome: e.target.value };
                                    setContent({ ...content, owatGrading: next });
                                  }}
                                  className={cellInput}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...content.owatGrading];
                                    next[gIdx] = {
                                      ...next[gIdx],
                                      items: [...next[gIdx].items, { points: 100, tool: '' }],
                                    };
                                    setContent({ ...content, owatGrading: next });
                                  }}
                                  className="mt-1 font-sans text-[10px] font-bold text-[#005A36] hover:underline cursor-pointer"
                                >
                                  + Add Tool
                                </button>
                              </td>
                              <td rowSpan={items.length} className="p-1 border-r border-[#B06C6C] align-middle text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={group.totalWeight}
                                    onChange={(e) => {
                                      const next = [...content.owatGrading];
                                      next[gIdx] = { ...next[gIdx], totalWeight: Number(e.target.value) || 0 };
                                      setContent({ ...content, owatGrading: next });
                                    }}
                                    className="w-12 text-center bg-transparent hover:bg-emerald-50/40 focus:bg-emerald-50/70 focus:outline-none focus:ring-1 focus:ring-[#005A36] py-0.5"
                                  />
                                  <span>%</span>
                                </div>
                              </td>
                            </>
                          )}
                          <td className="p-0.5 border-r border-[#B06C6C] text-center">
                            <input
                              type="number"
                              min={0}
                              value={it.points}
                              onChange={(e) => {
                                const next = [...content.owatGrading];
                                const nextItems = [...items];
                                nextItems[iIdx] = { ...nextItems[iIdx], points: Number(e.target.value) || 0 };
                                next[gIdx] = { ...next[gIdx], items: nextItems };
                                setContent({ ...content, owatGrading: next });
                              }}
                              className={`${cellInput} text-center`}
                            />
                          </td>
                          <td className="p-0.5 border-r border-[#B06C6C]">
                            <input
                              type="text"
                              value={it.tool}
                              onChange={(e) => {
                                const next = [...content.owatGrading];
                                const nextItems = [...items];
                                nextItems[iIdx] = { ...nextItems[iIdx], tool: e.target.value };
                                next[gIdx] = { ...next[gIdx], items: nextItems };
                                setContent({ ...content, owatGrading: next });
                              }}
                              className={cellInput}
                            />
                          </td>
                          <td className="text-center p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...content.owatGrading];
                                const filtered = items.filter((_, i) => i !== iIdx);
                                if (filtered.length === 0) {
                                  setContent({
                                    ...content,
                                    owatGrading: content.owatGrading.filter((_, i) => i !== gIdx),
                                  });
                                } else {
                                  next[gIdx] = { ...next[gIdx], items: filtered };
                                  setContent({ ...content, owatGrading: next });
                                }
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({
                        ...content,
                        owatGrading: [
                          ...content.owatGrading,
                          { outcome: 'New Outcome', totalWeight: 0, items: [{ points: 100, tool: 'Assessment Tool' }] },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add OWAT Outcome Group</span>
                  </button>
                </div>
              </div>

              {/* REFERENCES */}
              <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                <thead>
                  <tr className="bg-[#D9D9D9] border-b border-black">
                    <th className="text-left font-bold px-2.5 py-1 uppercase">REFERENCES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1.5">
                      <textarea
                        rows={4}
                        value={content.references.join('\n')}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            references: e.target.value ? e.target.value.split('\n') : [],
                          })
                        }
                        placeholder="Enter textbooks, journals, and reference links (one per line)..."
                        className={`${cellInput} leading-relaxed`}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* EVALUATION RATING SCALE (Official Fixed USJ-R Table) */}
              <div className="max-w-2xl mx-auto space-y-1.5">
                <p className="text-center font-bold text-xs sm:text-[13px] uppercase">EVALUATION RATING SCALE</p>
                <table className="w-full border-collapse border border-black text-xs text-center">
                  <thead>
                    <tr className="border-b border-black bg-white font-bold">
                      <th className="w-24 py-1 px-2 border-r border-black">Score</th>
                      <th className="w-14 py-1 px-2 border-r border-black">FG</th>
                      <th colSpan={2} className="py-1 px-2 border-r border-black">Qualitative Remarks</th>
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
                            <td rowSpan={qual.span} className="py-1 px-2 border-r border-black align-middle">
                              {qual.label}
                            </td>
                          )}
                          {prof && (
                            <>
                              <td rowSpan={prof.span} className="py-1 px-2 border-r border-black align-middle">
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
                  <span className="underline">Outcome Based Education: Critical Issues and Answers</span> by Dr. William
                  G. Spady and Dr. Francis Aldrine A. Uy
                </p>
              </div>

              {/* COURSE POLICIES AND STANDARDS */}
              <div className="space-y-1.5">
                <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#D9D9D9] border-b border-black">
                      <th className="text-left font-bold px-2.5 py-1 uppercase">COURSE POLICIES AND STANDARDS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 space-y-3">
                        <p className="italic">
                          (Specific classroom guidelines of the course and the teacher, please describe policy as to:)
                        </p>
                        {content.coursePolicies.map((pol, idx) => (
                          <div key={idx} className="space-y-1 pl-2 border-l-2 border-slate-200">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={pol.section}
                                onChange={(e) => {
                                  const next = [...content.coursePolicies];
                                  next[idx] = { ...next[idx], section: e.target.value };
                                  setContent({ ...content, coursePolicies: next });
                                }}
                                className={`${cellInput} font-bold flex-1`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setContent({
                                    ...content,
                                    coursePolicies: content.coursePolicies.filter((_, i) => i !== idx),
                                  })
                                }
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <textarea
                              rows={Math.max(2, pol.items.length + 1)}
                              value={pol.items.join('\n')}
                              onChange={(e) => {
                                const next = [...content.coursePolicies];
                                next[idx] = { ...next[idx], items: e.target.value.split('\n') };
                                setContent({ ...content, coursePolicies: next });
                              }}
                              className={`${cellInput} leading-relaxed`}
                            />
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={() =>
                      setContent({
                        ...content,
                        coursePolicies: [...content.coursePolicies, { section: 'New Policy Section', items: [''] }],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Policy Section</span>
                  </button>
                </div>
              </div>

              {/* REMARKS SECTION */}
              <table className="w-full border-collapse border border-black text-xs sm:text-[13px]">
                <thead>
                  <tr className="bg-[#D9D9D9] border-b border-black">
                    <th className="text-left font-bold px-2.5 py-1 uppercase">REMARKS SECTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1.5">
                      <textarea
                        rows={3}
                        value={content.remarks}
                        onChange={(e) => setContent({ ...content, remarks: e.target.value })}
                        placeholder="Enter syllabus revision remarks..."
                        className={cellInput}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>
        </div>
      )}

      {/* MODE 2: LIVE ELECTRONIC SYLLABUS PREVIEW */}
      {viewMode === 'preview' && (
        <ElectronicSyllabusViewer
          syllabus={previewSyllabusObj}
          version={{
            versionNumber: nextVersionNumber,
            approvalStatus: 'DRAFT',
            changeSummary: changeSummary || 'Unsaved preview',
            editor: { fullName: currentUser?.fullName, role: currentUser?.role },
          }}
          contentOverride={content}
          versionsHistory={versionsHistory}
        />
      )}

      {/* MODE 3: SIDE-BY-SIDE DIFF PREVIEW AGAINST CURRENT EFFECTIVE VERSION */}
      {viewMode === 'diff' && baseVersion && (
        <SyllabusVersionCompare
          versionA={baseVersion}
          versionB={{
            versionNumber: nextVersionNumber,
            approvalStatus: 'DRAFT',
            changeSummary: changeSummary || 'Proposed changes (unsaved)',
            editor: { fullName: currentUser?.fullName, role: currentUser?.role },
            createdAt: new Date().toISOString(),
            content,
          }}
          subject={selectedSubject}
          departmentName={deptName}
        />
      )}
    </div>
  );
}
