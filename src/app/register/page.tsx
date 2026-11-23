'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import AuthCard from '@/components/AuthCard';
import { Alert, Field, Spinner } from '@/components/ui';
import { DEPARTMENTS } from '@/lib/departments';

export default function RegisterPage() {
  const [departments, setDepartments] = useState<any[]>(DEPARTMENTS);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    idNumber: '',
    password: '',
    departmentId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.departments?.length) setDepartments(data.departments);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanId = form.idNumber.trim();
    if (!/^\d{5}$/.test(cleanId)) {
      setError('Faculty ID number must be exactly 5 digits (e.g., 10018).');
      return;
    }
    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      setError('Please use your institutional email ending in @usjr.edu.ph.');
      return;
    }
    if (!form.departmentId) {
      setError('Please select your department.');
      return;
    }

    setLoading(true);
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const res = await fetch('/api/auth/register/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          email: cleanEmail,
          idNumber: cleanId,
          password: form.password,
          departmentId: form.departmentId,
          role: 'Faculty',
          academicRank: 'Faculty',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }
      setIsSuccess(true);
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthCard title="Registration submitted">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm text-slate-600">
            Your account is awaiting approval from your Department Head. You&apos;ll be able to sign in once it&apos;s
            approved.
          </p>
          <Link href="/login" className="btn btn-primary w-full">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      wide
      title="Create a faculty account"
      subtitle="Your Department Head will review your registration."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input type="text" required value={form.firstName} onChange={update('firstName')} className="input" />
          </Field>
          <Field label="Last name" required>
            <input type="text" required value={form.lastName} onChange={update('lastName')} className="input" />
          </Field>
        </div>

        <Field label="Department" required>
          <select required value={form.departmentId} onChange={update('departmentId')} className="input">
            <option value="">Select your department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
          <Field label="Faculty ID" required hint="5 digits">
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={5}
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value.replace(/\D/g, '') })}
              placeholder="10018"
              className="input font-mono"
            />
          </Field>
          <Field label="Institutional email" required>
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update('email')}
              placeholder="name@usjr.edu.ph"
              className="input"
            />
          </Field>
        </div>

        <Field label="Password" required hint="At least 6 characters">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={update('password')}
            className="input"
          />
        </Field>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? <Spinner /> : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
