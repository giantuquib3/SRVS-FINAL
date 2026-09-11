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
  Clock,
  Menu,
  X,
  FileCode,
  LayoutDashboard,
  Users,
  History,
  PlusCircle,
  LogIn,
  UserPlus,
  ChevronRight
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  fullName: string;
  role: string;
  departmentCode?: string;
  departmentName?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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

  // Auto-close drawer and notifications when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowNotifications(false);
  }, [pathname]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Escape key closes drawer and notifications
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mobileMenuOpen) setMobileMenuOpen(false);
        if (showNotifications) setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, showNotifications]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setMobileMenuOpen(false);
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
        return <span className="bg-[#FEF08A] text-[#854D0E] font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs">Admin</span>;
      case 'DepartmentHead':
        return <span className="bg-[#FEF9C3] text-[#A16207] font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs">Dept Head</span>;
      case 'Educator':
        return <span className="bg-[#DCFCE7] text-[#166534] font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs">Faculty</span>;
      default:
        return <span className="bg-[#E0F2FE] text-[#0369A1] font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs">Student</span>;
    }
  };

  const getNavItems = (): NavItem[] => {
    if (!user) {
      return [
        { label: 'Sign In', href: '/login', icon: LogIn },
        { label: 'Register Account', href: '/register', icon: UserPlus },
        { label: 'Browse Courses', href: '/courses', icon: BookOpen },
      ];
    }

    switch (user.role) {
      case 'Admin':
        return [
          { label: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
          { label: 'Syllabus Approvals', href: '/department/syllabus-approvals', icon: CheckCircle },
          { label: 'Courses Management', href: '/courses', icon: BookOpen },
          { label: 'Student Enrollments', href: '/enrollments', icon: GraduationCap },
          { label: 'User Management', href: '/admin/users', icon: Users },
          { label: 'System Audit Logs', href: '/admin/audit-logs', icon: History },
        ];
      case 'DepartmentHead':
        return [
          { label: 'Dept Dashboard', href: '/dept/dashboard', icon: LayoutDashboard },
          { label: 'Syllabus Approvals', href: '/department/syllabus-approvals', icon: CheckCircle },
          { label: 'Courses Catalog', href: '/courses', icon: BookOpen },
          { label: 'Create / Upload Syllabus', href: '/syllabi/new', icon: PlusCircle },
          { label: 'Enrollments Tracking', href: '/enrollments', icon: GraduationCap },
        ];
      case 'Educator':
        return [
          { label: 'Faculty Dashboard', href: '/educator/dashboard', icon: LayoutDashboard },
          { label: 'Courses & Catalog', href: '/courses', icon: BookOpen },
          { label: 'Create / Upload Syllabus', href: '/syllabi/new', icon: PlusCircle },
        ];
      case 'Student':
        return [
          { label: 'My Enrolled Syllabi', href: '/student/dashboard', icon: GraduationCap },
          { label: 'Browse Courses', href: '/courses', icon: BookOpen },
        ];
      default:
        return [
          { label: 'Browse Courses', href: '/courses', icon: BookOpen },
        ];
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#005A36] text-white shadow-md border-b-2 border-[#C99700]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section: Hamburger Button + USJ-R Brand Logo */}
          <div className="flex items-center space-x-3">
            {/* Responsive Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#FEF08A] ${
                mobileMenuOpen
                  ? 'bg-white/25 text-[#FEF08A] ring-2 ring-[#FEF08A]/60'
                  : 'text-white hover:bg-white/15 hover:text-[#FEF08A]'
              }`}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              title={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 transition-transform duration-200 rotate-90 text-[#FEF08A]" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* USJ-R Brand Logo */}
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-[#C99700] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform text-white font-extrabold">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xl font-black tracking-tight text-white">USJ-R</span>
                  <span className="text-sm font-semibold tracking-wide text-[#FEF08A] uppercase">SRVS</span>
                </div>
                <span className="hidden sm:block text-[10px] tracking-wider text-emerald-100/90 font-medium">
                  University of San Jose - Recoletos
                </span>
              </div>
            </Link>
          </div>



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
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Notification Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-lg text-white hover:bg-white/15 transition-colors cursor-pointer"
                    aria-label="View notifications"
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
                    <div className="flex items-center justify-end space-x-1.5">
                      <p className="text-xs font-bold text-white leading-tight">{user.fullName}</p>
                      {user.departmentCode && (
                        <span className="px-1.5 py-0.2 rounded bg-[#FEF08A] text-[#005A36] text-[10px] font-extrabold tracking-wide font-mono shadow-xs">
                          {user.departmentCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-end space-x-1.5">
                      {getRoleBadge(user.role)}
                      {user.departmentName && (
                        <span
                          className="text-[10px] text-emerald-100/90 font-medium truncate max-w-[140px]"
                          title={user.departmentName}
                        >
                          • {user.departmentName}
                        </span>
                      )}
                    </div>
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
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white hover:bg-white/15 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 transition-all shadow"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Navigation Menu">
          {/* Backdrop with fade-in blur */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            aria-hidden="true"
          />

          {/* Slide-over Drawer Panel */}
          <div className="fixed inset-y-0 left-0 max-w-xs sm:max-w-sm w-full bg-white shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out border-r border-slate-200">
            {/* Drawer Header */}
            <div className="bg-[#005A36] text-white p-4 flex items-center justify-between border-b-2 border-[#C99700] shadow-sm">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#C99700] flex items-center justify-center shadow-md text-white font-black group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-lg font-black tracking-tight text-white">USJ-R</span>
                    <span className="text-xs font-bold tracking-wide text-[#FEF08A] uppercase">SRVS</span>
                  </div>
                  <span className="block text-[10px] text-emerald-100 font-medium">
                    Syllabus Repository System
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FEF08A] cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* User Profile Card (if logged in) */}
              {user ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200/80 shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#005A36] text-[#FEF08A] font-extrabold flex items-center justify-center text-sm shadow-sm">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <p className="text-sm font-bold text-slate-900 truncate">{user.fullName}</p>
                        {user.departmentCode && (
                          <span className="px-1.5 py-0.2 rounded bg-[#005A36] text-[#FEF08A] text-[9px] font-extrabold font-mono shrink-0">
                            {user.departmentCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-1.5">
                    <div>{getRoleBadge(user.role)}</div>
                    {(user.departmentCode || user.departmentName) && (
                      <span className="text-[11px] font-semibold text-emerald-900 bg-white/90 border border-emerald-300/70 px-2 py-0.5 rounded-lg shadow-2xs flex items-center gap-1 max-w-[170px]">
                        <span className="truncate" title={user.departmentName || user.departmentCode}>
                          {user.departmentName || `${user.departmentCode} Department`}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Welcome to USJ-R SRVS</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#005A36] bg-white border border-[#005A36]/30 hover:bg-emerald-50 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C99700] hover:bg-[#B48600] text-slate-950 transition-colors shadow-xs"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              )}

              {/* Primary Navigation Links */}
              <div>
                <div className="px-2 pb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {user ? `${user.role} Navigation` : 'Main Menu'}
                </div>
                <nav className="space-y-1">
                  {getNavItems().map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[#005A36] text-[#FEF08A] shadow-sm font-bold pl-4 border-l-4 border-[#C99700]'
                            : 'text-slate-700 hover:bg-emerald-50/70 hover:text-[#005A36]'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-[#FEF08A]' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-[#FEF08A]' : 'text-slate-400'}`} />
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* System & Documentation Links */}
              <div>
                <div className="px-2 pb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  System Resources
                </div>
                <nav className="space-y-1">
                  <Link
                    href="/docs"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      pathname === '/docs'
                        ? 'bg-[#005A36] text-[#FEF08A] shadow-sm font-bold pl-4 border-l-4 border-[#C99700]'
                        : 'text-slate-700 hover:bg-emerald-50/70 hover:text-[#005A36]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FileCode className={`w-4 h-4 ${pathname === '/docs' ? 'text-[#FEF08A]' : 'text-[#C99700]'}`} />
                      <span>Swagger API Docs</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      v1.0
                    </span>
                  </Link>

                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      pathname === '/'
                        ? 'bg-[#005A36] text-[#FEF08A] shadow-sm font-bold pl-4 border-l-4 border-[#C99700]'
                        : 'text-slate-700 hover:bg-emerald-50/70 hover:text-[#005A36]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <span>SRVS Home Portal</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </nav>
              </div>

              {/* Unread Notifications Alert (if any) */}
              {user && unreadCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center space-x-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>Notifications</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px]">
                      {unreadCount} unread
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(true);
                      setMobileMenuOpen(false);
                    }}
                    className="mt-2 text-xs font-semibold text-[#005A36] hover:underline cursor-pointer"
                  >
                    View pending notifications →
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              )}
              <div className="text-center text-[10px] text-slate-400">
                <p className="font-semibold text-slate-500">University of San Jose - Recoletos</p>
                <p>Caritas et Scientia • Cebu City</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
