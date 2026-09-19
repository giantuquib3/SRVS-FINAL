import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const studentParam = searchParams.get('studentId');
    const courseParam = searchParams.get('courseId') || searchParams.get('subjectId');

    const where: any = { status: 'ENROLLED' };

    if (user.role === 'Student') {
      const userIntId = parseInt(user.id, 10);
      where.studentId = !isNaN(userIntId) ? userIntId : 0;
    } else if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.course = { departmentId: deptCode };
      if (studentParam) {
        const sInt = parseInt(studentParam, 10);
        if (!isNaN(sInt)) where.studentId = sInt;
      }
    } else {
      if (studentParam) {
        const sInt = parseInt(studentParam, 10);
        if (!isNaN(sInt)) where.studentId = sInt;
      }
    }

    if (courseParam) {
      const parsedCourseId = !isNaN(parseInt(courseParam, 10)) ? parseInt(courseParam, 10) : null;
      if (parsedCourseId !== null) {
        where.courseId = parsedCourseId;
      } else {
        where.course = { ...(where.course || {}), code: courseParam.trim().toUpperCase() };
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          include: {
            syllabi: {
              where: { status: { in: ['Approved', 'APPROVED'] } },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, status: true, academicYear: true, semester: true, currentVersionNumber: true },
            },
          },
        },
      },
    });

    const formatted = enrollments.map((e) => {
      const courseDeptCode = String(e.course.departmentId || '');
      return {
        ...e,
        id: `${e.studentId}_${e.courseId}`,
        student: {
          id: String(e.studentId),
          idNumber: String(e.studentId),
          fullName: e.studentName,
        },
        course: {
          ...e.course,
          department: { id: courseDeptCode, code: courseDeptCode, name: getDepartmentName(courseDeptCode) },
        },
        subject: {
          ...e.course,
          department: { id: courseDeptCode, code: courseDeptCode, name: getDepartmentName(courseDeptCode) },
        },
        subjectId: e.courseId,
      };
    });

    return NextResponse.json({ enrollments: formatted });
  } catch (error: any) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const body = await req.json();
    let { studentId, studentName, courseId, subjectId, courseCode, semester = '1st Semester', academicYear = '2026-2027', section = 'A' } = body;

    if (user.role === 'Student') {
      studentId = user.id;
    } else if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const rawTarget = String(subjectId || courseId || courseCode || '').trim().toUpperCase();
    const cleanStudentIdStr = String(studentId || '').trim();
    const numericStudentId = parseInt(cleanStudentIdStr, 10);

    if (isNaN(numericStudentId) || !rawTarget) {
      return NextResponse.json({ error: 'Valid numeric Student ID and Course are required.' }, { status: 400 });
    }

    // Find the course
    const parsedCourseTarget = !isNaN(parseInt(rawTarget, 10)) ? parseInt(rawTarget, 10) : null;
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          ...(parsedCourseTarget !== null ? [{ id: parsedCourseTarget }] : []),
          { code: rawTarget },
        ],
      },
    });
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

    // Verify or auto-provision student in admin user directory to satisfy FK
    let studentUser = await prisma.user.findFirst({
      where: { id: numericStudentId },
    });

    if (!studentUser) {
      try {
        studentUser = await prisma.user.create({
          data: {
            id: numericStudentId,
            email: `student${numericStudentId}@usjr.edu.ph`,
            fullName: studentName?.trim() || `Student ${numericStudentId}`,
            role: 'Student',
            departmentId: course.departmentId,
            passwordHash: '$2a$10$0G4oW3f6eHwJpZqT6W5R1.l5s7H1yW1s4Xz9yOq1m7h2F9V4hVf6e',
            accountStatus: 'Active',
          },
        });
      } catch (e) {
        studentUser = await prisma.user.findFirst({ where: { id: numericStudentId } });
      }
    }

    const resolvedStudentName = (studentName?.trim() || studentUser?.fullName || `Student ${numericStudentId}`);

    // Department Head scoping
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || course.departmentId !== deptCode) {
        return NextResponse.json({
          error: 'Department Heads may only manage enrollments within their own department.',
        }, { status: 403 });
      }
    }

    // Check duplicate enrollment
    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: numericStudentId,
          courseId: course.id,
        },
      },
    });
    if (existing && existing.status === 'ENROLLED') {
      return NextResponse.json({ error: `Student is already enrolled in ${course.code}.` }, { status: 409 });
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: numericStudentId,
          courseId: course.id,
        },
      },
      update: {
        studentName: resolvedStudentName,
        semester,
        academicYear,
        section,
        status: 'ENROLLED',
      },
      create: {
        studentId: numericStudentId,
        studentName: resolvedStudentName,
        courseId: course.id,
        semester,
        academicYear,
        section,
        status: 'ENROLLED',
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'EnrollStudent',
      resultStatus: 'Success',
      description: `Enrolled student ${resolvedStudentName} (${numericStudentId}) into ${course.code} – ${course.title}`,
      entityType: 'Enrollment',
      entityId: `${numericStudentId}_${course.id}`,
    });

    const courseDeptCode = String(course.departmentId || '');
    return NextResponse.json({
      success: true,
      enrollment: {
        ...enrollment,
        id: `${enrollment.studentId}_${enrollment.courseId}`,
        student: { id: String(enrollment.studentId), idNumber: String(enrollment.studentId), fullName: enrollment.studentName },
        course: { ...course, department: { id: courseDeptCode, code: courseDeptCode, name: getDepartmentName(courseDeptCode) } },
        subject: { ...course },
        subjectId: course.id,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to enroll student: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead' && user.role !== 'Student')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const enrollmentId = searchParams.get('id');
    let studentId = searchParams.get('studentId');
    let courseId = (searchParams.get('courseId') || searchParams.get('subjectId') || '').trim().toUpperCase();

    if (enrollmentId && (!studentId || !courseId)) {
      const parts = enrollmentId.split('_');
      if (parts.length === 2) {
        studentId = parts[0];
        courseId = parts[1].toUpperCase();
      }
    }

    let numericStudentId = parseInt(studentId || '', 10);

    // Students can only unenroll themselves
    if (user.role === 'Student') {
      numericStudentId = parseInt(user.id, 10);
    }

    if (isNaN(numericStudentId) || !courseId) {
      return NextResponse.json({ error: 'Valid numeric studentId and courseId required.' }, { status: 400 });
    }

    const parsedTargetCourseId = !isNaN(parseInt(courseId, 10)) ? parseInt(courseId, 10) : null;
    const targetCourse = await prisma.course.findFirst({
      where: {
        OR: [
          ...(parsedTargetCourseId !== null ? [{ id: parsedTargetCourseId }] : []),
          { code: courseId },
        ],
      },
    });
    if (!targetCourse) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: numericStudentId,
          courseId: targetCourse.id,
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });

    await prisma.enrollment.delete({
      where: {
        studentId_courseId: {
          studentId: numericStudentId,
          courseId: targetCourse.id,
        },
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'UnenrollStudent',
      resultStatus: 'Success',
      description: `Unenrolled student ${existing.studentName} (${numericStudentId}) from course ${targetCourse.code}`,
      entityType: 'Enrollment',
      entityId: `${numericStudentId}_${targetCourse.id}`,
    });

    return NextResponse.json({ success: true, message: 'Student unenrolled successfully.' });
  } catch (error: any) {
    console.error('Error deleting enrollment:', error);
    return NextResponse.json({ error: 'Failed to unenroll student.' }, { status: 500 });
  }
}
