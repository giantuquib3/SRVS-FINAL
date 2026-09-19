import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role === 'Student') return NextResponse.json({ error: 'Students cannot view version history.' }, { status: 403 });

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { course: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead' && user.departmentId && String(user.departmentId).toUpperCase() !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json({ error: 'Access restricted to your assigned department syllabi.' }, { status: 403 });
    }

    const versions = await prisma.syllabusVersion.findMany({
      where: { syllabusId },
      orderBy: { versionNumber: 'desc' },
    });

    const formattedSyllabus = {
      ...syllabus,
      course: syllabus.course,
      subject: syllabus.course,
      courseId: syllabus.courseId,
      subjectId: syllabus.courseId,
    };

    return NextResponse.json({ syllabus: formattedSyllabus, versions });
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    return NextResponse.json({ error: 'Failed to retrieve version history.' }, { status: 500 });
  }
}
