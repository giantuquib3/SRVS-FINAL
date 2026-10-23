import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { studentSubjectInclude, formatStudentSubject } from '@/lib/enrollments';
import {
  SYLLABUS_STATUS,
  ENROLLMENT_STATUS,
  ENROLLMENT_STATUSES,
  SEMESTERS,
  ACADEMIC_YEAR_PATTERN,
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_SEMESTER,
} from '@/lib/status';

export const dynamic = 'force-dynamic';

/**
 * Student <-> Subject associations (student_subjects table).
 * The /api/enrollments path is kept for backwards compatibility.
 */

function deptOf(user: any) {
  return user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
}

/**
 * Validates the optional enrollment detail fields (status / academicYear / semester).
 * Returns the cleaned values that were provided, or an error message.
 */
function parseEnrollmentFields(body: any): { data: any; error?: string } {
  const data: any = {};
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    const status = String(body.status).trim().toUpperCase();
    if (!ENROLLMENT_STATUSES.includes(status)) {
      return { data, error: `Invalid status "${body.status}". Allowed: ${ENROLLMENT_STATUSES.join(', ')}.` };
    }
    data.status = status;
  }
  if (body.academicYear !== undefined && body.academicYear !== null && body.academicYear !== '') {
    const academicYear = String(body.academicYear).trim();
    const [start, end] = academicYear.split('-').map(Number);
    if (!ACADEMIC_YEAR_PATTERN.test(academicYear) || end !== start + 1) {
      return { data, error: `Invalid academicYear "${body.academicYear}". Use the format YYYY-YYYY, e.g. 2026-2027.` };
    }
    data.academicYear = academicYear;
  }
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    const semester = String(body.semester).trim();
    if (!(SEMESTERS as readonly string[]).includes(semester)) {
      return { data, error: `Invalid semester "${body.semester}". Allowed: ${SEMESTERS.join(', ')}.` };
    }
    data.semester = semester;
  }
  return { data };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const studentParam = searchParams.get('studentId') || searchParams.get('idNumber');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');
    const statusParam = searchParams.get('status');
    const semesterParam = searchParams.get('semester');
    const academicYearParam = searchParams.get('academicYear');

    const where: any = {};
    const subjectWhere: any = {};

    // Status filter: ENROLLED by default, 'ALL' for every status
    if (statusParam && statusParam.trim().toUpperCase() !== 'ALL') {
      where.status = statusParam.trim().toUpperCase();
    } else if (!statusParam) {
      where.status = ENROLLMENT_STATUS.ENROLLED;
    }
    if (semesterParam) where.semester = semesterParam.trim();
    if (academicYearParam) where.academicYear = academicYearParam.trim();

    // Role & department isolation
    if (user.role === 'Student') {
      const userIntId = parseInt(user.id, 10);
      where.studentId = !isNaN(userIntId) ? userIntId : 0;
    } else if (user.role === 'DepartmentHead') {
      const deptCode = deptOf(user);
      if (!deptCode) return NextResponse.json({ enrollments: [], total: 0 });
      subjectWhere.departmentId = deptCode;
      if (studentParam) {
        const sInt = parseInt(studentParam, 10);
        if (!isNaN(sInt)) where.studentId = sInt;
      }
    } else if (user.role === 'Admin') {
      if (studentParam) {
        const sInt = parseInt(studentParam, 10);
        if (!isNaN(sInt)) where.studentId = sInt;
      }
    } else {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (subjectIdParam) {
      const parsedSubjectId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedSubjectId)) where.subjectId = parsedSubjectId;
    }
    if (subjectCodeParam) subjectWhere.code = subjectCodeParam.trim().toUpperCase();
    if (Object.keys(subjectWhere).length) where.subject = subjectWhere;

    const rows = await prisma.studentSubject.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        ...studentSubjectInclude,
        subject: {
          include: {
            syllabi: {
              where: { status: SYLLABUS_STATUS.APPROVED },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, status: true, academicYear: true, semester: true, currentVersionNumber: true },
            },
          },
        },
      },
    });

    const formatted = rows.map((r: any) => formatStudentSubject(r, { activeSyllabus: r.subject?.syllabi?.[0] || null }));
    return NextResponse.json({ enrollments: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Error fetching student subjects:', error);
    return NextResponse.json({ error: 'Failed to retrieve enrollments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const body = await req.json();
    let { studentId, idNumber, subjectId, courseId, subjectCode, courseCode } = body;

    // Student self-enrollment or Admin/DeptHead enrollment
    if (user.role === 'Student') {
      studentId = user.id;
    } else if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Students, Department Heads, and Administrators may create enrollments.' }, { status: 403 });
    }

    const numericStudentId = parseInt(String(studentId || idNumber || '').trim(), 10);
    if (isNaN(numericStudentId)) {
      return NextResponse.json({ error: 'A valid numeric student ID number is required.' }, { status: 400 });
    }

    // Enrollment details (term + status); defaults apply when omitted
    const fields = parseEnrollmentFields(body);
    if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
    // Students may only create ENROLLED records for themselves
    if (user.role === 'Student' && fields.data.status && fields.data.status !== ENROLLMENT_STATUS.ENROLLED) {
      return NextResponse.json({ error: 'Students can only create enrollments with status ENROLLED.' }, { status: 403 });
    }

    // 1. Student must exist and have role 'Student'
    const studentUser = await prisma.user.findUnique({ where: { id: numericStudentId } });
    if (!studentUser) {
      return NextResponse.json({
        error: `Student not found. User with ID ${numericStudentId} does not exist in the users directory.`,
      }, { status: 404 });
    }
    if (studentUser.role !== 'Student') {
      return NextResponse.json({
        error: `User ${studentUser.fullName} (ID: ${numericStudentId}) has role "${studentUser.role}". Only users whose role is "Student" may be enrolled in subjects.`,
      }, { status: 400 });
    }

    // 2. Subject must exist (by id or code)
    let subject: any = null;
    const targetSubjId = subjectId ?? courseId;
    const targetSubjCode = subjectCode || courseCode;
    if (targetSubjId !== undefined && targetSubjId !== null && !isNaN(parseInt(String(targetSubjId), 10))) {
      subject = await prisma.subject.findUnique({ where: { id: parseInt(String(targetSubjId), 10) } });
    } else if (targetSubjCode) {
      subject = await prisma.subject.findUnique({ where: { code: String(targetSubjCode).trim().toUpperCase() } });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found. Please provide a valid subjectId or subjectCode.' }, { status: 404 });
    }

    // 3. Department isolation
    const subjectDept = String(subject.departmentId).toUpperCase();
    if (user.role === 'DepartmentHead') {
      const deptCode = deptOf(user);
      if (!deptCode || subjectDept !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only enroll students in subjects within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
      if (studentUser.departmentId && studentUser.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only enroll students belonging to their department (${deptCode}). Student belongs to ${studentUser.departmentId.toUpperCase()}.`,
        }, { status: 403 });
      }
    } else if (user.role === 'Student') {
      const deptCode = deptOf(user);
      if (deptCode && subjectDept !== deptCode) {
        return NextResponse.json({
          error: `Students may only enroll in subjects within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    // 4. One association per student per subject (also enforced by uq_student_subjects)
    const existing = await prisma.studentSubject.findUnique({
      where: { studentId_subjectId: { studentId: numericStudentId, subjectId: subject.id } },
    });
    if (existing) {
      return NextResponse.json({
        error: `${studentUser.fullName} is already enrolled in [${subject.code}] ${subject.title}.`,
      }, { status: 409 });
    }

    const enrolledById = parseInt(String(user.id), 10);
    const created = await prisma.studentSubject.create({
      data: {
        studentId: numericStudentId,
        subjectId: subject.id,
        status: fields.data.status || ENROLLMENT_STATUS.ENROLLED,
        academicYear: fields.data.academicYear || DEFAULT_ACADEMIC_YEAR,
        semester: fields.data.semester || DEFAULT_SEMESTER,
        enrolledById: isNaN(enrolledById) ? null : enrolledById,
      },
      include: studentSubjectInclude,
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'EnrollStudent',
      resultStatus: 'Success',
      description: `Enrolled student ${studentUser.fullName} (${numericStudentId}) in [${subject.code}] ${subject.title} (${created.semester}, ${created.academicYear}, ${created.status})`,
      entityType: 'Enrollment',
      entityId: String(created.id),
    });

    return NextResponse.json({ success: true, enrollment: formatStudentSubject(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating student subject:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate enrollment: Student is already enrolled in this subject.' }, { status: 409 });
    }
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid student or subject ID.' }, { status: 404 });
    }
    // Raised by the student_subjects_enforce_rules trigger (prisma/sql/student-subjects.sql)
    if (error.message?.includes('ENROLL_NOT_STUDENT')) {
      return NextResponse.json({ error: 'Only users whose role is "Student" may be enrolled in subjects.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
  }
}

/** PATCH /api/enrollments  { id, status?, academicYear?, semester? } — Admin / Department Head only */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Only Administrators and Department Heads may update enrollments.' }, { status: 403 });
    }

    const body = await req.json();
    const id = parseInt(String(body.id ?? ''), 10);
    if (isNaN(id)) return NextResponse.json({ error: 'A valid enrollment id is required.' }, { status: 400 });

    const fields = parseEnrollmentFields(body);
    if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
    if (Object.keys(fields.data).length === 0) {
      return NextResponse.json({ error: 'Provide at least one of: status, academicYear, semester.' }, { status: 400 });
    }

    const existing = await prisma.studentSubject.findUnique({ where: { id }, include: studentSubjectInclude });
    if (!existing) return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead') {
      const deptCode = deptOf(user);
      if (!deptCode || String(existing.subject.departmentId).toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only manage enrollments within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    const updated = await prisma.studentSubject.update({ where: { id }, data: fields.data, include: studentSubjectInclude });

    const changes = Object.entries(fields.data)
      .filter(([key, value]) => (existing as any)[key] !== value)
      .map(([key, value]) => `${key}: ${(existing as any)[key]} → ${value}`);
    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'UpdateEnrollment',
      resultStatus: 'Success',
      description: `Updated enrollment of ${existing.student?.fullName || existing.studentId} (${existing.studentId}) in [${existing.subject.code}] ${existing.subject.title}${changes.length ? ' — ' + changes.join(', ') : ' (no changes)'}`,
      entityType: 'Enrollment',
      entityId: String(id),
    });

    return NextResponse.json({ success: true, enrollment: formatStudentSubject(updated) });
  } catch (error: any) {
    console.error('Error updating student subject:', error);
    return NextResponse.json({ error: 'Failed to update enrollment.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!['Student', 'Admin', 'DepartmentHead'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const studentParam = searchParams.get('studentId') || searchParams.get('idNumber');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');

    let existing: any = null;

    if (idParam && /^\d+$/.test(idParam)) {
      existing = await prisma.studentSubject.findUnique({ where: { id: parseInt(idParam, 10) }, include: studentSubjectInclude });
    } else {
      // studentId + (subjectId | subjectCode)
      const numericStudentId = user.role === 'Student' ? parseInt(user.id, 10) : parseInt(studentParam || '', 10);
      if (isNaN(numericStudentId) || (!subjectIdParam && !subjectCodeParam)) {
        return NextResponse.json({ error: 'Provide an enrollment id, or a studentId with subjectId / subjectCode.' }, { status: 400 });
      }
      let targetSubjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : NaN;
      if (isNaN(targetSubjectId) && subjectCodeParam) {
        const subj = await prisma.subject.findUnique({ where: { code: subjectCodeParam.trim().toUpperCase() }, select: { id: true } });
        targetSubjectId = subj?.id ?? NaN;
      }
      if (!isNaN(targetSubjectId)) {
        existing = await prisma.studentSubject.findUnique({
          where: { studentId_subjectId: { studentId: numericStudentId, subjectId: targetSubjectId } },
          include: studentSubjectInclude,
        });
      }
    }

    if (!existing) return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });

    const subject = existing.subject;

    // Students can only unenroll themselves
    if (user.role === 'Student' && existing.studentId !== parseInt(user.id, 10)) {
      return NextResponse.json({ error: 'Students may only manage their own enrollments.' }, { status: 403 });
    }
    // Department isolation
    if (user.role === 'DepartmentHead') {
      const deptCode = deptOf(user);
      if (!deptCode || String(subject.departmentId).toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only manage enrollments within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    await prisma.studentSubject.delete({ where: { id: existing.id } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'UnenrollStudent',
      resultStatus: 'Success',
      description: `Unenrolled student ${existing.student?.fullName || existing.studentId} (${existing.studentId}) from [${subject.code}] ${subject.title}`,
      entityType: 'Enrollment',
      entityId: String(existing.id),
    });

    return NextResponse.json({ success: true, message: 'Student unenrolled successfully.' });
  } catch (error: any) {
    console.error('Error deleting student subject:', error);
    return NextResponse.json({ error: 'Failed to unenroll student.' }, { status: 500 });
  }
}
