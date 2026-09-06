'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  User,
  Mail,
  Lock,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  CreditCard
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    idNumber: '',
    password: '',
    role: 'Student',
    departmentId: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => res.json())
      .then((data) => {
        if (data.departments) {
          setDepartments(data.departments);
        }
      })
      .catch(() => setError('Failed to load departments from database.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanId = formData.idNumber.trim();
    if (formData.role === 'Student') {
      if (!/^\d{10}$/.test(cleanId)) {
        setError('Student ID number must be exactly 10 digits (e.g., 2022012708).');
        return;
      }
    } else {
      if (!/^\d{5}$/.test(cleanId)) {
        setError('Faculty ID number must be exactly 5 digits (e.g., 10001 or 00000).');
        return;
      }
    }

    if (!formData.departmentId) {
      setError('Please select your academic department.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          idNumber: cleanId,
          username: cleanId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message || 'Registration submitted successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError('Connection error. Could not reach server.');
      setLoading(false);
    }
  };

  const isStudent = formData.role === 'Student';

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6">
      <div className="w-full max-w-lg space-y-6">
        {/* USJ-R Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#005A36] border-2 border-[#C99700] flex items-center justify-center mx-auto shadow-md">
            <BookOpen className="w-7 h-7 text-[#FEF08A]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#005A36]">Create an Account</h1>
          <p className="text-xs text-slate-500 font-medium">
            University of San Jose - Recoletos • Syllabus Repository & Versioning System
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {/* Role and Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Register As *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, idNumber: '' })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              >
                <option value="Student">Student (10-digit ID)</option>
                <option value="Educator">Educator / Faculty (5-digit ID)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Department *</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              >
                <option value="">-- Select Department --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    [{dept.code}] {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username (ID Number) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isStudent ? 'Username (Student ID - 10 digits) *' : 'Username (Faculty ID - 5 digits) *'}
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                {isStudent ? 'Username is your 10-digit ID' : 'Username is your 5-digit ID'}
              </span>
            </div>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={isStudent ? 10 : 5}
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value.replace(/\D/g, '') })}
                placeholder={isStudent ? 'e.g. 2022012708' : 'e.g. 10001'}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              />
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="First name"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Last name"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              />
            </div>
          </div>

          {/* Institutional Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Institutional Email *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@usjr.edu.ph"
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="At least 6 characters"
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] disabled:bg-emerald-800 text-white flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span>Submit Registration</span>
                <ArrowRight className="w-4 h-4 text-[#FEF08A]" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            Already registered?{' '}
            <Link href="/login" className="text-[#005A36] hover:text-[#004529] font-bold underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
