import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may approve syllabi.' }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    let comments = '';
    try { const body = await req.json(); comments = body?.comments || ''; } catch { /* optional */ }

    // Try to find as SyllabusVersion id first, then as Syllabus id
    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include: { syllabus: { include: { course: true, instructor: true } } },
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include: { syllabus: { include: { course: true, instructor: true } } },
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || deptCode !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({ error: 'Forbidden: You may only approve syllabi in your department.' }, { status: 403 });
      }
    }

    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: `Cannot approve: Version is in '${version.approvalStatus}' status.` }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const currentUserIdInt = parseInt(user.id, 10) || 0;

    const result = await prisma.$transaction(async (tx) => {
      await tx.syllabus.updateMany({
        where: { courseId: syllabus.courseId, id: { not: syllabus.id }, status: { in: ['ACTIVE', 'Active', 'Approved', 'APPROVED'] } },
        data: { status: 'ARCHIVED' },
      });

      const approvedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: { approvalStatus: 'APPROVED', statusAtSave: 'APPROVED', reviewedById: currentUserIdInt, reviewedAt: now, rejectionReason: null },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: { currentVersionNumber: version.versionNumber, status: 'ACTIVE', reviewedAt: now, reviewedByUserId: currentUserIdInt, reviewerRemarks: comments.trim() || 'Approved' },
      });

      return { approvedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'ApproveSyllabusVersion',
      resultStatus: 'Success',
      description: `Approved [${syllabus.course.code}] v${version.versionNumber} for ${syllabus.semester}, AY ${syllabus.academicYear}`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(syllabus.instructorId),
      `Syllabus Approved: ${syllabus.course.code}`,
      `Your ${syllabus.course.code} syllabus v${version.versionNumber} has been approved by ${user.fullName}. It is now active.`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.course.code} v${version.versionNumber} approved and is now the active version.`,
      version: result.approvedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error approving syllabus version:', error);
    return NextResponse.json({ error: 'Failed to approve syllabus: ' + error.message }, { status: 500 });
  }
}
