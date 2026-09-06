import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const courses = await prisma.course.findMany({
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

    return NextResponse.json({ courses });
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

    const { code, title, departmentId, description } = await req.json();

    // 3. Validate input
    if (!code || !title || !departmentId) {
      return NextResponse.json({ error: 'Course code, title, and department are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    // If DepartmentHead, can only create for their own department unless Admin
    if (user.role === 'DepartmentHead' && user.departmentId && user.departmentId !== departmentId) {
      return NextResponse.json({ error: 'Department Heads may only manage courses within their assigned department.' }, { status: 403 });
    }

    // 4. Verify that the course code does not already exist
    const existing = await prisma.course.findUnique({
      where: { code: upperCode },
    });

    if (existing) {
      return NextResponse.json({ error: `A course with code "${upperCode}" already exists.` }, { status: 409 });
    }

    // 5. Save the course in PostgreSQL
    const course = await prisma.course.create({
      data: {
        id: upperCode, // Primary key is Course Code (CPE101, CE101, etc.)
        code: upperCode,
        title: title.trim(),
        departmentId,
        description: description?.trim() || null,
      },
      include: {
        department: true,
      },
    });

    // 6. Create an audit log
    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateCourse',
      resultStatus: 'Success',
      description: `Created course [${course.code}] ${course.title} under department ${course.department.name}`,
      entityType: 'Course',
      entityId: course.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    // 7. Return the created course
    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating course:', error);
    return NextResponse.json({ error: 'Failed to create course.' }, { status: 500 });
  }
}
