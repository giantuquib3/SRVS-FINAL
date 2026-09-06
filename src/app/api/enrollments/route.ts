import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');
    const academicYear = searchParams.get('academicYear');
    const semester = searchParams.get('semester');

    const where: any = {};

    // Role scoping:
    // - Student can only query own enrollments
    // - Department Head can only query enrollments for courses within their own department
    if (user.role === 'Student') {
      where.studentId = user.id;
    } else if (user.role === 'DepartmentHead') {
      where.course = { departmentId: user.departmentId || '__NO_DEPT__' };
      if (studentId) where.studentId = studentId;
    } else if (studentId) {
      where.studentId = studentId;
    }

    if (courseId) where.courseId = courseId;
    if (academicYear) where.academicYear = academicYear;
    if (semester) where.semester = semester;

    const enrollments = await prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        course: {
          include: {
            department: true,
            syllabi: {
              where: {
                status: { in: ['Approved', 'ACTIVE'] },
              },
              select: {
                id: true,
                currentVersionNumber: true,
                status: true,
                academicYear: true,
                semester: true,
                uploadedByUserId: true,
              },
              take: 1,
            },
          },
        },
        subject: {
          include: {
            department: true,
          },
        },
      },
    });

    return NextResponse.json({ enrollments });
  } catch (error: any) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, courseId, subjectId, semester, academicYear, section = 'A', status = 'ENROLLED' } = body;
    const targetId = (subjectId || courseId || '').trim();

    if (!studentId || !targetId || !semester || !academicYear) {
      return NextResponse.json({ error: 'Student, Subject/Course, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Verify student exists and is Active
    const student = await prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!student || student.role !== 'Student') {
      return NextResponse.json({ error: 'Invalid student selected.' }, { status: 400 });
    }

    // Verify course/subject exists
    const course = await prisma.course.findUnique({
      where: { id: targetId },
      include: { department: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Invalid course/subject selected.' }, { status: 400 });
    }

    // Department Head can only enroll students in courses within their assigned department
    if (user.role === 'DepartmentHead' && user.departmentId && course.departmentId !== user.departmentId) {
      return NextResponse.json({
        error: 'Department Heads may only manage student enrollments in courses within their assigned department.',
      }, { status: 403 });
    }

    // Check duplicate enrollment
    const existing = await prisma.enrollment.findFirst({
      where: {
        studentId,
        semester,
        academicYear,
        OR: [
          { courseId: targetId },
          { subjectId: targetId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({
        error: `Student is already enrolled in ${course.code} for ${semester}, AY ${academicYear}.`,
      }, { status: 409 });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        courseId: targetId,
        subjectId: targetId,
        semester,
        academicYear,
        section: section || 'A',
        status: status || 'ENROLLED',
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        course: true,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'EnrollStudent',
      resultStatus: 'Success',
      description: `Enrolled student ${student.fullName} (${student.email}) into [${course.code}] ${course.title} (Section ${enrollment.section}, ${semester}, AY ${academicYear})`,
      entityType: 'Enrollment',
      entityId: enrollment.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({ success: true, enrollment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to save enrollment.' }, { status: 500 });
  }
}
