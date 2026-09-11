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
      let studentDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!studentDeptId) {
        const studentProfile = await prisma.student.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (studentProfile?.departmentRel?.id) {
          studentDeptId = studentProfile.departmentRel.id;
        }
      }
      if (studentDeptId) {
        where.subject = { departmentId: studentDeptId };
      }
    } else if (user.role === 'DepartmentHead') {
      let deptHeadDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!deptHeadDeptId) {
        const dh = await prisma.departmentHead.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (dh?.departmentRel?.id) {
          deptHeadDeptId = dh.departmentRel.id;
        } else if (dh?.department) {
          const d = await prisma.department.findUnique({ where: { code: dh.department } });
          if (d) deptHeadDeptId = d.id;
        }
      }
      if (deptHeadDeptId) {
        where.subject = { departmentId: deptHeadDeptId };
      } else {
        return NextResponse.json({ enrollments: [] });
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
            department: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            studentProfile: {
              select: {
                department: true,
                departmentRel: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
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

    const enrollments = rawEnrollments.map((e) => {
      const studentDeptCode =
        e.student.department?.code ||
        e.student.studentProfile?.departmentRel?.code ||
        e.student.studentProfile?.department ||
        null;
      const studentDeptName =
        e.student.department?.name ||
        e.student.studentProfile?.departmentRel?.name ||
        (studentDeptCode ? `${studentDeptCode} Department` : null);

      return {
        ...e,
        course: e.subject,
        courseId: e.subjectId,
        student: {
          ...e.student,
          departmentCode: studentDeptCode,
          departmentName: studentDeptName,
        },
      };
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
    if (user.role === 'DepartmentHead') {
      let deptHeadDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!deptHeadDeptId) {
        const dh = await prisma.departmentHead.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (dh?.departmentRel?.id) {
          deptHeadDeptId = dh.departmentRel.id;
        } else if (dh?.department) {
          const d = await prisma.department.findUnique({ where: { code: dh.department } });
          if (d) deptHeadDeptId = d.id;
        }
      }

      if (!deptHeadDeptId || subject.departmentId !== deptHeadDeptId) {
        return NextResponse.json({
          error: 'Department Heads may only manage student enrollments in subjects within their assigned department.',
        }, { status: 403 });
      }
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

    // Synchronize Student enrolledSubjects with subject codes only
    const allStudentEnrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'ENROLLED' },
      include: { subject: true },
    });
    const subjectCodes = Array.from(new Set(allStudentEnrollments.map((e) => e.subject.code))).join(', ');
    await prisma.student.updateMany({
      where: { userId: student.id },
      data: { enrolledSubjects: subjectCodes },
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
