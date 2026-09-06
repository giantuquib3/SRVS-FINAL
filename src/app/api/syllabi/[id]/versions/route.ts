import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = params;

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    // Role check: Students cannot access version history
    if (user.role === 'Student') {
      return NextResponse.json({ error: 'Students cannot view version history.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId !== syllabus.departmentId) {
      return NextResponse.json({ error: 'Access restricted to assigned department syllabi.' }, { status: 403 });
    }

    const versions = await prisma.syllabusVersion.findMany({
      where: { syllabusId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        editor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ syllabus, versions });
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    return NextResponse.json({ error: 'Failed to retrieve version history.' }, { status: 500 });
  }
}
