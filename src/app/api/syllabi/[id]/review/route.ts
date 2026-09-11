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
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only the Department Head may approve or reject departmental syllabi.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const { action, remarks } = await req.json();

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: true,
        instructor: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    let deptHeadDeptId = user.departmentId ? Number(user.departmentId) : null;
    if (!deptHeadDeptId) {
      const dh = await prisma.departmentHead.findUnique({
        where: { userId: Number(user.id) },
        include: { departmentRel: true },
      });
      if (dh?.departmentRel?.id) {
        deptHeadDeptId = dh.departmentRel.id;
      } else if (dh?.department) {
        const d = await prisma.department.findUnique({ where: { code: dh.department } });
        if (d) deptHeadDeptId = d.id;
      }
    }

    if (!deptHeadDeptId || deptHeadDeptId !== syllabus.departmentId) {
      return NextResponse.json({ error: 'Forbidden: Department Heads may only review syllabi for their own department.' }, { status: 403 });
    }

    const targetStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const versionStatus = action === 'Approve' ? 'APPROVED' : 'REJECTED';
    const currentUserId = Number(user.id);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      if (action === 'Approve') {
        // Archive any other active syllabi for the same subject
        await tx.syllabus.updateMany({
          where: {
            subjectId: syllabus.subjectId,
            id: { not: syllabus.id },
            status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] },
          },
          data: { status: 'Archived' },
        });
      }

      // Update latest version approvalStatus
      const latestVersion = await tx.syllabusVersion.findFirst({
        where: { syllabusId: syllabus.id },
        orderBy: { versionNumber: 'desc' },
      });

      if (latestVersion) {
        await tx.syllabusVersion.update({
          where: { id: latestVersion.id },
          data: {
            approvalStatus: versionStatus,
            reviewedById: currentUserId,
            reviewedAt: now,
            rejectionReason: action === 'Reject' ? (remarks?.trim() || null) : null,
          },
        });
      }

      return tx.syllabus.update({
        where: { id: numericId },
        data: {
          status: targetStatus,
          reviewerRemarks: remarks?.trim() || null,
          reviewedAt: now,
          reviewedByUserId: currentUserId,
        },
      });
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: action === 'Approve' ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${action}d syllabus for [${syllabus.subject.code}] ${syllabus.subject.title}${remarks ? ` with feedback: "${remarks}"` : ''}`,
      entityType: 'Syllabus',
      entityId: syllabus.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    await createNotification(
      syllabus.instructorId,
      `Syllabus ${targetStatus}: ${syllabus.subject.code}`,
      action === 'Approve'
        ? `Your syllabus for ${syllabus.subject.code} has been approved and published to students.`
        : `Your syllabus for ${syllabus.subject.code} was rejected. Feedback: "${remarks || 'Please revise and resubmit.'}"`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus successfully ${targetStatus.toLowerCase()}.`,
      syllabus: updated,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to process syllabus review.' }, { status: 500 });
  }
}
