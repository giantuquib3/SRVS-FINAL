import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const where: any = {};
    if (search && search.trim()) {
      where.OR = [
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const departments = await prisma.department.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            subjects: true,
            users: true,
            syllabi: true,
          },
        },
      },
    });

    return NextResponse.json({ departments });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { code, name, description } = await req.json();

    if (!code || !name) {
      return NextResponse.json({ error: 'Department code and name are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    const existing = await prisma.department.findUnique({
      where: { code: upperCode },
    });

    if (existing) {
      return NextResponse.json({ error: 'A department with this code already exists.' }, { status: 409 });
    }

    const department = await prisma.department.create({
      data: {
        code: upperCode,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateDepartment',
      resultStatus: 'Success',
      description: `Created new department: [${department.code}] ${department.name}`,
      entityType: 'Department',
      entityId: department.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({ success: true, department }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'Failed to create department.' }, { status: 500 });
  }
}
