import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type EditPermissionStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface SyllabusEditRequestDTO {
  id: number;
  syllabusId: number;
  facultyId: number;
  departmentId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewedById: number | null;
  reviewRemarks: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
  faculty: {
    id: number;
    fullName: string;
    email: string;
    departmentId: string | null;
  };
  reviewedBy: {
    id: number;
    fullName: string;
    role: string;
  } | null;
  syllabus: {
    id: number;
    subjectId: number;
    currentVersionNumber: number;
    semester: string;
    academicYear: string;
    departmentId: string;
    departmentName: string;
    subject: {
      id: number;
      code: string;
      title: string;
      units: number;
    };
  };
}

interface RawEditRequestRow {
  id: number;
  syllabusId: number;
  facultyId: number;
  departmentId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewedById: number | null;
  reviewRemarks: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  updatedAt: Date;
  facultyFullName: string;
  facultyEmail: string;
  facultyDepartmentId: string | null;
  reviewerFullName: string | null;
  reviewerRole: string | null;
  syllabusSubjectId: number;
  syllabusCurrentVersion: number;
  syllabusSemester: string;
  syllabusAcademicYear: string;
  departmentName: string | null;
  subjectCode: string;
  subjectTitle: string;
  subjectUnits: number;
}

function mapRow(r: RawEditRequestRow): SyllabusEditRequestDTO {
  return {
    id: Number(r.id),
    syllabusId: Number(r.syllabusId),
    facultyId: Number(r.facultyId),
    departmentId: String(r.departmentId),
    reason: String(r.reason),
    status: r.status,
    reviewedById: r.reviewedById !== null && r.reviewedById !== undefined ? Number(r.reviewedById) : null,
    reviewRemarks: r.reviewRemarks ?? null,
    requestedAt: r.requestedAt instanceof Date ? r.requestedAt.toISOString() : String(r.requestedAt),
    reviewedAt: r.reviewedAt
      ? r.reviewedAt instanceof Date
        ? r.reviewedAt.toISOString()
        : String(r.reviewedAt)
      : null,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    faculty: {
      id: Number(r.facultyId),
      fullName: r.facultyFullName,
      email: r.facultyEmail,
      departmentId: r.facultyDepartmentId,
    },
    reviewedBy:
      r.reviewedById && r.reviewerFullName
        ? {
            id: Number(r.reviewedById),
            fullName: r.reviewerFullName,
            role: r.reviewerRole || 'DepartmentHead',
          }
        : null,
    syllabus: {
      id: Number(r.syllabusId),
      subjectId: Number(r.syllabusSubjectId),
      currentVersionNumber: Number(r.syllabusCurrentVersion),
      semester: r.syllabusSemester,
      academicYear: r.syllabusAcademicYear,
      departmentId: String(r.departmentId),
      departmentName: r.departmentName || String(r.departmentId),
      subject: {
        id: Number(r.syllabusSubjectId),
        code: r.subjectCode,
        title: r.subjectTitle,
        units: Number(r.subjectUnits ?? 3),
      },
    },
  };
}

const SELECT_JOINED = Prisma.sql`
  SELECT
    r.id,
    r."syllabusId",
    r."facultyId",
    r."departmentId",
    r.reason,
    r.status,
    r."reviewedById",
    r."reviewRemarks",
    r."requestedAt",
    r."reviewedAt",
    r."updatedAt",
    f."fullName" AS "facultyFullName",
    f.email AS "facultyEmail",
    f."departmentId" AS "facultyDepartmentId",
    rev."fullName" AS "reviewerFullName",
    rev.role AS "reviewerRole",
    s."subjectId" AS "syllabusSubjectId",
    s."currentVersionNumber" AS "syllabusCurrentVersion",
    s.semester AS "syllabusSemester",
    s."academicYear" AS "syllabusAcademicYear",
    d.name AS "departmentName",
    subj.code AS "subjectCode",
    subj.title AS "subjectTitle",
    subj.units AS "subjectUnits"
  FROM syllabus_edit_requests r
  JOIN users f ON f.id = r."facultyId"
  LEFT JOIN users rev ON rev.id = r."reviewedById"
  JOIN syllabi s ON s.id = r."syllabusId"
  JOIN subjects subj ON subj.id = s."subjectId"
  LEFT JOIN departments d ON d.id = r."departmentId"
`;

/**
 * Returns the latest edit permission request (and whether edit permission is currently active)
 * for a given Faculty member on a specific syllabus.
 */
export async function getFacultyEditPermissionForSyllabus(
  syllabusId: number,
  facultyId: number
): Promise<{
  hasPermission: boolean;
  status: EditPermissionStatus;
  request: SyllabusEditRequestDTO | null;
}> {
  if (!syllabusId || !facultyId) {
    return { hasPermission: false, status: 'NONE', request: null };
  }

  const rows = await prisma.$queryRaw<RawEditRequestRow[]>`
    ${SELECT_JOINED}
    WHERE r."syllabusId" = ${syllabusId}
      AND r."facultyId" = ${facultyId}
    ORDER BY
      CASE r.status
        WHEN 'APPROVED' THEN 0
        WHEN 'PENDING' THEN 1
        WHEN 'REJECTED' THEN 2
        ELSE 3
      END,
      r."requestedAt" DESC,
      r.id DESC
    LIMIT 1
  `;

  if (!rows.length) {
    return { hasPermission: false, status: 'NONE', request: null };
  }
  const latest = mapRow(rows[0]);
  return {
    hasPermission: latest.status === 'APPROVED',
    status: latest.status,
    request: latest,
  };
}

