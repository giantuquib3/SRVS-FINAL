'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  BookOpen,
  User,
  LogOut,
  Shield,
  Layers,
  GraduationCap,
  FileText,
  Bell,
  CheckCircle,
  PlusCircle,
  Clock,
  Menu,
  X,
  FileCode
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  fullName: string;
  role: string;
  departmentName?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserData | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          fetch('/api/notifications')
            .then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 }))
            .then((notifData) => {
              setNotifications(notifData.notifications || []);
              setUnreadCount(notifData.unreadCount || 0);
            })
            .catch(() => {});
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setUnreadCount(0);
  };

  const isAuthPage = pathname === '/login' || pathname === '/register';

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return <span className="bg-[#FEF08A] text-[#854D0E] font-bold text-[11px] px-2.5 py-0.5 rounded-full">Admin</span>;
      case 'DepartmentHead':
        return <span className="bg-[#FEF9C3] text-[#A16207] font-bold text-[11px] px-2.5 py-0.5 rounded-full">Dept Head</span>;
      case 'Educator':
        return <span className="bg-[#DCFCE7] text-[#166534] font-bold text-[11px] px-2.5 py-0.5 rounded-full">Faculty</span>;
      default:
        return <span className="bg-[#E0F2FE] text-[#0369A1] font-bold text-[11px] px-2.5 py-0.5 rounded-full">Student</span>;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#005A36] text-white shadow-md border-b-2 border-[#C99700]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* USJ-R Brand Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-[#C99700] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform text-white font-extrabold">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xl font-black tracking-tight text-white">USJ-R</span>
                  <span className="text-sm font-semibold tracking-wide text-[#FEF08A] uppercase">SRVS</span>
                </div>
                <span className="block text-[10px] tracking-wider text-emerald-100/90 font-medium">
                  University of San Jose - Recoletos
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links based on role */}
          {user && !isAuthPage && (
            <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
              {user.role === 'Admin' && (
                <>
                  <Link
                    href="/admin/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/admin/dashboard'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/courses"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/courses'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Courses
                  </Link>
                  <Link
                    href="/enrollments"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/enrollments'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Enrollments
                  </Link>
                  <Link
                    href="/admin/users"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/admin/users'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Users
                  </Link>
                  <Link
                    href="/admin/audit-logs"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/admin/audit-logs'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Audit Logs
                  </Link>
                </>
              )}

              {user.role === 'DepartmentHead' && (
                <>
                  <Link
                    href="/dept/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/dept/dashboard'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Dept Dashboard
                  </Link>
                  <Link
                    href="/courses"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/courses'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Courses
                  </Link>
                  <Link
                    href="/enrollments"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/enrollments'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Enrollments
                  </Link>
                </>
              )}

              {user.role === 'Educator' && (
                <>
                  <Link
                    href="/educator/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/educator/dashboard'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Faculty Dashboard
                  </Link>
                  <Link
                    href="/syllabi/new"
                    className="px-3 py-1.5 rounded-lg bg-[#C99700] hover:bg-[#B48600] text-slate-950 font-bold flex items-center space-x-1.5 transition-all shadow"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create Syllabus</span>
                  </Link>
                </>
              )}

              {user.role === 'Student' && (
                <>
                  <Link
                    href="/student/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/student/dashboard'
                        ? 'bg-white/20 text-[#FEF08A] font-bold'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    My Enrolled Syllabi
                  </Link>
                </>
              )}
            </nav>
          )}

          {/* Right Action Menu */}
          <div className="flex items-center space-x-2.5">
            <Link
              href="/docs"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-100 hover:text-white hover:bg-white/10 flex items-center space-x-1.5 transition-colors border border-white/15"
              title="Interactive Swagger API Documentation"
            >
              <FileCode className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span className="hidden md:inline font-bold">API Docs</span>
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                {/* Notification Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FEF08A] border-2 border-[#005A36] animate-pulse" />
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 p-4 shadow-xl z-50 text-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <span className="font-bold text-sm text-[#005A36]">Notifications</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-xs text-[#005A36] hover:underline font-semibold"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-500 py-3 text-center">No notifications</p>
                        ) : (
                          notifications.slice(0, 5).map((n) => (
                            <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-100 text-xs space-y-1">
                              <p className="font-semibold text-slate-800">{n.title}</p>
                              <p className="text-slate-600">{n.message}</p>
                              <span className="text-[10px] text-slate-400">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Profile Pill */}
                <div className="flex items-center space-x-3 pl-3 border-l border-white/20">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-white">{user.fullName}</p>
                    <div className="mt-0.5">{getRoleBadge(user.role)}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white hover:bg-white/15 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 transition-all shadow"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
