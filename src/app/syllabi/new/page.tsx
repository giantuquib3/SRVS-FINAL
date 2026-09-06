'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  Calendar,
  Layers,
  GraduationCap,
  Upload,
  FileText,
  CheckCircle2,
  X
} from 'lucide-react';

export default function NewSyllabusPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [section, setSection] = useState('A');
  const [courseDescription, setCourseDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Dynamic arrays (start empty, user inputs all items dynamically)
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(['']);
  const [topics, setTopics] = useState<{ week: number; topic: string }[]>([
    { week: 1, topic: '' },
  ]);
  const [references, setReferences] = useState<string[]>(['']);
  const [gradingSystem, setGradingSystem] = useState<{ component: string; weight: number }[]>([
    { component: '', weight: 0 },
  ]);

  // Document upload state
  const [uploadedFile, setUploadedFile] = useState<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Load courses and current user dynamically
  useEffect(() => {
    Promise.all([
      fetch('/api/courses').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([cData, uData]) => {
        if (cData?.courses) setCourses(cData.courses);
        if (uData?.user) setCurrentUser(uData.user);
      })
      .catch(() => setError('Failed to load courses from database.'))
      .finally(() => setLoadingCourses(false));
  }, []);

  const handleCourseChange = (selectedId: string) => {
    setCourseId(selectedId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/syllabi/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to upload document.');
        return;
      }
      setUploadedFile(data);
    } catch (err: any) {
      setError('Connection error while uploading document.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Outcome helpers
  const addOutcome = () => setLearningOutcomes([...learningOutcomes, '']);
  const updateOutcome = (idx: number, val: string) => {
    const updated = [...learningOutcomes];
    updated[idx] = val;
    setLearningOutcomes(updated);
  };
  const removeOutcome = (idx: number) => {
    setLearningOutcomes(learningOutcomes.filter((_, i) => i !== idx));
  };

  // Topic helpers
  const addTopic = () => {
    const nextWeek = topics.length + 1;
    setTopics([...topics, { week: nextWeek, topic: '' }]);
  };
  const updateTopic = (idx: number, field: 'week' | 'topic', val: any) => {
    const updated = [...topics];
    updated[idx] = { ...updated[idx], [field]: val };
    setTopics(updated);
  };
  const removeTopic = (idx: number) => {
    setTopics(topics.filter((_, i) => i !== idx));
  };

  // Reference helpers
  const addReference = () => setReferences([...references, '']);
  const updateReference = (idx: number, val: string) => {
    const updated = [...references];
    updated[idx] = val;
    setReferences(updated);
  };
  const removeReference = (idx: number) => {
    setReferences(references.filter((_, i) => i !== idx));
  };

  // Grading helpers
  const addGradingComponent = () =>
    setGradingSystem([...gradingSystem, { component: '', weight: 10 }]);
  const updateGradingComponent = (idx: number, field: 'component' | 'weight', val: any) => {
    const updated = [...gradingSystem];
    updated[idx] = { ...updated[idx], [field]: val };
    setGradingSystem(updated);
  };
  const removeGradingComponent = (idx: number) => {
    setGradingSystem(gradingSystem.filter((_, i) => i !== idx));
  };

  const handleSave = async (submitForApproval: boolean, directApprove: boolean = false) => {
    setError('');

    if (!courseId) {
      setError('Please select a course for this syllabus.');
      return;
    }

    if (!uploadedFile && !courseDescription.trim()) {
      setError('Please enter a course description or upload a syllabus document (PDF/DOCX).');
      return;
    }

    setSubmitting(true);

    const payload = {
      courseId,
      academicYear,
      semester,
      section: section || 'A',
      directApprove,
      schedule,
      courseDescription,
      learningOutcomes: learningOutcomes.filter((o) => o.trim().length > 0),
      topics: topics.filter((t) => t.topic.trim().length > 0),
      references: references.filter((r) => r.trim().length > 0),
      gradingSystem: gradingSystem.filter((g) => g.component.trim().length > 0),
      saveAsDraft: !submitForApproval && !directApprove,
      fileName: uploadedFile?.fileName,
      fileUrl: uploadedFile?.fileUrl,
      fileType: uploadedFile?.fileType,
      fileSize: uploadedFile?.fileSize,
    };

    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save syllabus.');
        setSubmitting(false);
        return;
      }

      router.push(`/syllabi/${data.syllabus.id}`);
    } catch (err) {
      setError('Connection error. Could not save syllabus.');
      setSubmitting(false);
    }
  };

  const isDeptHeadOrAdmin = currentUser?.role === 'DepartmentHead' || currentUser?.role === 'Admin';

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3">
          <Link
            href={currentUser?.role === 'DepartmentHead' ? '/dept/dashboard' : '/educator/dashboard'}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30">
                Syllabus Authoring
              </span>
              <span className="text-xs text-slate-500 font-medium">USJ-R Academic Format</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#005A36] mt-1">
              Create Course Syllabus
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(false, false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#005A36]" />
            <span>Save as Draft</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(true, false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
            <span>Submit for Approval</span>
          </button>
          {isDeptHeadOrAdmin && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(true, true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Publish immediately as active official syllabus"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve & Publish</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured Input Form */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Section 1: Subject Identification */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
            <BookOpen className="w-4 h-4 text-[#005A36]" />
            <span>1. Course & Academic Period</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Course / Subject *
              </label>
              {loadingCourses ? (
                <div className="text-xs text-slate-500 py-2">Loading courses...</div>
              ) : (
                <select
                  value={courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                >
                  <option value="">-- Select Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
              >
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="Summer Term">Summer Term</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Academic Year</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026-2027"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Section</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. A, B, 1"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Class Schedule</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Class schedule (days and time)"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Course Description *</label>
            <textarea
              rows={3}
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              placeholder="Provide a comprehensive course description aligned with USJ-R curriculum standards..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
            />
          </div>
        </div>

        {/* Section: Upload Syllabus Document (PDF, DOC, DOCX) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider flex items-center space-x-2">
                <Upload className="w-4 h-4 text-[#005A36]" />
                <span>Upload Syllabus Document (PDF, DOC, DOCX)</span>
              </h2>
              <p className="text-xs text-slate-500">
                You may upload an official syllabus document file for Department Head review and student distribution.
              </p>
            </div>
          </div>

          {uploadedFile ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-white border border-emerald-200 text-[#005A36]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                    <span>{uploadedFile.fileName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800">
                      {uploadedFile.fileType}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    File uploaded • Ready for submission • Size: {(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadedFile(null)}
                className="p-1.5 text-emerald-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Remove attached file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative border-2 border-dashed border-slate-300 hover:border-[#005A36] rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center space-y-2 pointer-events-none">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#005A36]">
                  {uploadingFile ? (
                    <span className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-700">
                  {uploadingFile ? 'Uploading file to SRVS...' : 'Click to select or drag & drop syllabus file'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Supports PDF (.pdf), Microsoft Word (.doc, .docx) • Max 15MB
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Learning Outcomes (Dynamic Add/Remove) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
              2. Course Learning Outcomes (CLOs)
            </h2>
            <button
              type="button"
              onClick={addOutcome}
              className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Outcome</span>
            </button>
          </div>

          <div className="space-y-2">
            {learningOutcomes.map((outcome, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono w-6 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => updateOutcome(idx, e.target.value)}
                  placeholder="Enter learning outcome..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
                {learningOutcomes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOutcome(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Course Topics (Dynamic Add/Remove) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
              3. Weekly Topics / Course Outline
            </h2>
            <button
              type="button"
              onClick={addTopic}
              className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic</span>
            </button>
          </div>

          <div className="space-y-2">
            {topics.map((t, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-slate-500 font-bold">Wk</span>
                  <input
                    type="number"
                    value={t.week}
                    onChange={(e) => updateTopic(idx, 'week', Number(e.target.value))}
                    className="w-14 bg-white border border-slate-300 rounded-xl px-2 py-2 text-center text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                </div>
                <input
                  type="text"
                  value={t.topic}
                  onChange={(e) => updateTopic(idx, 'topic', e.target.value)}
                  placeholder="Topic outline and lecture content..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
                {topics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTopic(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Grading System & References */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          {/* Grading System */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
                4. Grading Criteria
              </h2>
              <button
                type="button"
                onClick={addGradingComponent}
                className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {gradingSystem.map((g, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={g.component}
                    onChange={(e) => updateGradingComponent(idx, 'component', e.target.value)}
                    placeholder="Component name..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={g.weight}
                      onChange={(e) => updateGradingComponent(idx, 'weight', Number(e.target.value))}
                      className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-2 text-center text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                    />
                    <span className="text-xs text-slate-600 font-bold">%</span>
                  </div>
                  {gradingSystem.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGradingComponent(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* References */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
                5. References & Textbooks
              </h2>
              <button
                type="button"
                onClick={addReference}
                className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Reference</span>
              </button>
            </div>

            <div className="space-y-2">
              {references.map((r, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={r}
                    onChange={(e) => updateReference(idx, e.target.value)}
                    placeholder="Title, author, edition, or online citation..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                  {references.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeReference(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Drafts are strictly private to you. Submitting for approval routes this syllabus to your Department Head.
            </div>
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSave(false, false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#005A36]" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSave(true, false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#FEF08A]" />
                <span>Submit for Approval</span>
              </button>
              {isDeptHeadOrAdmin && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave(true, true)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Publish immediately as active official syllabus"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Publish</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

