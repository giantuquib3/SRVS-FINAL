'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import ElectronicSyllabusEditor from '@/components/ElectronicSyllabusEditor';
import { EmptyState, LoadingState } from '@/components/ui';
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

  const isFaculty = currentUser?.role === 'Educator' || currentUser?.role === 'Faculty';

  useEffect(() => {
    Promise.all([
      fetch('/api/subjects').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sData, uData]) => {
        if (sData?.subjects || sData?.courses) setSubjects(sData.subjects || sData.courses);
        if (uData?.user) {
          setCurrentUser(uData.user);
          if (uData.user.role === 'Educator' || uData.user.role === 'Faculty') router.replace('/educator/dashboard');
        }
      })
      .catch(() => setError('Failed to load department courses.'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || isFaculty) return <LoadingState className="min-h-[60vh]" />;

  if (currentUser && currentUser.role !== 'DepartmentHead') {
    return (
      <EmptyState
        icon={Lock}
        title="Only Department Heads can create syllabi"
        description="Every course starts with a Version 1 syllabus. Department Heads can create one if it’s missing."
        action={
          <Link href="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      />
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
            setError(data.error || 'Failed to save syllabus.');
            setSubmitting(false);
            return;
          }
          router.push(`/syllabi/${data.syllabus.id}`);
        } catch {
          setError('Could not connect to the server.');
          setSubmitting(false);
        }
      }}
    />
  );
}

export default function NewSyllabusPage() {
  return (
    <Suspense fallback={<LoadingState className="min-h-[60vh]" />}>
      <NewSyllabusInner />
    </Suspense>
  );
}
