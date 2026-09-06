'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  History,
  FileEdit,
  Send,
  Printer,
  ArrowLeft,
  Calendar,
  Layers,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  GitBranch,
  Download,
  FileText,
  XCircle
} from 'lucide-react';

export default function SyllabusViewerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/syllabi/${id}`).then((r) => r.json()),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([syllabusData, userData]) => {
        if (syllabusData.error) {
          setError(syllabusData.error);
        } else {
          setData(syllabusData);
        }
        if (userData?.user) setCurrentUser(userData.user);
      })
      .catch(() => setError('Failed to load syllabus.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Retrieving official syllabus snapshot...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.syllabus) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Syllabus Not Found'}</h2>
        <p className="text-xs text-slate-500">
          The requested syllabus does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const { syllabus, currentVersion } = data;
  const content = currentVersion?.content || {};
  const outcomes = content.learningOutcomes || [];
  const topics = content.topics || [];
  const references = content.references || [];
  const grading = content.gradingSystem || [];

  const isOwner = currentUser?.id === syllabus.instructorId;
  const isAdmin = currentUser?.role === 'Admin';
  const isDeptHead = currentUser?.role === 'DepartmentHead';
  const canEdit = isOwner || isAdmin || (isDeptHead && syllabus.departmentId === currentUser?.departmentId);
  const canViewHistory = currentUser && currentUser.role !== 'Student';

  const isDraftOrRejected =
    currentVersion?.approvalStatus === 'DRAFT' ||
    currentVersion?.approvalStatus === 'REJECTED' ||
    syllabus.status === 'DRAFT' ||
    syllabus.status === 'Draft' ||
    syllabus.status === 'Rejected';

  const handleSubmitForApproval = async () => {
    if (!currentVersion) return;
    setSubmittingVersion(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`/api/syllabi/${syllabus.id}/versions/${currentVersion.versionNumber}/submit`, {
        method: 'POST',
      });
      const resJson = await res.json();
      if (!res.ok) {
        setError(resJson.error || 'Failed to submit version.');
        return;
      }
      setSuccessMessage(resJson.message || 'Syllabus version submitted for Department Head approval.');
      const updatedData = await fetch(`/api/syllabi/${id}`).then((r) => r.json());
      setData(updatedData);
    } catch (err) {
      setError('Connection error.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-[#005A36]">{syllabus.course.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-medium">{syllabus.semester}, AY {syllabus.academicYear}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{syllabus.course.title}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#005A36]" />
            <span>Print / PDF</span>
          </button>

          {canViewHistory && (
            <Link
              href={`/syllabi/${syllabus.id}/versions`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30 shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-[#CA8A04]" />
              <span>Version History</span>
            </Link>
          )}

          {isDraftOrRejected && canEdit && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submittingVersion}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {submittingVersion ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
                  <span>Submit for Approval</span>
                </>
              )}
            </button>
          )}

          {canEdit && (
            <Link
              href={`/syllabi/${syllabus.id}/edit`}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <FileEdit className="w-3.5 h-3.5 text-[#005A36]" />
              <span>Revise Syllabus</span>
            </Link>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#005A36]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Reviewer Feedback Notice if Rejected */}
      {(syllabus.status === 'Rejected' || currentVersion?.approvalStatus === 'REJECTED') && (currentVersion?.rejectionReason || syllabus.reviewerRemarks) && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
          <div className="font-bold flex items-center justify-between text-rose-700">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Department Head Reviewer Feedback (Revision Required):</span>
            </div>
            {canEdit && (
              <Link
                href={`/syllabi/${syllabus.id}/edit`}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-sm"
              >
                Revise and Resubmit Now
              </Link>
            )}
          </div>
          <p className="text-slate-800 pl-5 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-100 font-medium">
            &ldquo;{currentVersion?.rejectionReason || syllabus.reviewerRemarks}&rdquo;
          </p>
        </div>
      )}

      {/* Syllabus Document Container (USJ-R Academic Paper View) */}
      <div className="bg-white p-8 sm:p-12 rounded-3xl space-y-8 border border-slate-200 shadow-sm text-slate-800 print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="text-center space-y-2 border-b border-slate-200 pb-6">
          <p className="text-xs uppercase tracking-widest text-[#005A36] font-extrabold">
            {syllabus.department.name}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 print:text-black">
            {syllabus.course.code}: {syllabus.course.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 pt-1 font-medium">
            <span>Term: {syllabus.semester}</span>
            <span>•</span>
            <span>Academic Year: {syllabus.academicYear}</span>
            <span>•</span>
            <span>Instructor: {syllabus.instructor.fullName}</span>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FEF9C3] border border-[#CA8A04]/30 text-[#854D0E] flex items-center space-x-1">
              <History className="w-3.5 h-3.5 text-[#CA8A04]" />
              <span>Snapshot: Version {currentVersion?.versionNumber || syllabus.currentVersionNumber}</span>
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                (currentVersion?.approvalStatus === 'APPROVED' || syllabus.status === 'ACTIVE' || syllabus.status === 'Approved')
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : currentVersion?.approvalStatus === 'PENDING_APPROVAL'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : currentVersion?.approvalStatus === 'REJECTED' || syllabus.status === 'Rejected'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Approval Status: {(currentVersion?.approvalStatus || syllabus.status).replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Uploaded File Download Card */}
        {currentVersion?.fileUrl && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-white border border-sky-200 text-sky-700 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sky-950 flex items-center space-x-2">
                  <span>Attached Syllabus File ({currentVersion.fileType || 'PDF'})</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono">
                    {currentVersion.fileName}
                  </span>
                </div>
                <div className="text-[11px] text-sky-700">
                  Official syllabus document uploaded for this version
                </div>
              </div>
            </div>
            <a
              href={currentVersion.fileUrl}
              download={currentVersion.fileName || 'syllabus.pdf'}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Syllabus File</span>
            </a>
          </div>
        )}

        {/* Schedule & Metadata */}
        {content.schedule && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-3 text-xs">
            <Clock className="w-4 h-4 text-[#005A36] shrink-0" />
            <div>
              <span className="font-bold text-slate-700">Class Schedule: </span>
              <span className="text-slate-900">{content.schedule}</span>
            </div>
          </div>
        )}

        {/* 1. Course Description */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
            I. Course Description
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            {content.courseDescription || syllabus.course.description || 'No course description provided.'}
          </p>
        </section>

        {/* 2. Learning Outcomes */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
            II. Course Learning Outcomes (CLOs)
          </h3>
          {outcomes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No learning outcomes specified.</p>
          ) : (
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 pl-1">
              {outcomes.map((outcome: string, idx: number) => (
                <li key={idx} className="leading-relaxed">
                  <span className="ml-1 font-medium">{outcome}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 3. Course Topics Outline */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
            III. Weekly Course Outline & Topics
          </h3>
          {topics.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No topics outline specified.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-24">Week</th>
                    <th className="py-2.5 px-4">Lecture / Laboratory Topic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topics.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono font-bold text-[#005A36]">
                        Week {t.week}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800 font-medium">{t.topic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Grading System */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
            IV. Assessment & Grading System
          </h3>
          {grading.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No grading criteria specified.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {grading.map((g: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-800 font-semibold">{g.component}</span>
                  <span className="font-extrabold text-[#005A36]">{g.weight}%</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. References */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005A36] border-b border-slate-100 pb-1">
            V. Required References & Textbooks
          </h3>
          {references.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No references specified.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 pl-1">
              {references.map((r: string, idx: number) => (
                <li key={idx} className="leading-relaxed">
                  <span className="ml-1">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Version Footnote */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>
            Document Snapshot: Version {currentVersion.versionNumber} ({currentVersion.changeSummary})
          </span>
          <span>
            USJ-R SRVS Academic Repository • Date: {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
