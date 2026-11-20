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
  createDefaultSyllabusContent,
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
  const [academicYear, setAcademicYear] = useState<string>(syllabus?.academicYear || '2026-2027');
  const [section] = useState<string>(syllabus?.section || 'A');
  const [changeSummary, setChangeSummary] = useState<string>(
    mode === 'create' ? 'Initial electronic syllabus creation (Version 1)' : ''
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
    getProgramNameForDepartment(deptCode);

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

  const totalGradingWeight = content.owatGrading.reduce((sum, g) => sum + (Number(g.totalWeight) || 0), 0);

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
    if (!content.courseDescription.trim()) {
      setLocalError('Course Description cannot be empty.');
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
      changeSummary: changeSummary.trim() || 'Initial electronic syllabus creation (Version 1)',
      content: {
        ...content,
        generatedFromSubject: false,
      },
      saveAsDraft: !submitForApproval,
      submitForApproval,
    });
  };

  const displayedError = localError || error;
  const inputCls =
    'w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-[#005A36] focus:outline-none focus:ring-1 focus:ring-[#005A36] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 transition-colors';

  const units = selectedSubject?.units ?? content.subjectSnapshot?.units ?? 3;
  const lecHours = selectedSubject?.lecHours ?? content.subjectSnapshot?.lecHours ?? 3;
  const labHours = selectedSubject?.labHours ?? content.subjectSnapshot?.labHours ?? 0;
  const prerequisite = selectedSubject?.prerequisite || content.subjectSnapshot?.prerequisite || 'None';
  const yearLevel = selectedSubject?.yearLevel || content.subjectSnapshot?.yearLevel || '1st Year';
  const catalogSemester = selectedSubject?.semester || content.subjectSnapshot?.semester || semester;
  const assignedInstructor =
    selectedSubject?.professorName ||
    content.subjectSnapshot?.professorName ||
    syllabus?.instructor?.fullName ||
    'To be assigned';

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
                ? 'Create Electronic Course Syllabus'
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
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
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
          <div>
            <label className="block font-bold text-slate-700 mb-1">Academic Year *</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36]"
            />
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
          <span className="text-[11px] text-slate-500 font-medium">Recorded in Revision History</span>
        </div>
        <input
          type="text"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="Summarize what you updated (e.g., Added course learning outcomes, weekly topics, and grading weights)"
          className="w-full bg-white border border-[#CA8A04]/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36]"
        />
      </div>

      {/* Mode Switcher Bar: Edit | Preview | Preview Changes */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'edit'
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'preview'
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'diff'
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
            {content.owatGrading.length > 0 && (
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  totalGradingWeight === 100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                Grading Total: {totalGradingWeight}%
              </span>
            )}
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

      {/* MODE 1: DIRECT INLINE ELECTRONIC SYLLABUS EDITOR */}
      {viewMode === 'edit' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-100/90 p-4 sm:p-6 overflow-auto">
          <div
            className="mx-auto transition-transform origin-top"
            style={{
              maxWidth: '920px',
              transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
              marginBottom: zoom > 100 ? `${(zoom - 100) * 8}px` : undefined,
            }}
          >
            <article className="bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden text-slate-900">
              {/* Institutional Banner */}
              <div className="bg-gradient-to-r from-[#005A36] via-[#006B41] to-[#005A36] px-6 py-4 flex flex-wrap items-center justify-between gap-2 border-b-4 border-[#C99700]">
                <div>
                  <div className="text-base sm:text-lg font-black tracking-tight text-white">
                    {USJR_INSTITUTIONAL_HEADER.university}
                  </div>
                  <div className="text-[11px] font-medium text-emerald-100">
                    {USJR_INSTITUTIONAL_HEADER.location} • {USJR_INSTITUTIONAL_HEADER.status}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FEF08A] text-[#854D0E] text-[11px] font-extrabold font-mono uppercase">
                  Editing → Target Version {nextVersionNumber}
                </span>
              </div>

              <div className="p-6 sm:p-9 space-y-7 text-xs">
                {/* Department & Course Title */}
                <div className="text-center space-y-1 border-b border-slate-200 pb-5">
                  <p className="text-xs font-extrabold tracking-widest text-[#005A36] uppercase">{deptName}</p>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {selectedSubject?.code
                      ? `${selectedSubject.code}: ${selectedSubject.title}`
                      : 'Course Syllabus'}
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Official Electronic Course Syllabus • {semester}, AY {academicYear}
                  </p>
                </div>

                {/* Subject Catalog Details (Read-Only from Subject) + Editable Metadata */}
                <section className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                    <span>Course Details & Specifications</span>
                  </h3>

                  <div className="overflow-x-auto border border-slate-300 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <th className="w-36 bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Subject Code
                          </th>
                          <td className="px-3 py-2 font-mono font-extrabold text-[#005A36] border-r border-slate-200">
                            {selectedSubject?.code || '—'}
                          </td>
                          <th className="w-36 bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Department
                          </th>
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {deptCode ? `[${deptCode}] ${deptName}` : deptName}
                          </td>
                        </tr>
                        <tr>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Course Title
                          </th>
                          <td colSpan={3} className="px-3 py-2 font-bold text-slate-900">
                            {selectedSubject?.title || '—'}
                          </td>
                        </tr>
                        <tr>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Units & Hours
                          </th>
                          <td className="px-3 py-2 text-slate-800 border-r border-slate-200">
                            <strong>{units} Units</strong> ({lecHours} hr Lec, {labHours} hr Lab)
                          </td>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Prerequisite(s)
                          </th>
                          <td className="px-3 py-2 text-slate-800">{prerequisite}</td>
                        </tr>
                        <tr>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Curriculum Level
                          </th>
                          <td className="px-3 py-2 text-slate-800 border-r border-slate-200">
                            {yearLevel} — {catalogSemester}
                          </td>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Assigned Faculty
                          </th>
                          <td className="px-3 py-2 font-semibold text-slate-800">{assignedInstructor}</td>
                        </tr>
                        <tr>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Co-Requisite(s)
                          </th>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={content.coRequisites}
                              onChange={(e) => setContent({ ...content, coRequisites: e.target.value })}
                              placeholder="None"
                              className={inputCls}
                            />
                          </td>
                          <th className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-r border-slate-200">
                            Class Schedule
                          </th>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={content.schedule}
                              onChange={(e) => setContent({ ...content, schedule: e.target.value })}
                              placeholder="e.g., MWF 9:00–10:00 AM"
                              className={inputCls}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Course Description */}
                <section className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                    <span>Course Description *</span>
                  </label>
                  <textarea
                    rows={4}
                    value={content.courseDescription}
                    onChange={(e) => setContent({ ...content, courseDescription: e.target.value })}
                    placeholder="Enter course description and scope..."
                    className={`${inputCls} p-3 leading-relaxed`}
                  />
                </section>

                {/* Course Learning Outcomes (Optional — Add Inline) */}
                <section className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Course Learning Outcomes ({content.cilos.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setContent({
                          ...content,
                          cilos: [
                            ...content.cilos,
                            {
                              code: `CLO ${content.cilos.length + 1}`,
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
                      <span>Add Outcome</span>
                    </button>
                  </div>

                  {content.cilos.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No learning outcomes added yet. Click &ldquo;Add Outcome&rdquo; to define measurable course outcomes.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {content.cilos.map((cilo, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <input
                            type="text"
                            value={cilo.code}
                            onChange={(e) => {
                              const next = [...content.cilos];
                              next[idx] = { ...next[idx], code: e.target.value };
                              setContent({ ...content, cilos: next });
                            }}
                            className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-[#005A36]"
                          />
                          <textarea
                            rows={2}
                            value={cilo.description}
                            onChange={(e) => {
                              const next = [...content.cilos];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setContent({ ...content, cilos: next });
                            }}
                            placeholder="Describe what students will be able to do upon completing this course..."
                            className={`${inputCls} flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setContent({ ...content, cilos: content.cilos.filter((_, i) => i !== idx) })
                            }
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Course Outline / Weekly Topics (Optional — Add Inline) */}
                <section className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Course Outline / Weekly Topics ({content.weeklyPlan.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setContent({
                          ...content,
                          weeklyPlan: [
                            ...content.weeklyPlan,
                            {
                              timeFrame: `Week ${content.weeklyPlan.length + 1}`,
                              learningContent: '',
                              intendedLearningOutcome: '',
                              ciloMapping: [],
                              teachingLearningActivities: '',
                              assessment: '',
                              resources: '',
                            },
                          ],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Topic / Week</span>
                    </button>
                  </div>

                  {content.weeklyPlan.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No course outline rows added yet. Click &ldquo;Add Topic / Week&rdquo; to outline weekly lessons.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {content.weeklyPlan.map((row, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.timeFrame}
                              onChange={(e) => {
                                const next = [...content.weeklyPlan];
                                next[idx] = { ...next[idx], timeFrame: e.target.value };
                                setContent({ ...content, weeklyPlan: next });
                              }}
                              placeholder="Week 1–2"
                              className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#005A36]"
                            />
                            <input
                              type="text"
                              value={row.learningContent}
                              onChange={(e) => {
                                const next = [...content.weeklyPlan];
                                next[idx] = { ...next[idx], learningContent: e.target.value };
                                setContent({ ...content, weeklyPlan: next });
                              }}
                              placeholder="Topic / Learning Content"
                              className={`${inputCls} flex-1 font-semibold`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setContent({
                                  ...content,
                                  weeklyPlan: content.weeklyPlan.filter((_, i) => i !== idx),
                                })
                              }
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={row.intendedLearningOutcome}
                              onChange={(e) => {
                                const next = [...content.weeklyPlan];
                                next[idx] = { ...next[idx], intendedLearningOutcome: e.target.value };
                                setContent({ ...content, weeklyPlan: next });
                              }}
                              placeholder="Intended Outcome"
                              className={inputCls}
                            />
                            <input
                              type="text"
                              value={row.teachingLearningActivities}
                              onChange={(e) => {
                                const next = [...content.weeklyPlan];
                                next[idx] = { ...next[idx], teachingLearningActivities: e.target.value };
                                setContent({ ...content, weeklyPlan: next });
                              }}
                              placeholder="Learning Activities"
                              className={inputCls}
                            />
                            <input
                              type="text"
                              value={row.assessment}
                              onChange={(e) => {
                                const next = [...content.weeklyPlan];
                                next[idx] = { ...next[idx], assessment: e.target.value };
                                setContent({ ...content, weeklyPlan: next });
                              }}
                              placeholder="Assessment Task"
                              className={inputCls}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Grading System & Assessment (Optional — Add Inline) */}
                <section className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Grading System & Assessment ({content.owatGrading.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setContent({
                          ...content,
                          owatGrading: [
                            ...content.owatGrading,
                            { outcome: '', totalWeight: 0, items: [] },
                          ],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Grading Component</span>
                    </button>
                  </div>

                  {content.owatGrading.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No grading components added yet. Click &ldquo;Add Grading Component&rdquo; to set grade weights.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {content.owatGrading.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <input
                            type="text"
                            value={g.outcome}
                            onChange={(e) => {
                              const next = [...content.owatGrading];
                              next[idx] = { ...next[idx], outcome: e.target.value };
                              setContent({ ...content, owatGrading: next });
                            }}
                            placeholder="Component (e.g., Quizzes & Assignments, Midterm Exam, Final Project)"
                            className={`${inputCls} flex-1`}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={g.totalWeight}
                              onChange={(e) => {
                                const next = [...content.owatGrading];
                                next[idx] = { ...next[idx], totalWeight: Number(e.target.value) || 0 };
                                setContent({ ...content, owatGrading: next });
                              }}
                              className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-right"
                            />
                            <span className="text-xs font-bold text-slate-500">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                owatGrading: content.owatGrading.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Learning Resources & References (Optional — Add Inline) */}
                <section className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Learning Resources & References ({content.references.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setContent({ ...content, references: [...content.references, ''] })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Reference</span>
                    </button>
                  </div>

                  {content.references.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No references added yet. Click &ldquo;Add Reference&rdquo; to list textbooks or online materials.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {content.references.map((ref, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-400 w-6 text-right">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={ref}
                            onChange={(e) => {
                              const next = [...content.references];
                              next[idx] = e.target.value;
                              setContent({ ...content, references: next });
                            }}
                            placeholder="Author (Year). Title. Publisher."
                            className={`${inputCls} flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                references: content.references.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Course Policies & Guidelines (Optional — Add Inline) */}
                <section className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                      <span>Course Policies & Guidelines ({content.coursePolicies.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setContent({
                          ...content,
                          coursePolicies: [...content.coursePolicies, { section: '', items: [''] }],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Policy</span>
                    </button>
                  </div>

                  {content.coursePolicies.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No course policies added yet. Click &ldquo;Add Policy&rdquo; to include attendance or classroom guidelines.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {content.coursePolicies.map((pol, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={pol.section}
                              onChange={(e) => {
                                const next = [...content.coursePolicies];
                                next[idx] = { ...next[idx], section: e.target.value };
                                setContent({ ...content, coursePolicies: next });
                              }}
                              placeholder="Policy Heading (e.g., Attendance, Academic Integrity)"
                              className={`${inputCls} font-bold flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setContent({
                                  ...content,
                                  coursePolicies: content.coursePolicies.filter((_, i) => i !== idx),
                                })
                              }
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={pol.items.join('\n')}
                            onChange={(e) => {
                              const next = [...content.coursePolicies];
                              next[idx] = { ...next[idx], items: e.target.value.split('\n') };
                              setContent({ ...content, coursePolicies: next });
                            }}
                            placeholder="Enter policy guidelines (one item per line)..."
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Remarks */}
                <section className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-xs font-black uppercase tracking-wider text-[#005A36] flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#C99700] inline-block" />
                    <span>Remarks / Revision Notes</span>
                  </label>
                  <textarea
                    rows={2}
                    value={content.remarks}
                    onChange={(e) => setContent({ ...content, remarks: e.target.value })}
                    placeholder="Additional notes or remarks for this syllabus revision..."
                    className={inputCls}
                  />
                </section>
              </div>
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
