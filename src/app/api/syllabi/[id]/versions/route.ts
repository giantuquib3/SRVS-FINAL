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

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    // Role check: Students cannot access version history
    if (user.role === 'Student') {
      return NextResponse.json({ error: 'Students cannot view version history.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== syllabus.departmentId) {
      return NextResponse.json({ error: 'Access restricted to assigned department syllabi.' }, { status: 403 });
    }

    const versions = await prisma.syllabusVersion.findMany({
      where: { syllabusId: numericId },
      orderBy: { versionNumber: 'desc' },
      include: {
        editor: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    const formattedSyllabus = {
      ...syllabus,
      course: syllabus.subject,
      courseId: syllabus.subjectId,
    };

    return NextResponse.json({ syllabus: formattedSyllabus, versions });
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    return NextResponse.json({ error: 'Failed to retrieve version history.' }, { status: 500 });
  }
}
