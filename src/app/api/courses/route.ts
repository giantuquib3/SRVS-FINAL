import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');

    const where: any = {};

    let studentDeptId: number | null = null;
    let enrolledSet = new Set<number>();

    if (user?.role === 'Student') {
      studentDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!studentDeptId) {
        const studentProfile = await prisma.student.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (studentProfile?.departmentRel?.id) {
          studentDeptId = studentProfile.departmentRel.id;
        }
      }

      if (!studentDeptId) {
        return NextResponse.json({ courses: [], subjects: [] });
      }

      where.departmentId = studentDeptId;

      const studentEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: Number(user.id),
          status: 'ENROLLED',
          subject: { departmentId: studentDeptId },
        },
        select: { subjectId: true },
      });
      enrolledSet = new Set(studentEnrollments.map((e) => e.subjectId));
    } else if (user?.role === 'DepartmentHead') {
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

      if (!deptHeadDeptId) {
        return NextResponse.json({ courses: [], subjects: [] });
      }

      // Strictly lock to Department Head's department only
      where.departmentId = deptHeadDeptId;
    } else if (user?.role === 'Educator') {
      let educatorDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!educatorDeptId) {
        const fac = await prisma.faculty.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (fac?.departmentRel?.id) {
          educatorDeptId = fac.departmentRel.id;
        } else if (fac?.department) {
          const d = await prisma.department.findUnique({ where: { code: fac.department } });
          if (d) educatorDeptId = d.id;
        }
      }

      if (educatorDeptId) {
        where.departmentId = educatorDeptId;
      }
    } else if (departmentId) {
      const parsedDeptId = Number(departmentId);
      if (!isNaN(parsedDeptId)) {
        where.departmentId = parsedDeptId;
      } else {
        const dept = await prisma.department.findUnique({ where: { code: departmentId } });
        if (dept) where.departmentId = dept.id;
      }
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        syllabi: {
          where: user?.role === 'Student' ? { status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } } : undefined,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            status: true,
            academicYear: true,
            semester: true,
            currentVersionNumber: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            syllabi: true,
          },
        },
      },
    });

    const formattedSubjects = subjects.map((s) => {
      const isEnrolled = enrolledSet.has(s.id);
      return {
        ...s,
        isEnrolled: user?.role === 'Student' ? isEnrolled : true,
        // Students can only access the syllabus if they are actively enrolled in this subject
        syllabi: user?.role === 'Student' && !isEnrolled ? [] : s.syllabi,
      };
    });

    return NextResponse.json({ courses: formattedSubjects, subjects: formattedSubjects });
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads can add courses. System Administrators cannot add courses.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      title,
      departmentId,
      description,
      units = 3,
      lecHours = 3,
      labHours = 0,
      prerequisite = 'None',
      yearLevel = '1st Year',
      semester = '1st Semester',
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: 'Course code and title are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    // Automatically resolve Department from Department Head profile
    let targetDept = null;
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
      targetDept = await prisma.department.findUnique({ where: { id: deptHeadDeptId } });
    }

    if (!targetDept) {
      return NextResponse.json({ error: 'Your account is not assigned to a valid academic department.' }, { status: 403 });
    }

    const existing = await prisma.subject.findUnique({
      where: { code: upperCode },
    });

    if (existing) {
      return NextResponse.json({ error: `Course with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const parsedUnits = Number(units) || 3;
    const parsedLecHours = Number(lecHours) || 3;
    const parsedLabHours = Number(labHours) || 0;

    const course = await prisma.subject.create({
      data: {
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: parsedUnits,
        lecHours: parsedLecHours,
        labHours: parsedLabHours,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId: targetDept.id,
      },
      include: {
        department: true,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateCourse',
      resultStatus: 'Success',
      description: `Created academic subject/course ${upperCode} - ${title.trim()} (${parsedUnits} Units)`,
      entityType: 'Subject',
      entityId: course.id,
    });

    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating course:', error);
    return NextResponse.json({ error: 'Failed to create course: ' + error.message }, { status: 500 });
  }
}
