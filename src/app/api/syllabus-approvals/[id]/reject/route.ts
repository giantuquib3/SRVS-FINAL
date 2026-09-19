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
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may review syllabi.' }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    const { rejectionReason } = await req.json();

    if (!rejectionReason?.trim()) {
      return NextResponse.json({ error: 'A rejection reason is required to provide actionable feedback to the educator.' }, { status: 400 });
    }

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
        return NextResponse.json({ error: 'Forbidden: You may only review syllabi in your department.' }, { status: 403 });
      }
    }

    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: `Cannot reject: Version is in '${version.approvalStatus}' status.` }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const currentUserIdInt = parseInt(user.id, 10) || 0;

    const hasPriorApproved = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: syllabus.id, approvalStatus: 'APPROVED' },
    });

    const result = await prisma.$transaction(async (tx) => {
      const rejectedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: { approvalStatus: 'REJECTED', statusAtSave: 'REJECTED', rejectionReason: rejectionReason.trim(), reviewedById: currentUserIdInt, reviewedAt: now },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: { status: hasPriorApproved ? 'ACTIVE' : 'REJECTED', reviewedAt: now, reviewedByUserId: currentUserIdInt, reviewerRemarks: `Rejected: ${rejectionReason.trim()}` },
      });

      return { rejectedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'RejectSyllabusVersion',
      resultStatus: 'Success',
      description: `Returned for revision: [${syllabus.course.code}] v${version.versionNumber}. Reason: ${rejectionReason.trim()}`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(syllabus.instructorId),
      `Syllabus Returned for Revision: ${syllabus.course.code}`,
      `Your ${syllabus.course.code} syllabus v${version.versionNumber} has been returned by ${user.fullName}. Remarks: "${rejectionReason.trim()}". Please revise and resubmit.`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.course.code} v${version.versionNumber} rejected with feedback sent to instructor.`,
      version: result.rejectedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error rejecting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to reject syllabus: ' + error.message }, { status: 500 });
  }
}
