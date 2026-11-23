'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthCard from '@/components/AuthCard';
import { Alert, Field, Modal, Spinner } from '@/components/ui';
import { homePathForRole } from '@/lib/status';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password: sends a reset request to the System Administrator
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please enter your ID number or institutional email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed. Please check your credentials.');
        setLoading(false);
        return;
      }
      router.push(homePathForRole(data.user.role));
      router.refresh();
    } catch {
      setError('Could not connect to the server. Please try again.');
      setLoading(false);
    }
  };

  const openForgot = () => {
    setForgotOpen(true);
    setResetError('');
    setResetSuccess('');
    if (username.includes('@')) setResetEmail(username.trim());
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError('Please enter your registered institutional email.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Failed to send password reset request.');
        return;
      }
      setResetSuccess(data.message || 'Request sent. The System Administrator will reset your password.');
      setResetEmail('');
    } catch {
      setResetError('Could not connect to the server. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthCard
      title="Sign in to SRVS"
      subtitle="Syllabus Repository & Versioning System"
      footer={
        <>
          New faculty member?{' '}
          <Link href="/register" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="ID number or email">
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="10001 or name@usjr.edu.ph"
            required
            className="input"
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-slate-700">
              Password
            </label>
            <button type="button" onClick={openForgot} className="text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? <Spinner /> : 'Sign in'}
        </button>
      </form>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset your password"
        description="We'll notify the System Administrator to reset your password."
        footer={
          <>
            <button type="button" onClick={() => setForgotOpen(false)} className="btn btn-ghost">
              Close
            </button>
            <button type="submit" form="forgot-form" disabled={resetLoading} className="btn btn-primary">
              {resetLoading ? <Spinner /> : 'Send request'}
            </button>
          </>
        }
      >
        <form id="forgot-form" onSubmit={handleResetPassword} className="space-y-4">
          {resetError && <Alert tone="error">{resetError}</Alert>}
          {resetSuccess && <Alert tone="success">{resetSuccess}</Alert>}
          <Field label="Registered institutional email" required>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="name@usjr.edu.ph"
              required
              className="input"
            />
          </Field>
        </form>
      </Modal>
    </AuthCard>
  );
}
