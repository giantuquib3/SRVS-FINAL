import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');
    const courseIdParam = searchParams.get('courseId') || searchParams.get('id');
    const courseCodeParam = searchParams.get('courseCode');
    const semester = searchParams.get('semester');
    const yearLevel = searchParams.get('yearLevel');

    const where: any = {};

    // Department Isolation (Requirement 21)
    if (user?.role === 'Student') {
      const studentDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!studentDept) return NextResponse.json({ courses: [] });
      where.departmentId = studentDept;
    } else if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ courses: [] });
      where.departmentId = deptCode;
    } else if (user?.role === 'Educator') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
    } else if (departmentId) {
      where.departmentId = String(departmentId).trim().toUpperCase();
    }

    // courseId: internal database record ID (Requirement 3)
    if (courseIdParam) {
      const parsedId = parseInt(courseIdParam, 10);
      if (!isNaN(parsedId)) {
        where.id = parsedId;
      }
    }

    // courseCode: institutional course code (e.g., CPE101) (Requirement 3)
    if (courseCodeParam) {
      where.code = courseCodeParam.trim().toUpperCase();
    }

    if (semester) where.semester = semester;
    if (yearLevel) where.yearLevel = yearLevel;

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { professorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Enrolled courses for student check
    let enrolledCodes: string[] = [];
    if (user?.role === 'Student') {
      const studentIntId = parseInt(user.id, 10);
      const enrollments = !isNaN(studentIntId)
        ? await prisma.enrollment.findMany({
            where: { studentId: studentIntId, status: 'ENROLLED' },
            select: { course: { select: { code: true } } },
          })
        : [];
      enrolledCodes = enrollments.map((e: any) => e.course.code.toUpperCase());
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        syllabi: {
          where: user?.role === 'Student' ? { status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } } : undefined,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            academicYear: true,
            semester: true,
            currentVersionNumber: true,
            instructor: { select: { id: true, fullName: true } },
          },
        },
        _count: { select: { syllabi: true, enrollments: true } },
      },
    });

    const formatted = courses.map((c: any) => {
      const deptCode = String(c.departmentId || '');
      const isEnrolled = user?.role === 'Student' ? enrolledCodes.includes(c.code.toUpperCase()) : true;
      const assignedProf = c.professorName || c.syllabi?.[0]?.instructor?.fullName || null;
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        units: c.units,
        lecHours: c.lecHours,
        labHours: c.labHours,
        prerequisite: c.prerequisite,
        yearLevel: c.yearLevel,
        semester: c.semester,
        departmentId: deptCode,
        professorName: assignedProf,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        isEnrolled,
        syllabi: user?.role === 'Student' && !isEnrolled ? [] : c.syllabi,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({ courses: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to retrieve courses: ' + error.message }, { status: 500 });
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
      code,
      title,
      description,
      units = 3,
      lecHours = 3,
      labHours = 0,
      prerequisite = 'None',
      yearLevel = '1st Year',
      semester = '1st Semester',
      departmentId,
      professorName,
      facultyName,
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: 'Course code and title are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const deptCode = departmentId
      ? String(departmentId).trim().toUpperCase()
      : user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (!deptCode || !isValidDepartmentCode(deptCode)) {
      return NextResponse.json({ error: 'A valid department code is required (CPE, EE, CE, ECE, IE, ME).' }, { status: 400 });
    }

    // Department Isolation: Department Head can only create courses in their own department
    if (user.role === 'DepartmentHead' && user.departmentId && deptCode !== user.departmentId.toUpperCase()) {
      return NextResponse.json({
        error: `Department Heads may only create courses in their assigned department (${user.departmentId.toUpperCase()}).`,
      }, { status: 403 });
    }

    const existing = await prisma.course.findUnique({ where: { code: upperCode } });
    if (existing) {
      return NextResponse.json({ error: `Course with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const resolvedProfessorName = (professorName || facultyName || '').trim() || null;

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
        professorName: resolvedProfessorName,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateCourse',
      resultStatus: 'Success',
      description: `Created course [${upperCode}] ${title.trim()} (${Number(units)} Units, ${deptCode})`,
      entityType: 'Course',
      entityId: String(course.id),
    });

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        units: course.units,
        lecHours: course.lecHours,
        labHours: course.labHours,
        prerequisite: course.prerequisite,
        yearLevel: course.yearLevel,
        semester: course.semester,
        departmentId: deptCode,
        professorName: resolvedProfessorName,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating course:', error);
    return NextResponse.json({ error: 'Failed to create course: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const courseIdParam = searchParams.get('courseId') || searchParams.get('id');
    const courseCodeParam = searchParams.get('courseCode');

    if (!courseIdParam && !courseCodeParam) {
      return NextResponse.json({ error: 'courseId or courseCode is required.' }, { status: 400 });
    }

    const parsedCourseId = courseIdParam ? parseInt(courseIdParam, 10) : null;
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          ...(parsedCourseId !== null && !isNaN(parsedCourseId) ? [{ id: parsedCourseId }] : []),
          ...(courseCodeParam ? [{ code: courseCodeParam.trim().toUpperCase() }] : []),
        ],
      },
    });

    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

    // Department Isolation: Department Head can only delete courses in their own department
    if (user.role === 'DepartmentHead' && user.departmentId && course.departmentId.toUpperCase() !== user.departmentId.toUpperCase()) {
      return NextResponse.json({
        error: `Department Heads may only delete courses within their assigned department (${user.departmentId.toUpperCase()}).`,
      }, { status: 403 });
    }

    await prisma.course.delete({ where: { id: course.id } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'DeleteCourse',
      resultStatus: 'Success',
      description: `Deleted course [${course.code}] ${course.title}`,
      entityType: 'Course',
      entityId: String(course.id),
    });

    return NextResponse.json({ success: true, message: `Course ${course.code} deleted successfully.` });
  } catch (error: any) {
    console.error('Error deleting course:', error);
    return NextResponse.json({ error: 'Failed to delete course.' }, { status: 500 });
  }
}
