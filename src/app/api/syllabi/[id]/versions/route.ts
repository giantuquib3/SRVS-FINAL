import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';
import { extractReviewComments } from '@/lib/syllabus-template';
import { getFacultyEditPermissionForSyllabus } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role === 'Student') {
      return NextResponse.json({ error: 'Students cannot view version history.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: {
        subject: true,
        department: true,
        instructor: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (
      (user.role === 'DepartmentHead' || user.role === 'Educator' || user.role === 'Faculty') &&
      (!userDeptCode || userDeptCode !== syllabus.departmentId.toUpperCase())
    ) {
      return NextResponse.json({ error: 'Access restricted to your assigned department syllabi.' }, { status: 403 });
    }

    const versions = await prisma.syllabusVersion.findMany({
      where: { syllabusId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        editor: { select: { id: true, fullName: true, email: true, role: true } },
        submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    const deptCode = syllabus.departmentId;
    const deptName = syllabus.department?.name || getDepartmentName(deptCode);
    const formattedSyllabus = {
      ...syllabus,
      subject: syllabus.subject,
      course: syllabus.subject,
      subjectId: syllabus.subjectId,
      courseId: syllabus.subjectId,
      department: { id: deptCode, code: deptCode, name: deptName },
    };

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    let canEdit = false;
    let editPermissionStatus = 'READ_ONLY';
    if (user.role === 'DepartmentHead' && userDeptCode === deptCode.toUpperCase()) {
      canEdit = true;
      editPermissionStatus = 'DIRECT_ACCESS';
    } else if ((user.role === 'Educator' || user.role === 'Faculty') && userDeptCode === deptCode.toUpperCase()) {
      const perm = await getFacultyEditPermissionForSyllabus(syllabusId, currentUserIdInt);
      canEdit = perm.hasPermission;
      editPermissionStatus = perm.status;
    }

    const enrichedVersions = versions.map((v: any) => ({
      ...v,
      subjectId: syllabus.subjectId,
      reviewComments: extractReviewComments(v),
    }));

    return NextResponse.json({
      syllabus: formattedSyllabus,
      versions: enrichedVersions,
      canEdit,
      editPermissionStatus,
    });
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    return NextResponse.json({ error: 'Failed to retrieve version history.' }, { status: 500 });
  }
}
