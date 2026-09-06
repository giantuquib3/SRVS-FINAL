import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const deptId = user.role === 'DepartmentHead' && user.departmentId ? Number(user.departmentId) : undefined;

    const rawStudents = await prisma.student.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const students = rawStudents.map((s) => ({
      id: s.userId,
      idNumber: s.studentIdNumber,
      fullName: s.fullName,
      email: s.email,
      department: s.department,
      yearLevel: s.yearLevel,
    }));

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students.' }, { status: 500 });
  }
}
