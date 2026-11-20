'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import ElectronicSyllabusEditor from '@/components/ElectronicSyllabusEditor';
import { createDefaultSyllabusContent } from '@/lib/syllabus-template';

function NewSyllabusInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSubjectId = searchParams.get('subjectId') || '';

  const [subjects, setSubjects] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/subjects').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sData, uData]) => {
        if (sData?.subjects || sData?.courses) setSubjects(sData.subjects || sData.courses);
        if (uData?.user) setCurrentUser(uData.user);
      })
      .catch(() => setError('Failed to load department subjects from database.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Initializing USJ-R Electronic Syllabus Editor...</p>
        </div>
      </div>
    );
  }

  const canAuthor =
    currentUser &&
    (currentUser.role === 'Educator' ||
      currentUser.role === 'Faculty' ||
      currentUser.role === 'DepartmentHead');

  if (currentUser && !canAuthor) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">Syllabus Authoring Restricted</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Only <strong>Faculty</strong> and <strong>Department Heads</strong> are authorized to create or edit electronic course syllabi within their assigned department.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] text-white hover:bg-[#00472A] shadow-sm transition-all inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Portal</span>
          </Link>
        </div>
      </div>
    );
  }

  const matchedSubj = subjects.find((s) => String(s.id) === String(initialSubjectId)) || null;
  const initialContent = createDefaultSyllabusContent(
    matchedSubj,
    matchedSubj?.department?.name || currentUser?.departmentName || currentUser?.departmentCode
  );

  return (
    <ElectronicSyllabusEditor
      mode="create"
      currentUser={currentUser}
      subjects={subjects}
      initialSubjectId={initialSubjectId}
      initialContent={initialContent}
      submitting={submitting}
      error={error}
      onSubmit={async (payload) => {
        setSubmitting(true);
        setError('');
        try {
          const res = await fetch('/api/syllabi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectId: payload.subjectId,
              semester: payload.semester,
              academicYear: payload.academicYear,
              section: payload.section,
              changeSummary: payload.changeSummary,
              content: payload.content,
              saveAsDraft: payload.saveAsDraft,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Failed to save electronic syllabus.');
            setSubmitting(false);
            return;
          }
          router.push(`/syllabi/${data.syllabus.id}`);
        } catch {
          setError('Connection error while saving electronic syllabus.');
          setSubmitting(false);
        }
      }}
    />
  );
}

export default function NewSyllabusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
        </div>
      }
    >
      <NewSyllabusInner />
    </Suspense>
  );
}
