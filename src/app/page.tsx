'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';
import { homePathForRole } from '@/lib/status';

/** Entry point: sends signed-in users to their role's dashboard, everyone else to sign-in. */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => router.replace(data?.user ? homePathForRole(data.user.role) : '/login'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return <LoadingState className="min-h-[60vh]" />;
}