/**
 * Batch lookup of the current edit permission state per syllabusId for a Faculty member.
 */
export async function getFacultyEditPermissionsMap(
  facultyId: number,
  syllabusIds?: number[]
): Promise<Map<number, SyllabusEditRequestDTO>> {
  const result = new Map<number, SyllabusEditRequestDTO>();
  if (!facultyId) return result;
  if (syllabusIds && syllabusIds.length === 0) return result;

  const rows =
    syllabusIds && syllabusIds.length > 0
      ? await prisma.$queryRaw<RawEditRequestRow[]>`
          ${SELECT_JOINED}
          WHERE r."facultyId" = ${facultyId}
            AND r."syllabusId" IN (${Prisma.join(syllabusIds)})
          ORDER BY
            r."syllabusId" ASC,
            CASE r.status
              WHEN 'APPROVED' THEN 0
              WHEN 'PENDING' THEN 1
              WHEN 'REJECTED' THEN 2
              ELSE 3
            END,
            r."requestedAt" DESC,
            r.id DESC
        `
      : await prisma.$queryRaw<RawEditRequestRow[]>`
          ${SELECT_JOINED}
          WHERE r."facultyId" = ${facultyId}
          ORDER BY
            r."syllabusId" ASC,
            CASE r.status
              WHEN 'APPROVED' THEN 0
              WHEN 'PENDING' THEN 1
              WHEN 'REJECTED' THEN 2
              ELSE 3
            END,
            r."requestedAt" DESC,
            r.id DESC
        `;

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!result.has(mapped.syllabusId)) {
      result.set(mapped.syllabusId, mapped);
    }
  }
  return result;
}

export async function listEditRequests(filters: {
  departmentId?: string | null;
  facultyId?: number | null;
  syllabusId?: number | null;
  status?: string | null;
}): Promise<SyllabusEditRequestDTO[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`];

  if (filters.departmentId) {
    conditions.push(Prisma.sql`UPPER(r."departmentId") = UPPER(${filters.departmentId})`);
  }
  if (filters.facultyId) {
    conditions.push(Prisma.sql`r."facultyId" = ${filters.facultyId}`);
  }
  if (filters.syllabusId) {
    conditions.push(Prisma.sql`r."syllabusId" = ${filters.syllabusId}`);
  }
  if (filters.status && filters.status.toUpperCase() !== 'ALL') {
    conditions.push(Prisma.sql`r.status = ${filters.status.toUpperCase()}`);
  }

  const whereClause = Prisma.join(conditions, ' AND ');
  const rows = await prisma.$queryRaw<RawEditRequestRow[]>`
    ${SELECT_JOINED}
    WHERE ${whereClause}
    ORDER BY
      CASE r.status
        WHEN 'PENDING' THEN 0
        WHEN 'APPROVED' THEN 1
        WHEN 'REJECTED' THEN 2
        ELSE 3
      END,
      r."requestedAt" DESC,
      r.id DESC
  `;

  return rows.map(mapRow);
}

export async function getEditRequestById(id: number): Promise<SyllabusEditRequestDTO | null> {
  if (!id || isNaN(id)) return null;
  const rows = await prisma.$queryRaw<RawEditRequestRow[]>`
    ${SELECT_JOINED}
    WHERE r.id = ${id}
    LIMIT 1
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function createEditPermissionRequest(input: {
  syllabusId: number;
  facultyId: number;
  departmentId: string;
  reason: string;
}): Promise<SyllabusEditRequestDTO> {
  const inserted = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO syllabus_edit_requests ("syllabusId", "facultyId", "departmentId", reason, status, "requestedAt", "updatedAt")
    VALUES (${input.syllabusId}, ${input.facultyId}, ${input.departmentId}, ${input.reason}, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `;
  const created = await getEditRequestById(Number(inserted[0].id));
  if (!created) {
    throw new Error('Failed to retrieve newly created edit permission request.');
  }
  return created;
}

export async function updateEditPermissionRequestStatus(input: {
  requestId: number;
  status: 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewedById: number;
  reviewRemarks: string | null;
}): Promise<SyllabusEditRequestDTO | null> {
  await prisma.$executeRaw`
    UPDATE syllabus_edit_requests
    SET
      status = ${input.status},
      "reviewedById" = ${input.reviewedById},
      "reviewRemarks" = ${input.reviewRemarks},
      "reviewedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${input.requestId}
  `;
  return getEditRequestById(input.requestId);
}

/**
 * Marks a Faculty member's active APPROVED edit permission as COMPLETED once their
 * proposed syllabus revision has been approved into the next official Version.
 */
export async function completeFacultyEditPermission(
  syllabusId: number,
  facultyId: number
): Promise<void> {
  if (!syllabusId || !facultyId) return;
  await prisma.$executeRaw`
    UPDATE syllabus_edit_requests
    SET
      status = 'COMPLETED',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "syllabusId" = ${syllabusId}
      AND "facultyId" = ${facultyId}
      AND status = 'APPROVED'
  `;
}

export async function countPendingEditRequestsForDepartment(departmentId?: string | null): Promise<number> {
  const rows = departmentId
    ? await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM syllabus_edit_requests
        WHERE UPPER("departmentId") = UPPER(${departmentId})
          AND status = 'PENDING'
      `
    : await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM syllabus_edit_requests
        WHERE status = 'PENDING'
      `;
  return Number(rows[0]?.count ?? 0);
}

