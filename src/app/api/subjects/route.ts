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
    const yearLevel = searchParams.get('yearLevel');
    const semester = searchParams.get('semester');

    const where: any = {};

    // Department Head can only view subjects in their department
    if (user?.role === 'DepartmentHead') {
      where.departmentId = user.departmentId || '__NO_DEPT__';
    } else if (departmentId) {
      where.departmentId = departmentId;
    }

    if (yearLevel) where.yearLevel = yearLevel;
    if (semester) where.semester = semester;

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
          where: {
            status: { in: ['Approved', 'ACTIVE'] },
          },
          select: {
            id: true,
            status: true,
            academicYear: true,
            semester: true,
            currentVersionNumber: true,
            uploadedByUserId: true,
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

    return NextResponse.json({ subjects });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects.' }, { status: 500 });
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

    // Validate required fields
    if (!code || !title || !departmentId) {
      return NextResponse.json({ error: 'Subject code, title, and department are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    // Dept head scoping
    if (user.role === 'DepartmentHead' && user.departmentId && user.departmentId !== departmentId) {
      return NextResponse.json({ error: 'Department Heads may only manage subjects within their assigned department.' }, { status: 403 });
    }

    // Check duplicate
    const existing = await prisma.subject.findUnique({
      where: { code: upperCode },
    });

    if (existing) {
      return NextResponse.json({ error: `A subject with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const parsedUnits = Number(units) || 3;
    const parsedLecHours = Number(lecHours) || 3;
    const parsedLabHours = Number(labHours) || 0;

    // Create subject record in srvs_subjects
    const subject = await prisma.subject.create({
      data: {
        id: upperCode,
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: parsedUnits,
        lecHours: parsedLecHours,
        labHours: parsedLabHours,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId,
      },
      include: {
        department: true,
      },
    });

    // Mirror in Course table for seamless cross-compatibility
    await prisma.course.upsert({
      where: { code: upperCode },
      update: {
        title: title.trim(),
        description: description?.trim() || null,
        units: parsedUnits,
        lecHours: parsedLecHours,
        labHours: parsedLabHours,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId,
      },
      create: {
        id: upperCode,
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: parsedUnits,
        lecHours: parsedLecHours,
        labHours: parsedLabHours,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateSubject',
      resultStatus: 'Success',
      description: `Created academic subject ${upperCode} - ${title.trim()} (${parsedUnits} Units, Lec: ${parsedLecHours}h, Lab: ${parsedLabHours}h)`,
      entityType: 'Subject',
      entityId: subject.id,
    });

    return NextResponse.json({ success: true, subject }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject: ' + error.message }, { status: 500 });
  }
}
