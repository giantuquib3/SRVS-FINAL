'use client';

/**
 * Shared UI primitives. Visual styles live in globals.css (`.card`, `.btn-*`, `.badge-*`,
 * `.input`, `.data-table`); these components add structure and behaviour on top.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { syllabusStatusLabel } from '@/lib/status';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backHref,
  onBack,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  onBack?: () => void;
}) {
  const backClass =
    'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors';
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? (
          <Link href={backHref} className={backClass} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} className={backClass} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card', className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

/** Numbers stay neutral; color is reserved for "needs attention" (amber) and "problem" (red). */
const STAT_TONES = {
  default: 'text-slate-900',
  amber: 'text-amber-700',
  red: 'text-rose-700',
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-500">{label}</span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
      </div>
      <p className={cx('mt-1.5 text-2xl font-semibold tabular-nums', STAT_TONES[tone])}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
    </>
  );
  const base = 'card p-4 text-left';
  if (!onClick) return <div className={base}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        base,
        'cursor-pointer transition-colors hover:border-slate-300',
        active && 'border-brand-700 bg-brand-50/40 hover:border-brand-700'
      )}
    >
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeTone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'brand';

export function Badge({ tone = 'gray', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function syllabusStatusTone(status?: string | null): BadgeTone {
  switch (status) {
    case 'APPROVED':
      return 'green';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'amber';
    case 'REJECTED':
      return 'red';
    default:
      return 'gray';
  }
}

export function StatusBadge({ status, label }: { status?: string | null; label?: ReactNode }) {
  return <Badge tone={syllabusStatusTone(status)}>{label ?? syllabusStatusLabel(status || 'DRAFT')}</Badge>;
}

export function accountStatusTone(status?: string | null): BadgeTone {
  if (status === 'Active') return 'green';
  if (status === 'PendingApproval') return 'amber';
  return 'red';
}

export function accountStatusLabel(status?: string | null) {
  return status === 'PendingApproval' ? 'Pending' : status || '';
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} />;
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 py-16 text-slate-500', className)}>
      <Spinner className="h-6 w-6 text-brand-700" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ALERT_STYLES = {
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: CheckCircle2, iconColor: 'text-emerald-600' },
  error: { box: 'bg-rose-50 border-rose-200 text-rose-900', icon: AlertCircle, iconColor: 'text-rose-600' },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertCircle, iconColor: 'text-amber-600' },
  info: { box: 'bg-sky-50 border-sky-200 text-sky-900', icon: Info, iconColor: 'text-sky-600' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onClose,
  className,
}: {
  tone?: keyof typeof ALERT_STYLES;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  const s = ALERT_STYLES[tone];
  const Icon = s.icon;
  return (
    <div className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', s.box, className)} role="status">
      <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', s.iconColor)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export type ToastMessage = { text: string; type: 'success' | 'error' };

export function useToast(duration = 4500) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'success') => {
      setToast({ text, type });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = toast ? (
    <div className="fixed bottom-5 right-5 z-[80] max-w-sm" role="status">
      <div
        className={cx(
          'flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-white shadow-lg',
          toast.type === 'success' ? 'bg-slate-900' : 'bg-rose-700'
        )}
      >
        {toast.type === 'success' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
        )}
        <span className="flex-1">{toast.text}</span>
        <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : null;

  return { toast: node, showToast };
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

const MODAL_SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className={cx('relative flex max-h-[90vh] w-full flex-col rounded-xl bg-white shadow-2xl', MODAL_SIZES[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs (segmented, underline style)                                   */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: NoInfer<T>; label: string; count?: number; highlight?: boolean }>;
  active: T;
  onChange: (id: NoInfer<T>) => void;
}) {
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cx(
              'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors',
              isActive ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                  t.highlight && t.count > 0
                    ? 'bg-amber-100 text-amber-800'
                    : isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-600'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-style filter group, e.g. All / Pending / Approved. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: NoInfer<T>; label: string }>;
  value: T;
  onChange: (id: NoInfer<T>) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search input                                                        */
/* ------------------------------------------------------------------ */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  onSubmit,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}) {
  const input = (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
  if (!onSubmit) return input;
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {input}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Form field                                                          */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="label">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/** Small "[CODE]" department chip used across tables. */
export function DeptTag({ code }: { code?: string | null }) {
  if (!code) return null;
  return <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{code}</span>;
}

export function formatDate(value?: string | Date | null, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
