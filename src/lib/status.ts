/**
 * Canonical status / enum values. The database enforces these with CHECK constraints
 * (see prisma/sql/db-integrity.sql), so always write one of these exact values.
 */

export const SYLLABUS_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type SyllabusStatus = (typeof SYLLABUS_STATUS)[keyof typeof SYLLABUS_STATUS];

/** Human-readable labels for syllabus / version statuses. */
export const SYLLABUS_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

export function syllabusStatusLabel(status?: string | null) {
  return (status && SYLLABUS_STATUS_LABEL[status]) || status || '';
}

/** True while a syllabus / version is waiting for a Department Head decision. */
export function isPendingReview(status?: string | null) {
  return status === SYLLABUS_STATUS.SUBMITTED || status === SYLLABUS_STATUS.UNDER_REVIEW;
}

/**
 * Maps a status query parameter (including legacy aliases such as ACTIVE, PENDING, PENDING_APPROVAL)
 * to a canonical syllabus status. Returns null for unknown values.
 */
export function parseSyllabusStatusParam(param?: string | null): SyllabusStatus | null {
  if (!param) return null;
  const s = param.trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'ACTIVE') return SYLLABUS_STATUS.APPROVED;
  if (s === 'PENDING' || s === 'PENDING_APPROVAL') return SYLLABUS_STATUS.SUBMITTED;
  return (Object.values(SYLLABUS_STATUS) as string[]).includes(s) ? (s as SyllabusStatus) : null;
}

/** Status of a student's enrollment in a subject (student_subjects.status, CHECK constraint). */
export const ENROLLMENT_STATUS = {
  ENROLLED: 'ENROLLED',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
} as const;
export const ENROLLMENT_STATUSES = Object.values(ENROLLMENT_STATUS) as string[];

export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'] as const;

/** Academic year format enforced by the database: "YYYY-YYYY". */
export const ACADEMIC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/** Defaults for a syllabus' academic term when the request does not specify one. */
export const DEFAULT_ACADEMIC_YEAR = '2026-2027';
export const DEFAULT_SEMESTER = '1st Semester';
export const DEFAULT_SECTION = 'A';
