'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import AuthCard from '@/components/AuthCard';
import { Alert, Field, Spinner } from '@/components/ui';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [accountInfo, setAccountInfo] = useState<{ email: string; fullName: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setTokenValid(false);
      setTokenError('No reset token was provided. Please use the link sent to your email or request a new one.');
      setVerifying(false);
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.valid) {
          setTokenValid(true);
          setAccountInfo({ email: data.email, fullName: data.fullName });
        } else {
          setTokenValid(false);
          setTokenError(data.error || 'This password reset link is invalid or has expired.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTokenValid(false);
          setTokenError('Could not verify your reset link. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to reset password.');
        return;
      }
      setCompleted(true);
    } catch {
      setSubmitError('Could not connect to the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Syllabus Repository & Versioning System"
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {verifying ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-sm text-slate-600">
          <Spinner className="h-5 w-5 text-brand-700" />
          <p>Verifying your password reset link...</p>
        </div>
      ) : completed ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Password updated</h2>
            <p className="text-sm text-slate-600">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary w-full">
            Sign in
          </Link>
        </div>
      ) : !tokenValid ? (
        <div className="space-y-4">
          <Alert tone="error">{tokenError}</Alert>
          <Link href="/login" className="btn btn-primary w-full">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {accountInfo && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              Resetting password for{' '}
              <span className="font-semibold text-slate-900">{accountInfo.fullName}</span>{' '}
              <span className="block truncate text-slate-500">{accountInfo.email}</span>
            </div>
          )}

          {submitError && <Alert tone="error">{submitError}</Alert>}

          <Field label="New password" required hint="At least 6 characters">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm new password" required>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              className="input"
            />
          </Field>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? <Spinner /> : 'Update password'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Set a new password" subtitle="Syllabus Repository & Versioning System">
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-sm text-slate-600">
            <Spinner className="h-5 w-5 text-brand-700" />
            <p>Loading...</p>
          </div>
        </AuthCard>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
