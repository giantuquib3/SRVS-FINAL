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
  CreditCard,
  Info,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { DEPARTMENTS } from '@/lib/departments';

export default function RegisterPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<any[]>(DEPARTMENTS);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    idNumber: '',
    password: '',
    departmentId: '',
    academicRank: 'Faculty',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        if (data?.departments && data.departments.length > 0) {
          setDepartments(data.departments);
        }
      })
      .catch((err) => {
        console.warn('Departments loaded from fallback:', err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanId = formData.idNumber.trim();
    if (!/^\d{5}$/.test(cleanId)) {
      setError('Faculty ID number must be exactly 5 digits (e.g., 10018).');
      return;
    }

    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      setError('Institutional email is required and must end with @usjr.edu.ph (e.g., yourname@usjr.edu.ph).');
      return;
    }

    if (!formData.departmentId) {
      setError('Please select your academic department.');
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        fullName,
        email: cleanEmail,
        idNumber: cleanId,
        password: formData.password,
        departmentId: formData.departmentId,
        role: 'Faculty',
        academicRank: 'Faculty',
      };

      const res = await fetch('/api/auth/register/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      setIsSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('Connection error. Could not reach server.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
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

        {isSuccess ? (
          /* Registration Successful Card */
          <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-md text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-inner text-emerald-700">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-[#005A36]">Registration Successful</h2>
              <p className="text-sm font-semibold text-slate-800">Your account has been created successfully.</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1.5 text-left">
              <p className="font-bold flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pending Department Head Approval</span>
              </p>
              <p className="text-slate-700">
                Your account is currently pending approval from your Department Head.
              </p>
              <p className="text-slate-700 font-medium">
                You will be able to log in after your account has been approved.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center justify-center space-x-2 shadow-sm transition-all"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="w-4 h-4 text-[#FEF08A]" />
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <>
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center space-x-2.5 text-xs text-[#005A36]">
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="font-bold">Faculty Account Self-Registration</span>
              </div>

              {/* Department Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Academic Department *</label>
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

              {/* Faculty ID Number */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="register-id-number" className="block text-xs font-bold text-slate-700">
                    Faculty ID Number *
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold font-mono">
                    5 digits (e.g. 10018)
                  </span>
                </div>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="register-id-number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    maxLength={5}
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 10018"
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
                    <span>Submit Faculty Registration</span>
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
          </>
        )}
      </div>
    </div>
  );
}
