import { prisma } from '@/lib/prisma';
import { getDepartmentName } from '@/lib/departments';

/**
 * Shared helpers for the ClassSection-based enrollment model.
 *
 *   Subject (catalog) 1 ──< ClassSection (subject + term + section + instructor) 1 ──< Enrollment >── 1 User (Student)
 */

export const DEFAULT_ACADEMIC_YEAR = '2026-2027';
export const DEFAULT_SEMESTER = '1st Semester';
export const DEFAULT_SECTION = 'A';

/** Prisma `include` that loads everything needed by {@link formatEnrollment}. */
export const enrollmentInclude = {
  student: {
    select: { id: true, fullName: true, email: true, departmentId: true, yearLevel: true, accountStatus: true },
  },
  classSection: {
    include: {
      instructor: { select: { id: true, fullName: true, email: true } },
      subject: true,
    },
  },
} as const;

export function formatClassSection(cs: any) {
  if (!cs) return null;
  return {
    id: cs.id,
    subjectId: cs.subjectId,
    academicYear: cs.academicYear,
    semester: cs.semester,
    section: cs.section,
    capacity: cs.capacity,
    instructorId: cs.instructorId ?? null,
    instructor: cs.instructor ? { id: cs.instructor.id, fullName: cs.instructor.fullName, email: cs.instructor.email } : null,
    enrolledCount: cs._count?.enrollments ?? undefined,
  };
}

function formatSubject(subject: any, cs: any, activeSyllabus?: any) {
  if (!subject) return null;
  const dept = String(subject.departmentId || '');
  return {
    id: subject.id,
    code: subject.code,
    title: subject.title,
    units: subject.units,
    departmentId: dept,
    // Prefer the instructor actually assigned to the class section; fall back to the subject coordinator label.
    professorName: cs?.instructor?.fullName || subject.professorName || null,
    department: { id: dept, code: dept, name: getDepartmentName(dept) },
    ...(activeSyllabus !== undefined ? { activeSyllabus } : {}),
  };
}

/**
 * Formats an enrollment (loaded with {@link enrollmentInclude}) into the API response shape.
 * Keeps the legacy flat fields (subjectId, semester, academicYear, section, studentName, course alias)
 * so existing UI pages keep working.
 */
export function formatEnrollment(e: any, opts: { activeSyllabus?: any } = {}) {
  const cs = e.classSection;
  const subjectData = formatSubject(cs?.subject, cs, opts.activeSyllabus);
  const student = e.student;
  const studentName = student?.fullName || `Student ${e.studentId}`;

  return {
    id: e.id,
    studentId: e.studentId,
    studentName,
    classSectionId: e.classSectionId,
    subjectId: cs?.subjectId,
    courseId: cs?.subjectId, // Alias
    semester: cs?.semester,
    academicYear: cs?.academicYear,
    section: cs?.section,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    student: {
      id: e.studentId,
      idNumber: e.studentId,
      fullName: studentName,
      email: student?.email,
      departmentId: student?.departmentId || null,
      departmentCode: student?.departmentId || null,
      departmentName: getDepartmentName(student?.departmentId),
      yearLevel: student?.yearLevel || '1st Year',
      accountStatus: student?.accountStatus || 'Active',
    },
    classSection: formatClassSection(cs),
    subject: subjectData,
    course: subjectData, // Alias
  };
}

/**
 * Finds the ClassSection for (subject, academicYear, semester, section), creating it if it doesn't exist yet.
 * A newly created section inherits an instructor whose name matches the subject's coordinator label, if any.
 */
export async function findOrCreateClassSection(params: {
  subjectId: number;
  academicYear?: string | null;
  semester?: string | null;
  section?: string | null;
  instructorId?: number | null;
}) {
  const academicYear = String(params.academicYear || DEFAULT_ACADEMIC_YEAR).trim();
  const semester = String(params.semester || DEFAULT_SEMESTER).trim();
  const section = String(params.section || DEFAULT_SECTION).trim().toUpperCase();

  const key = { subjectId: params.subjectId, academicYear, semester, section };
  const existing = await prisma.classSection.findUnique({
    where: { subjectId_academicYear_semester_section: key },
  });
  if (existing) return existing;

  let instructorId = params.instructorId ?? null;
  if (instructorId === null) {
    const subject = await prisma.subject.findUnique({ where: { id: params.subjectId }, select: { professorName: true } });
    if (subject?.professorName) {
      const match = await prisma.user.findFirst({
        where: {
          fullName: { equals: subject.professorName.trim(), mode: 'insensitive' },
          role: { in: ['Educator', 'DepartmentHead'] },
        },
        select: { id: true },
      });
      instructorId = match?.id ?? null;
    }
  }

  try {
    return await prisma.classSection.create({ data: { ...key, instructorId } });
  } catch (err: any) {
    // Another request created it concurrently.
    if (err?.code === 'P2002') {
      return prisma.classSection.findUniqueOrThrow({ where: { subjectId_academicYear_semester_section: key } });
    }
    throw err;
  }
}
