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
    const studentParam = searchParams.get('studentId') || searchParams.get('idNumber');
    const courseIdParam = searchParams.get('courseId');
    const courseCodeParam = searchParams.get('courseCode');

    const where: any = { status: 'ENROLLED' };

    // Department & Role Isolation (Requirement 21)
    if (user.role === 'Student') {
      const userIntId = parseInt(user.id, 10);
      where.studentId = !isNaN(userIntId) ? userIntId : 0;
    } else if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ enrollments: [], total: 0 });
      where.course = { departmentId: deptCode };
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

    // courseId filter (integer database ID)
    if (courseIdParam) {
      const parsedCourseId = parseInt(courseIdParam, 10);
      if (!isNaN(parsedCourseId)) where.courseId = parsedCourseId;
    }

    // courseCode filter (string course code e.g. CPE101)
    if (courseCodeParam) {
      where.course = { ...(where.course || {}), code: courseCodeParam.trim().toUpperCase() };
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            departmentId: true,
          },
        },
        course: {
          include: {
            syllabi: {
              where: { status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, status: true, academicYear: true, semester: true, currentVersionNumber: true },
            },
          },
        },
      },
    });

    const formatted = enrollments.map((e: any) => {
      const courseDeptCode = String(e.course.departmentId || '');
      return {
        id: `${e.studentId}_${e.courseId}`,
        studentId: e.studentId,
        studentName: e.studentName || e.student?.fullName,
        courseId: e.courseId,
        semester: e.semester,
        academicYear: e.academicYear,
        section: e.section,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        student: {
          id: e.studentId,
          idNumber: e.studentId,
          fullName: e.studentName || e.student?.fullName,
          email: e.student?.email,
        },
        course: {
          id: e.course.id,
          code: e.course.code,
          title: e.course.title,
          units: e.course.units,
          departmentId: courseDeptCode,
          professorName: e.course.professorName || null,
          department: { id: courseDeptCode, code: courseDeptCode, name: getDepartmentName(courseDeptCode) },
          activeSyllabus: e.course.syllabi?.[0] || null,
        },
      };
    });

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
    let { studentId, studentName, idNumber, courseId, courseCode, semester = '1st Semester', academicYear = '2026-2027', section = 'A' } = body;

    // Student self-enrollment or Admin/DeptHead enrollment
    if (user.role === 'Student') {
      studentId = user.id;
    } else if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Students, Department Heads, and Administrators may create enrollments.' }, { status: 403 });
    }

    const cleanStudentIdStr = String(studentId || idNumber || '').trim();
    const numericStudentId = parseInt(cleanStudentIdStr, 10);

    if (isNaN(numericStudentId)) {
      return NextResponse.json({ error: 'A valid numeric 10-digit student ID number is required.' }, { status: 400 });
    }

    // Resolve course by integer courseId or string courseCode
    let course = null;
    if (courseId !== undefined && courseId !== null && !isNaN(parseInt(String(courseId), 10))) {
      course = await prisma.course.findUnique({ where: { id: parseInt(String(courseId), 10) } });
    } else if (courseCode) {
      course = await prisma.course.findUnique({ where: { code: String(courseCode).trim().toUpperCase() } });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found. Please provide a valid courseId or courseCode.' }, { status: 404 });
    }

    // Department Isolation (Requirement 21)
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || course.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only enroll students in courses within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    } else if (user.role === 'Student') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode && course.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Students may only enroll in courses within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

    // Verify or auto-provision student record in master directory to satisfy FK
    let studentUser = await prisma.user.findUnique({ where: { id: numericStudentId } });
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
        studentUser = await prisma.user.findUnique({ where: { id: numericStudentId } });
      }
    }

    const resolvedStudentName = studentName?.trim() || studentUser?.fullName || `Student ${numericStudentId}`;

    // Check duplicate enrollment for this course
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
      description: `Enrolled student ${resolvedStudentName} (${numericStudentId}) in [${course.code}] ${course.title} (${semester}, ${academicYear} Sec ${section})`,
      entityType: 'Enrollment',
      entityId: `${numericStudentId}_${course.id}`,
    });

    const courseDept = String(course.departmentId || '');

    return NextResponse.json(
      {
        success: true,
        enrollment: {
          id: `${enrollment.studentId}_${enrollment.courseId}`,
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          courseId: enrollment.courseId,
          semester: enrollment.semester,
          academicYear: enrollment.academicYear,
          section: enrollment.section,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
          student: {
            id: enrollment.studentId,
            idNumber: enrollment.studentId,
            fullName: resolvedStudentName,
            email: studentUser?.email,
          },
          course: {
            id: course.id,
            code: course.code,
            title: course.title,
            units: course.units,
            departmentId: courseDept,
            professorName: course.professorName || null,
            department: { id: courseDept, code: courseDept, name: getDepartmentName(courseDept) },
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to create enrollment: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const enrollmentId = searchParams.get('id');
    let studentId = searchParams.get('studentId') || searchParams.get('idNumber');
    let courseId = searchParams.get('courseId');
    const courseCode = searchParams.get('courseCode');

    if (enrollmentId && enrollmentId.includes('_')) {
      const parts = enrollmentId.split('_');
      if (parts.length === 2) {
        studentId = parts[0];
        courseId = parts[1];
      }
    }

    let numericStudentId = parseInt(studentId || '', 10);

    // Students can only unenroll themselves
    if (user.role === 'Student') {
      numericStudentId = parseInt(user.id, 10);
    } else if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    if (isNaN(numericStudentId) || (!courseId && !courseCode)) {
      return NextResponse.json({ error: 'Valid numeric studentId and courseId or courseCode are required.' }, { status: 400 });
    }

    let targetCourse = null;
    if (courseId && !isNaN(parseInt(courseId, 10))) {
      targetCourse = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
    } else if (courseCode) {
      targetCourse = await prisma.course.findUnique({ where: { code: courseCode.trim().toUpperCase() } });
    }

    if (!targetCourse) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

    // Department Isolation (Requirement 21)
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || targetCourse.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Department Heads may only manage enrollments within their assigned department (${deptCode}).`,
        }, { status: 403 });
      }
    }

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
      description: `Unenrolled student ${existing.studentName} (${numericStudentId}) from course [${targetCourse.code}] ${targetCourse.title}`,
      entityType: 'Enrollment',
      entityId: `${numericStudentId}_${targetCourse.id}`,
    });

    return NextResponse.json({ success: true, message: 'Student unenrolled successfully.' });
  } catch (error: any) {
    console.error('Error deleting enrollment:', error);
    return NextResponse.json({ error: 'Failed to unenroll student.' }, { status: 500 });
  }
}
