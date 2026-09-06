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

    let deptCode: string | undefined = undefined;
    if (user.role === 'DepartmentHead' && user.departmentId) {
      const d = await prisma.department.findUnique({ where: { id: Number(user.departmentId) } });
      if (d) deptCode = d.code;
    }

    const rawStudents = await prisma.student.findMany({
      where: deptCode ? { department: deptCode } : {},
      include: {
        departmentRel: {
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
      studentTableId: s.id,
      idNumber: s.studentIdNumber,
      fullName: s.fullName,
      email: s.email,
      department: s.department, // "CPE", "CE", etc. (Not an ID or number)
      departmentDetails: s.departmentRel,
      enrolledSubjects: s.enrolledSubjects || 'None', // Codes only (e.g. "CPE101, CPE201")
      yearLevel: s.yearLevel,
    }));

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students.' }, { status: 500 });
  }
}
