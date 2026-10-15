'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /courses redirects to the canonical /subjects page.
 * Seamlessly handles legacy bookmarks, URLs, and external links.
 */
export default function CoursesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/subjects');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#005A36] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Redirecting to Academic Subjects catalog...</p>
      </div>
    </div>
  );
}
