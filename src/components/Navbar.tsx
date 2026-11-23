'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BookOpen, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { roleLabel } from '@/lib/status';
import { cx } from '@/components/ui';

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
}

const INSTITUTIONAL_ROLES = ['Admin', 'Registrar', 'VPAcademics', 'Dean'];

function navItemsFor(role: string): NavItem[] {
  switch (role) {
    case 'Admin':
      return [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Approvals', href: '/department/syllabus-approvals' },
        { label: 'Courses', href: '/subjects' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Audit Logs', href: '/admin/audit-logs' },
      ];
    case 'Registrar':
    case 'VPAcademics':
      return [
        { label: 'Syllabi', href: '/syllabi' },
        { label: 'Courses', href: '/subjects' },
      ];
    case 'Dean':
      return [
        { label: 'Dashboard', href: '/dept/dashboard' },
        { label: 'Approvals', href: '/department/syllabus-approvals' },
        { label: 'Courses', href: '/subjects' },
      ];
    case 'DepartmentHead':
      return [
        { label: 'Dashboard', href: '/dept/dashboard' },
        { label: 'Approvals', href: '/department/syllabus-approvals' },
        { label: 'Courses', href: '/subjects' },
        { label: 'Faculty', href: '/dept/users' },
      ];
    default:
      return [
        { label: 'Dashboard', href: '/educator/dashboard' },
        { label: 'Courses', href: '/subjects' },
      ];
  }
}

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

/** Closes a popover when clicking outside its container. */
function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'user' | 'mobile' | null>(null);

  const closeMenus = () => setOpenMenu(null);
  const notifRef = useClickOutside(openMenu === 'notifications', closeMenus);
  const userRef = useClickOutside(openMenu === 'user', closeMenus);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setUser(data?.user || null);
        setAuthChecked(true);
        if (data?.user) {
          fetch('/api/notifications')
            .then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 }))
            .then((n) => {
              if (cancelled) return;
              setNotifications(n.notifications || []);
              setUnreadCount(n.unreadCount || 0);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setAuthChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Close menus on navigation
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  // Escape closes any open menu; lock scroll while the mobile drawer is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenu(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = openMenu === 'mobile' ? 'hidden' : '';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openMenu]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setOpenMenu(null);
    router.push('/login');
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setUnreadCount(0);
  };

  const navItems = user ? navItemsFor(user.role) : [];
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const showDept = user && !INSTITUTIONAL_ROLES.includes(user.role) && (user.departmentName || user.departmentCode);
  const homeHref = navItems[0]?.href || '/';

  return (
    <header className="sticky top-0 z-50 border-b-2 border-accent-500 bg-brand-700 text-white print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        {user && (
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'mobile' ? null : 'mobile')}
            className="-ml-1.5 rounded-lg p-1.5 text-white/90 hover:bg-white/10 lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={openMenu === 'mobile'}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Brand */}
        <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500">
            <BookOpen className="h-4 w-4 text-white" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-base font-bold tracking-tight">USJ-R</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-200">SRVS</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        {user && (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive(item.href) ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <>
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
                  className="relative rounded-lg p-2 text-white/90 hover:bg-white/10"
                  aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-400 px-1 text-[10px] font-bold text-slate-950">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {openMenu === 'notifications' && (
                  <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && (
                        <button type="button" onClick={markAllRead} className="text-xs font-medium text-brand-700 hover:underline">
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
                      ) : (
                        notifications.slice(0, 8).map((n) => {
                          const body = (
                            <>
                              <p className="text-sm font-medium text-slate-900">{n.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.message}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                            </>
                          );
                          const cls = 'block border-b border-slate-100 px-4 py-3 last:border-0';
                          return n.link ? (
                            <Link key={n.id} href={n.link} className={cx(cls, 'hover:bg-slate-50')}>
                              {body}
                            </Link>
                          ) : (
                            <div key={n.id} className={cls}>
                              {body}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
                  className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-white/10"
                  aria-label="Account menu"
                  aria-expanded={openMenu === 'user'}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-accent-100">
                    {initials(user.fullName)}
                  </span>
                  <span className="hidden max-w-[160px] text-left sm:block">
                    <span className="block truncate text-sm font-medium leading-tight capitalize">{user.fullName}</span>
                    <span className="block truncate text-[11px] leading-tight text-white/65">{roleLabel(user.role)}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-white/60 sm:block" />
                </button>

                {openMenu === 'user' && (
                  <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold capitalize">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      <p className="mt-1.5 text-xs text-slate-600">
                        {roleLabel(user.role)}
                        {showDept && <span className="text-slate-400"> · {user.departmentName || user.departmentCode}</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut className="h-4 w-4 text-slate-400" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : authChecked ? (
            <>
              <Link
                href="/login"
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10',
                  pathname === '/login' ? 'text-white' : 'text-white/80'
                )}
              >
                Sign in
              </Link>
              <Link href="/register" className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-accent-400">
                Register
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile drawer */}
      {user && openMenu === 'mobile' && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeMenus} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white text-slate-800 shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="flex items-baseline gap-1.5 text-brand-700">
                <span className="text-base font-bold">USJ-R</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent-600">SRVS</span>
              </span>
              <button type="button" onClick={closeMenus} className="btn btn-ghost btn-icon" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold capitalize">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">
                {roleLabel(user.role)}
                {showDept && ` · ${user.departmentName || user.departmentCode}`}
              </p>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'block rounded-lg px-3 py-2 text-sm font-medium',
                    isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-200 p-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
