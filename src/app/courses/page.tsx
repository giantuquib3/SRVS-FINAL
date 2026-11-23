'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';

/** Legacy URL: /courses now lives at /subjects. */
export default function CoursesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/subjects');
  }, [router]);

  return <LoadingState className="min-h-[60vh]" label="Redirecting…" />;
}
