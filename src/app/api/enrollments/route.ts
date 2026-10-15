import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { enrollmentInclude, findOrCreateClassSection, formatEnrollment } from '@/lib/enrollments';

export const dynamic = 'force-dynamic';

const APPROVED_SYLLABUS_STATUSES = ['Approved', 'APPROVED', 'ACTIVE', 'Active'];

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const studentParam = searchParams.get('studentId') || searchParams.get('idNumber');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');
    const classSectionIdParam = searchParams.get('classSectionId');
    const semesterParam = searchParams.get('semester');
    const academicYearParam = searchParams.get('academicYear');
    const statusParam = searchParams.get('status');

    const where: any = {};
    const sectionWhere: any = {};
    const subjectWhere: any = {};

    // Status filter (default to ENROLLED unless specified or 'ALL')
    if (statusParam && statusParam.toUpperCase() !== 'ALL') {
      where.status = statusParam.trim().toUpperCase();
    } else if (!statusParam) {
      where.status = 'ENROLLED';
    }

    // Academic Period filters (live on the class section)
    if (semesterParam) sectionWhere.semester = semesterParam.trim();
    if (academicYearParam) sectionWhere.academicYear = academicYearParam.trim();

    // Department & Role Isolation
    if (user.role === 'Student') {
      const userIntId = parseInt(user.id, 10);
      where.studentId = !isNaN(userIntId) ? userIntId : 0;
    } else if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
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

    if (classSectionIdParam) {
      const csId = parseInt(classSectionIdParam, 10);
      if (!isNaN(csId)) where.classSectionId = csId;
    }
    if (subjectIdParam) {
      const parsedSubjectId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedSubjectId)) sectionWhere.subjectId = parsedSubjectId;
    }
    if (subjectCodeParam) subjectWhere.code = subjectCodeParam.trim().toUpperCase();

    if (Object.keys(subjectWhere).length) sectionWhere.subject = subjectWhere;
    if (Object.keys(sectionWhere).length) where.classSection = sectionWhere;

    const enrollments = await prisma.enrollment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        ...enrollmentInclude,
        classSection: {
          include: {
            instructor: { select: { id: true, fullName: true, email: true } },
            subject: {
              include: {
                syllabi: {
                  where: { status: { in: APPROVED_SYLLABUS_STATUSES } },
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                  select: { id: true, status: true, academicYear: true, semester: true, currentVersionNumber: true },
                },
              },
            },
          },
        },
      },
    });

    const formatted = enrollments.map((e: any) =>
      formatEnrollment(e, { activeSyllabus: e.classSection?.subject?.syllabi?.[0] || null })
    );

    return NextResponse.json({ enrollments: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to retrieve enrollments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const body = await req.json();
    let {
      studentId,
      idNumber,
      classSectionId,
      subjectId,
      courseId,
      subjectCode,
      courseCode,
      semester,
      academicYear,
      section,
      status = 'ENROLLED',
    } = body;

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

    // 1. Verify student exists and has role 'Student'
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

    // 2. Resolve the class section: either directly by classSectionId, or by subject + term + section
    let classSection: any = null;
    if (classSectionId !== undefined && classSectionId !== null && !isNaN(parseInt(String(classSectionId), 10))) {
      classSection = await prisma.classSection.findUnique({ where: { id: parseInt(String(classSectionId), 10) } });
      if (!classSection) return NextResponse.json({ error: 'Class section not found.' }, { status: 404 });
    }

    let subject: any = null;
    if (classSection) {
      subject = await prisma.subject.findUnique({ where: { id: classSection.subjectId } });
    } else {
      const targetSubjId = subjectId ?? courseId;
      const targetSubjCode = subjectCode || courseCode;
      if (targetSubjId !== undefined && targetSubjId !== null && !isNaN(parseInt(String(targetSubjId), 10))) {
        subject = await prisma.subject.findUnique({ where: { id: parseInt(String(targetSubjId), 10) } });
      } else if (targetSubjCode) {
        subject = await prisma.subject.findUnique({ where: { code: String(targetSubjCode).trim().toUpperCase() } });
      }
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found. Please provide a valid classSectionId, subjectId or subjectCode.' }, { status: 404 });
    }

    // 3. Department isolation rules
    const subjectDept = String(subject.departmentId).toUpperCase();
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
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
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode && subjectDept !== deptCode) {
        return NextResponse.json({
          error: `Students may only enroll in subjects within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    if (!classSection) {
      classSection = await findOrCreateClassSection({ subjectId: subject.id, academicYear, semester, section });
    }

    // 4. Business rules
    // 4a. A student may only be in ONE section of a subject per term (retakes in later terms are allowed).
    const sameTerm = await prisma.enrollment.findFirst({
      where: {
        studentId: numericStudentId,
        status: { not: 'DROPPED' },
        classSection: {
          subjectId: subject.id,
          academicYear: classSection.academicYear,
          semester: classSection.semester,
        },
      },
      include: { classSection: true },
    });
    if (sameTerm) {
      return NextResponse.json({
        error: `${studentUser.fullName} is already enrolled in [${subject.code}] ${subject.title} for ${classSection.semester} ${classSection.academicYear} (Section ${sameTerm.classSection.section}).`,
      }, { status: 409 });
    }

    // 4b. Section capacity
    const enrolledCount = await prisma.enrollment.count({
      where: { classSectionId: classSection.id, status: 'ENROLLED' },
    });
    if (enrolledCount >= classSection.capacity) {
      return NextResponse.json({
        error: `Section ${classSection.section} of [${subject.code}] is full (${enrolledCount}/${classSection.capacity}).`,
      }, { status: 409 });
    }

    // 5. Create (or re-activate a previously DROPPED enrollment in this same section)
    const cleanStatus = String(status || 'ENROLLED').trim().toUpperCase();
    const enrollment = await prisma.enrollment.upsert({
      where: { studentId_classSectionId: { studentId: numericStudentId, classSectionId: classSection.id } },
      update: { status: cleanStatus },
      create: { studentId: numericStudentId, classSectionId: classSection.id, status: cleanStatus },
      include: enrollmentInclude,
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'EnrollStudent',
      resultStatus: 'Success',
      description: `Enrolled student ${studentUser.fullName} (${numericStudentId}) in [${subject.code}] ${subject.title} (${classSection.semester}, ${classSection.academicYear} Sec ${classSection.section})`,
      entityType: 'Enrollment',
      entityId: String(enrollment.id),
    });

    return NextResponse.json({ success: true, enrollment: formatEnrollment(enrollment) }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enrollment:', error);
    if (error.code === 'P2002' || error.message?.includes('Unique constraint failed') || error.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Duplicate enrollment: Student is already enrolled in this class section.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create enrollment: ' + error.message }, { status: 500 });
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
    const enrollmentIdParam = searchParams.get('id');
    const studentParam = searchParams.get('studentId') || searchParams.get('idNumber');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');
    const classSectionIdParam = searchParams.get('classSectionId');

    let existing: any = null;

    if (enrollmentIdParam && /^\d+$/.test(enrollmentIdParam)) {
      // Preferred: delete by enrollment id
      existing = await prisma.enrollment.findUnique({ where: { id: parseInt(enrollmentIdParam, 10) }, include: enrollmentInclude });
    } else {
      // Legacy: studentId + (classSectionId | subjectId | subjectCode) → most recent active enrollment
      const numericStudentId = user.role === 'Student' ? parseInt(user.id, 10) : parseInt(studentParam || '', 10);
      if (isNaN(numericStudentId) || (!classSectionIdParam && !subjectIdParam && !subjectCodeParam)) {
        return NextResponse.json({ error: 'Provide an enrollment id, or a studentId with classSectionId / subjectId / subjectCode.' }, { status: 400 });
      }
      const sectionWhere: any = {};
      if (classSectionIdParam) sectionWhere.id = parseInt(classSectionIdParam, 10);
      if (subjectIdParam) sectionWhere.subjectId = parseInt(subjectIdParam, 10);
      if (subjectCodeParam) sectionWhere.subject = { code: subjectCodeParam.trim().toUpperCase() };
      existing = await prisma.enrollment.findFirst({
        where: { studentId: numericStudentId, classSection: sectionWhere },
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // ENROLLED sorts before DROPPED/COMPLETED
        include: enrollmentInclude,
      });
    }

    if (!existing) return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });

    const subject = existing.classSection.subject;

    // Students can only unenroll themselves
    if (user.role === 'Student' && existing.studentId !== parseInt(user.id, 10)) {
      return NextResponse.json({ error: 'Students may only manage their own enrollments.' }, { status: 403 });
    }
    // Department isolation
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || String(subject.departmentId).toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only manage enrollments within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    await prisma.enrollment.delete({ where: { id: existing.id } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'UnenrollStudent',
      resultStatus: 'Success',
      description: `Unenrolled student ${existing.student?.fullName || existing.studentId} (${existing.studentId}) from [${subject.code}] ${subject.title} (${existing.classSection.semester}, ${existing.classSection.academicYear} Sec ${existing.classSection.section})`,
      entityType: 'Enrollment',
      entityId: String(existing.id),
    });

    return NextResponse.json({ success: true, message: 'Student unenrolled successfully.' });
  } catch (error: any) {
    console.error('Error deleting enrollment:', error);
    return NextResponse.json({ error: 'Failed to unenroll student.' }, { status: 500 });
  }
}
