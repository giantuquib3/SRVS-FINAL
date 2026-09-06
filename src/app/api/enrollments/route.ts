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

    // If student, can only query own enrollments
    if (user.role === 'Student') {
      where.studentId = user.id;
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
                status: 'Approved',
              },
              select: {
                id: true,
                currentVersionNumber: true,
                status: true,
                academicYear: true,
                semester: true,
              },
              take: 1,
            },
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

    const { studentId, courseId, semester, academicYear, section, status } = await req.json();

    if (!studentId || !courseId || !semester || !academicYear) {
      return NextResponse.json({ error: 'Student, Course, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Verify student exists and is Active
    const student = await prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!student || student.role !== 'Student') {
      return NextResponse.json({ error: 'Invalid student selected.' }, { status: 400 });
    }

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Invalid course selected.' }, { status: 400 });
    }

    // Check duplicate enrollment
    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId_semester_academicYear: {
          studentId,
          courseId,
          semester,
          academicYear,
        },
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
        courseId,
        semester,
        academicYear,
        section: section?.trim() || 'A',
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
