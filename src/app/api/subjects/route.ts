import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// /api/subjects is an alias for /api/courses using the Course model
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');
    const yearLevel = searchParams.get('yearLevel');
    const semester = searchParams.get('semester');

    const where: any = {};

    if (user?.role === 'Student') {
      const studentDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!studentDept) return NextResponse.json({ subjects: [] });
      where.departmentId = studentDept;
    } else if (user?.role === 'DepartmentHead') {
      if (user.departmentId) where.departmentId = String(user.departmentId).trim().toUpperCase();
    } else if (departmentId) {
      where.departmentId = String(departmentId).trim().toUpperCase();
    }

    if (yearLevel) where.yearLevel = yearLevel;
    if (semester) where.semester = semester;

    const courseIdParam = searchParams.get('courseId') || searchParams.get('subjectId') || searchParams.get('id');
    if (courseIdParam) {
      const parsedId = parseInt(courseIdParam, 10);
      if (!isNaN(parsedId)) {
        where.id = parsedId;
      } else {
        where.code = courseIdParam.trim().toUpperCase();
      }
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        syllabi: {
          where: { status: { in: ['Approved', 'APPROVED'] } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, academicYear: true, semester: true, currentVersionNumber: true },
        },
      },
    });

    // Get enrolled course codes for students
    let enrolledCodes: string[] = [];
    if (user?.role === 'Student') {
      const studentIntId = parseInt(user.id, 10);
      if (!isNaN(studentIntId)) {
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: studentIntId, status: 'ENROLLED' },
          include: { course: { select: { code: true } } },
        });
        enrolledCodes = enrollments.map((e) => (e.course?.code || e.courseId).toUpperCase());
      }
    }

    const formatted = courses.map((c) => {
      const deptCode = String(c.departmentId || '');
      return {
        ...c,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        isEnrolled: user?.role === 'Student' ? enrolledCodes.includes(c.code.toUpperCase()) : true,
      };
    });

    return NextResponse.json({ subjects: formatted, courses: formatted });
  } catch (error: any) {
    console.error('Error fetching subjects/courses:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators can add courses.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      code, title, description,
      units = 3, lecHours = 3, labHours = 0,
      prerequisite = 'None', yearLevel = '1st Year', semester = '1st Semester',
      departmentId,
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: 'Course code and title are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const deptCode = departmentId
      ? String(departmentId).trim().toUpperCase()
      : user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (!deptCode || !isValidDepartmentCode(deptCode)) {
      return NextResponse.json({ error: 'A valid department is required.' }, { status: 400 });
    }

    const existing = await prisma.course.findUnique({ where: { code: upperCode } });
    if (existing) {
      return NextResponse.json({ error: `Course with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const course = await prisma.course.create({
      data: {
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: Number(units) || 3,
        lecHours: Number(lecHours) || 3,
        labHours: Number(labHours) || 0,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId: deptCode,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateCourse',
      resultStatus: 'Success',
      description: `Created course [${upperCode}] ${title.trim()} (Dept: ${deptCode})`,
      entityType: 'Course',
      entityId: String(course.id),
    });

    return NextResponse.json({
      success: true,
      subject: { ...course, department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) } },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subject/course:', error);
    return NextResponse.json({ error: 'Failed to create subject: ' + error.message }, { status: 500 });
  }
}
