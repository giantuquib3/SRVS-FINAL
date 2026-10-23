import { getDepartmentName } from '@/lib/departments';

/**
 * Shared helpers for student <-> subject associations (`student_subjects` table).
 *
 *   User (Student) 1 ──< StudentSubject >── 1 Subject
 *
 * Student names and subject titles are not stored on student_subjects;
 * they always come from users.fullName / subjects.* via these joins.
 */

/** Prisma `include` that loads everything needed by {@link formatStudentSubject}. */
export const studentSubjectInclude = {
  student: {
    select: { id: true, fullName: true, email: true, departmentId: true, yearLevel: true, accountStatus: true },
  },
  subject: true,
  enrolledBy: { select: { id: true, fullName: true, role: true } },
} as const;

export function formatSubject(subject: any, activeSyllabus?: any) {
  if (!subject) return null;
  const dept = String(subject.departmentId || '');
  return {
    id: subject.id,
    code: subject.code,
    title: subject.title,
    description: subject.description ?? null,
    units: subject.units,
    lecHours: subject.lecHours,
    labHours: subject.labHours,
    prerequisite: subject.prerequisite,
    yearLevel: subject.yearLevel,
    semester: subject.semester,
    departmentId: dept,
    professorName: subject.professorName || null,
    department: { id: dept, code: dept, name: getDepartmentName(dept) },
    ...(activeSyllabus !== undefined ? { activeSyllabus } : {}),
  };
}

/**
 * Formats a student_subjects row (loaded with {@link studentSubjectInclude}) into the API response shape.
 * `studentName` and the `course` alias are kept so existing UI pages keep working.
 */
export function formatStudentSubject(row: any, opts: { activeSyllabus?: any } = {}) {
  const subjectData = formatSubject(row.subject, opts.activeSyllabus);
  const student = row.student;
  const studentName = student?.fullName || `Student ${row.studentId}`;

  return {
    id: row.id,
    studentId: row.studentId,
    studentName,
    subjectId: row.subjectId,
    courseId: row.subjectId, // Alias
    status: row.status,
    academicYear: row.academicYear,
    semester: row.semester,
    enrolledById: row.enrolledById ?? null,
    enrolledBy: row.enrolledBy ? { id: row.enrolledBy.id, fullName: row.enrolledBy.fullName, role: row.enrolledBy.role } : null,
    createdAt: row.createdAt,
    student: {
      id: row.studentId,
      idNumber: row.studentId,
      fullName: studentName,
      email: student?.email,
      departmentId: student?.departmentId || null,
      departmentCode: student?.departmentId || null,
      departmentName: getDepartmentName(student?.departmentId),
      yearLevel: student?.yearLevel || '1st Year',
      accountStatus: student?.accountStatus || 'Active',
    },
    subject: subjectData,
    course: subjectData, // Alias
  };
}
