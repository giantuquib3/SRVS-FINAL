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

    const students = await prisma.user.findMany({
      where: {
        role: 'Student',
        accountStatus: 'Active',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students.' }, { status: 500 });
  }
}
