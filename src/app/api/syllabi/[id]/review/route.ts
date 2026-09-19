import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only the Department Head or Administrator may approve or reject syllabi.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { action, remarks } = await req.json();

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { course: true, instructor: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    if (user.role !== 'Admin' && (!user.departmentId || String(user.departmentId).toUpperCase() !== syllabus.departmentId.toUpperCase())) {
      return NextResponse.json({ error: 'Forbidden: Department Heads may only review syllabi for their own department.' }, { status: 403 });
    }

    const targetStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const versionStatus = action === 'Approve' ? 'APPROVED' : 'REJECTED';
    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      if (action === 'Approve') {
        await tx.syllabus.updateMany({
          where: { courseId: syllabus.courseId, id: { not: syllabus.id }, status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } },
          data: { status: 'Archived' },
        });
      }

      const latestVersion = await tx.syllabusVersion.findFirst({
        where: { syllabusId: syllabus.id },
        orderBy: { versionNumber: 'desc' },
      });

      if (latestVersion) {
        await tx.syllabusVersion.update({
          where: { id: latestVersion.id },
          data: { approvalStatus: versionStatus, reviewedById: currentUserIdInt, reviewedAt: now, rejectionReason: action === 'Reject' ? (remarks?.trim() || null) : null },
        });
      }

      return tx.syllabus.update({
        where: { id: syllabusId },
        data: { status: targetStatus, reviewerRemarks: remarks?.trim() || null, reviewedAt: now, reviewedByUserId: currentUserIdInt },
      });
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: action === 'Approve' ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${action}d syllabus for [${syllabus.course.code}] ${syllabus.course.title}${remarks ? ` – "${remarks}"` : ''}`,
      entityType: 'Syllabus',
      entityId: String(syllabus.id),
    });

    await createNotification(
      String(syllabus.instructorId),
      `Syllabus ${targetStatus}: ${syllabus.course.code}`,
      action === 'Approve'
        ? `Your syllabus for ${syllabus.course.code} has been approved and published to students.`
        : `Your syllabus for ${syllabus.course.code} was rejected. Feedback: "${remarks || 'Please revise and resubmit.'}"`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({ success: true, message: `Syllabus successfully ${targetStatus.toLowerCase()}.`, syllabus: updated });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to process syllabus review.' }, { status: 500 });
  }
}
