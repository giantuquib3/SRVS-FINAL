import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may review syllabi.' }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include: {
        syllabus: {
          include: {
            course: true,
            instructor: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include: {
          syllabus: {
            include: {
              course: true,
              instructor: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus approval request not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead') {
      if (!user.departmentId || String(user.departmentId).toUpperCase() !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to view this approval.' }, { status: 403 });
      }
    }

    const previousApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: version.syllabusId, approvalStatus: 'APPROVED', versionNumber: { lt: version.versionNumber } },
      orderBy: { versionNumber: 'desc' },
    });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isSelfSubmission = currentUserIdInt === version.submittedById || currentUserIdInt === version.syllabus.instructorId;
    const sDept = version.syllabus.departmentId;

    const formatted = {
      ...version,
      syllabus: {
        ...version.syllabus,
        course: {
          ...version.syllabus.course,
          department: {
            id: version.syllabus.course.departmentId,
            code: version.syllabus.course.departmentId,
            name: getDepartmentName(version.syllabus.course.departmentId),
          },
        },
        subject: version.syllabus.course,
        courseId: version.syllabus.courseId,
        subjectId: version.syllabus.courseId,
        department: { id: sDept, code: sDept, name: getDepartmentName(sDept) },
      },
    };

    return NextResponse.json({ approval: formatted, version: formatted, syllabus: formatted.syllabus, previousApprovedVersion, isSelfSubmission });
  } catch (error: any) {
    console.error('Error fetching approval detail:', error);
    return NextResponse.json({ error: 'Failed to retrieve approval detail: ' + error.message }, { status: 500 });
  }
}
