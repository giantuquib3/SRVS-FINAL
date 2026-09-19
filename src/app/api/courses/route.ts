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

    const where: any = {};

    if (user?.role === 'Student') {
      const studentDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!studentDept) return NextResponse.json({ courses: [], subjects: [] });
      where.departmentId = studentDept;
    } else if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ courses: [], subjects: [] });
      where.departmentId = deptCode;
    } else if (user?.role === 'Educator') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
    } else if (departmentId) {
      where.departmentId = String(departmentId).trim().toUpperCase();
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get enrolled course codes for students
    let enrolledCodes: string[] = [];
    if (user?.role === 'Student') {
      const studentIntId = parseInt(user.id, 10);
      const enrollments = !isNaN(studentIntId)
        ? await prisma.enrollment.findMany({
            where: { studentId: studentIntId, status: 'ENROLLED' },
            select: { course: { select: { code: true } } },
          })
        : [];
      enrolledCodes = enrollments.map((e) => e.course.code.toUpperCase());
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        syllabi: {
          where: user?.role === 'Student' ? { status: { in: ['Approved', 'APPROVED'] } } : undefined,
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
        faculty: { select: { id: true, fullName: true } },
        _count: { select: { syllabi: true } },
      },
    });

    const formatted = courses.map((c) => {
      const deptCode = String(c.departmentId || '');
      const isEnrolled = user?.role === 'Student' ? enrolledCodes.includes(c.code.toUpperCase()) : true;
      const uploadedFacultyName = c.facultyName || c.faculty?.fullName || c.syllabi?.[0]?.instructor?.fullName || null;
      return {
        ...c,
        facultyName: uploadedFacultyName,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        isEnrolled,
        syllabi: user?.role === 'Student' && !isEnrolled ? [] : c.syllabi,
      };
    });

    return NextResponse.json({ courses: formatted, subjects: formatted });
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses.' }, { status: 500 });
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
      facultyName, facultyId,
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

    const parsedFacultyId = facultyId ? parseInt(String(facultyId), 10) : null;
    let validFacultyId: number | null = null;
    if (parsedFacultyId !== null && !isNaN(parsedFacultyId)) {
      const facultyUser = await prisma.user.findUnique({ where: { id: parsedFacultyId } });
      if (facultyUser) validFacultyId = parsedFacultyId;
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
        facultyName: facultyName?.trim() || null,
        facultyId: validFacultyId,
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
      course: { ...course, department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) } },
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
    const rawCourseId = (searchParams.get('id') || searchParams.get('courseId') || '').trim();
    if (!rawCourseId) return NextResponse.json({ error: 'Course ID is required.' }, { status: 400 });

    const parsedCourseId = !isNaN(parseInt(rawCourseId, 10)) ? parseInt(rawCourseId, 10) : null;
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          ...(parsedCourseId !== null ? [{ id: parsedCourseId }] : []),
          { code: rawCourseId.toUpperCase() },
        ],
      },
    });
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

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

    return NextResponse.json({ success: true, message: `Course ${course.code} deleted.` });
  } catch (error: any) {
    console.error('Error deleting course:', error);
    return NextResponse.json({ error: 'Failed to delete course.' }, { status: 500 });
  }
}
