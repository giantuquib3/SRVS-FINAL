'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Lock,
  CreditCard,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!/^\d{5}$/.test(cleanUsername) && !/^\d{10}$/.test(cleanUsername)) {
      setError('Please enter a valid Username (ID number): 10 digits for Students (e.g. 2022012708) or 5 digits for Faculty/Staff/Admin (e.g. 00000).');
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
        setError(data.error || 'Authentication failed. Please check credentials.');
        setLoading(false);
        return;
      }

      // Redirect by role
      switch (data.user.role) {
        case 'Admin':
          router.push('/admin/dashboard');
          break;
        case 'DepartmentHead':
          router.push('/dept/dashboard');
          break;
        case 'Educator':
          router.push('/educator/dashboard');
          break;
        default:
          router.push('/student/dashboard');
          break;
      }
      router.refresh();
    } catch (err: any) {
      setError('Connection error. Could not connect to PostgreSQL backend.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-6">
      <div className="w-full max-w-md space-y-6">
        {/* USJ-R Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#005A36] border-2 border-[#C99700] flex items-center justify-center mx-auto shadow-md">
            <BookOpen className="w-7 h-7 text-[#FEF08A]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#005A36]">Sign in to USJ-R SRVS</h1>
          <p className="text-xs text-slate-500 font-medium">
            University of San Jose - Recoletos • Syllabus Repository & Versioning
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Simple Clean White Login Form */}
        <form onSubmit={handleLogin} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Username (ID Number)
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                Student: 10 digits • Faculty/Admin: 5 digits
              </span>
            </div>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter Username / ID number (e.g. 00000 or 2022012708)"
                required
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] disabled:bg-emerald-800 text-white flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 text-[#FEF08A]" />
              </>
            )}
          </button>

          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            <span>New user or faculty member? </span>
            <Link href="/register" className="text-[#005A36] hover:text-[#004529] font-bold underline underline-offset-4">
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
