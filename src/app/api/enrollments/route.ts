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
    const studentParam = searchParams.get('studentId');
    const subjectParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const academicYear = searchParams.get('academicYear');
    const semester = searchParams.get('semester');

    const where: any = {};

    if (user.role === 'Student') {
      where.studentId = Number(user.id);
    } else if (user.role === 'DepartmentHead') {
      if (user.departmentId) {
        where.subject = { departmentId: Number(user.departmentId) };
      }
      if (studentParam) {
        const parsedStudentId = Number(studentParam);
        if (!isNaN(parsedStudentId)) where.studentId = parsedStudentId;
      }
    } else if (studentParam) {
      const parsedStudentId = Number(studentParam);
      if (!isNaN(parsedStudentId)) where.studentId = parsedStudentId;
    }

    if (subjectParam) {
      const parsedSubjId = Number(subjectParam);
      if (!isNaN(parsedSubjId)) {
        where.subjectId = parsedSubjId;
      } else {
        where.subject = { code: subjectParam.toUpperCase() };
      }
    }

    if (academicYear) where.academicYear = academicYear;
    if (semester) where.semester = semester;

    const rawEnrollments = await prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        subject: {
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
      },
    });

    const enrollments = rawEnrollments.map((e) => ({
      ...e,
      course: e.subject,
      courseId: e.subjectId,
    }));

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
    const rawTarget = String(subjectId || courseId || '').trim();

    if (!studentId || !rawTarget || !semester || !academicYear) {
      return NextResponse.json({ error: 'Student, Subject, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Lookup Student by integer ID or ID Number
    const numericStudentId = Number(studentId);
    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { idNumber: String(studentId).trim() },
          { id: isNaN(numericStudentId) ? -1 : numericStudentId },
        ],
        role: 'Student',
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Invalid student selected.' }, { status: 400 });
    }

    // Lookup Subject by ID or code
    const numericSubjId = Number(rawTarget);
    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          { code: rawTarget.toUpperCase() },
          { id: isNaN(numericSubjId) ? -1 : numericSubjId },
        ],
      },
      include: { department: true },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Invalid subject selected.' }, { status: 400 });
    }

    // Department Head scoping
    if (user.role === 'DepartmentHead' && user.departmentId && subject.departmentId !== Number(user.departmentId)) {
      return NextResponse.json({
        error: 'Department Heads may only manage student enrollments in subjects within their assigned department.',
      }, { status: 403 });
    }

    // Check duplicate enrollment
    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_subjectId_semester_academicYear: {
          studentId: student.id,
          subjectId: subject.id,
          semester,
          academicYear,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        error: `Student is already enrolled in ${subject.code} for ${semester}, AY ${academicYear}.`,
      }, { status: 409 });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        subjectId: subject.id,
        semester,
        academicYear,
        section: section || 'A',
        status: status || 'ENROLLED',
      },
      include: {
        student: {
          select: { id: true, idNumber: true, fullName: true, email: true },
        },
        subject: {
          include: { department: true },
        },
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'EnrollStudent',
      resultStatus: 'Success',
      description: `Enrolled student ${student.fullName} (${student.idNumber}) into ${subject.code} (${semester}, AY ${academicYear})`,
      entityType: 'Enrollment',
      entityId: enrollment.id,
    });

    return NextResponse.json({
      success: true,
      enrollment: {
        ...enrollment,
        course: enrollment.subject,
        courseId: enrollment.subjectId,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to enroll student: ' + error.message }, { status: 500 });
  }
}
