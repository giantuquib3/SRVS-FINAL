'use client';


//testing testing testing


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Shield,
  Layers,
  GraduationCap,
  Users,
  GitBranch,
  History,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
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
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">Connecting to USJ-R SRVS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 py-6">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-[#C99700]/40 bg-[#FEF9C3] text-[#854D0E] text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-[#C99700]" />
          <span>University of San Jose - Recoletos • Cebu City</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900">
          Syllabus Repository,{' '}
          <span className="text-[#005A36]">
            Revision & Versioning
          </span>{' '}
          System
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Standardized syllabus drafting, sequential immutable revisions, curriculum compliance review, and automated student syllabus mapping powered by USJ-R academic standards.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center space-x-2 shadow-sm transition-all hover:scale-105"
          >
            <span>Enter Portal</span>
            <ArrowRight className="w-4 h-4 text-[#FEF08A]" />
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 rounded-xl font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-sm"
          >
            Register Account
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-[#005A36] transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#005A36]">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">System Admin</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Institutional governance: User approvals, role assignment, pending reviews queue, and unfiltered audit trails.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-[#005A36] transition-all">
          <div className="w-12 h-12 rounded-xl bg-[#FEF9C3] border border-[#FEF08A] flex items-center justify-center text-[#854D0E]">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Department Head</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Curriculum quality control: Monitor departmental course coverage, identify missing syllabi, and inspect version diffs.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-[#005A36] transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#005A36]">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Faculty Members</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Standardized creation: Structured forms, dynamic learning outcomes, mandatory change logs, and sequential versions.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-[#005A36] transition-all">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Josenian Students</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Direct syllabus access: Officially enrolled subjects automatically mapped to approved syllabus documents.
          </p>
        </div>
      </section>
    </div>
  );
}
