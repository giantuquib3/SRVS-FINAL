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
  SUBMITTED: 'Pending Dept. Head Approval',
  UNDER_REVIEW: 'Pending Dean Approval',
  APPROVED: 'Approved (Effective)',
  REJECTED: 'Rejected — Revision Required',
  ARCHIVED: 'Archived',
};

export function getApprovalRouteLabel(
  approvalStatus?: string | null,
  editorRole?: string | null
): string {
  if (approvalStatus === SYLLABUS_STATUS.SUBMITTED) {
    return 'Faculty → Department Head Review';
  }
  if (approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW) {
    return 'Department Head → Dean Review';
  }
  if (approvalStatus === SYLLABUS_STATUS.APPROVED) {
    return editorRole === 'DepartmentHead'
      ? 'Approved by Dean (Effective)'
      : 'Approved (Effective Syllabus)';
  }
  if (approvalStatus === SYLLABUS_STATUS.REJECTED) {
    return editorRole === 'DepartmentHead'
      ? 'Returned by Dean for Revision'
      : 'Returned by Dept. Head for Revision';
  }
  if (approvalStatus === SYLLABUS_STATUS.DRAFT) {
    return 'Draft (Not Yet Submitted)';
  }
  return approvalStatus || 'Draft';
}

export function isDeptHeadSubmission(version: {
  approvalStatus?: string | null;
  editor?: { role?: string | null } | null;
  submittedBy?: { role?: string | null } | null;
}): boolean {
  return (
    version.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW ||
    version.editor?.role === 'DepartmentHead' ||
    version.submittedBy?.role === 'DepartmentHead'
  );
}

/**
 * Approved official versions use sequential integers 1, 2, 3...
 * Pending / Draft / Rejected proposed revisions use proposal slots >= 1001
 * until approved, at which point they are promoted to the next official version number (maxApproved + 1).
 */
export const PROPOSAL_VERSION_OFFSET = 1000;

export function isProposalVersionNumber(versionNumber?: number | null): boolean {
  return typeof versionNumber === 'number' && versionNumber > PROPOSAL_VERSION_OFFSET;
}

export function formatVersionLabel(version?: {
  versionNumber?: number | null;
  approvalStatus?: string | null;
  content?: any;
} | null): string {
  if (!version || version.versionNumber == null) return 'Version 1';
  if (!isProposalVersionNumber(version.versionNumber)) {
    return `Version ${version.versionNumber}`;
  }
  const propNum = version.versionNumber - PROPOSAL_VERSION_OFFSET;
  const targetVer = version.content?._proposalMeta?.targetVersionNumber;
  if (version.approvalStatus === SYLLABUS_STATUS.DRAFT) {
    return `Draft Proposal #${propNum}`;
  }
  if (version.approvalStatus === SYLLABUS_STATUS.REJECTED) {
    return `Rejected Proposal #${propNum}`;
  }
  return targetVer ? `Proposed Revision #${propNum} (→ v${targetVer})` : `Proposed Revision #${propNum}`;
}

export function formatShortVersionLabel(version?: {
  versionNumber?: number | null;
  approvalStatus?: string | null;
  content?: any;
} | null): string {
  if (!version || version.versionNumber == null) return 'v1';
  if (!isProposalVersionNumber(version.versionNumber)) {
    return `v${version.versionNumber}`;
  }
  const propNum = version.versionNumber - PROPOSAL_VERSION_OFFSET;
  const targetVer = version.content?._proposalMeta?.targetVersionNumber;
  if (version.approvalStatus === SYLLABUS_STATUS.DRAFT) return `Draft #${propNum}`;
  if (version.approvalStatus === SYLLABUS_STATUS.REJECTED) return `Proposal #${propNum}`;
  return targetVer ? `Proposal #${propNum} → v${targetVer}` : `Proposal #${propNum}`;
}

export const ROLE_LABEL: Record<string, string> = {
  Admin: 'System Administrator',
  Registrar: 'School Registrar',
  VPAcademics: 'VP-Academics',
  Dean: 'Dean',
  DepartmentHead: 'Department Head',
  Educator: 'Faculty',
  Faculty: 'Faculty',
};

export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABEL[role]) || role || '';
}

export function isFacultyRole(role?: string | null): boolean {
  return role === 'Educator' || role === 'Faculty';
}

export function isGlobalViewerRole(role?: string | null): boolean {
  return role === 'Registrar' || role === 'VPAcademics';
}

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
  PENDING: 'PENDING',
  ENROLLED: 'ENROLLED',
  REJECTED: 'REJECTED',
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
