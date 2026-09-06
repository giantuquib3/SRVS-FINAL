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

    if (user?.role === 'DepartmentHead') {
      if (user.departmentId) {
        where.departmentId = Number(user.departmentId);
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

    return NextResponse.json({ courses: subjects, subjects });
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
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

    if (!code || !title || !departmentId) {
      return NextResponse.json({ error: 'Course code, title, and department are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    // Resolve Department
    let targetDept = null;
    const numericDeptId = Number(departmentId);
    if (!isNaN(numericDeptId)) {
      targetDept = await prisma.department.findUnique({ where: { id: numericDeptId } });
    } else {
      targetDept = await prisma.department.findUnique({ where: { code: String(departmentId).trim().toUpperCase() } });
    }

    if (!targetDept) {
      return NextResponse.json({ error: 'Invalid department specified.' }, { status: 400 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== targetDept.id) {
      return NextResponse.json({ error: 'Department Heads may only manage courses within their assigned department.' }, { status: 403 });
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
