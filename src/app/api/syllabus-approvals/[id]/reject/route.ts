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

    const { id } = params;
    const { rejectionReason } = await req.json();

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json({
        error: 'A rejection reason is strictly required to provide actionable feedback for the faculty member.',
      }, { status: 400 });
    }

    const version = await prisma.syllabusVersion.findUnique({
      where: { id },
      include: {
        syllabus: {
          include: {
            course: true,
            instructor: true,
            department: true,
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });
    }

    // 1. Department Authorization Check
    if (user.role === 'DepartmentHead' && user.departmentId !== version.syllabus.departmentId) {
      return NextResponse.json({
        error: 'Forbidden: You may only review syllabi belonging to your authorized department.',
      }, { status: 403 });
    }

    // 2. Department Head Teaching Faculty Check
    const isSelfSubmission =
      user.id === version.submittedById ||
      user.id === version.syllabus.instructorId;

    // 3. Status Check
    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({
        error: `Cannot reject: Version is currently in '${version.approvalStatus}' status, not 'PENDING_APPROVAL'.`,
      }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;

    // Check if the syllabus has ANY previously approved version
    const hasPriorApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: syllabus.id,
        approvalStatus: 'APPROVED',
      },
    });

    // 4. Atomic Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Update Syllabus Version to REJECTED
      const rejectedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: 'REJECTED',
          statusAtSave: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
          reviewedById: user.id,
          reviewedAt: now,
        },
      });

      // B. Update Syllabus status
      // IMPORTANT REVISION RULE: If a previous version was approved, keep syllabus status ACTIVE
      // and DO NOT modify currentVersionNumber. If no version was ever approved, set syllabus status to REJECTED.
      const newSyllabusStatus = hasPriorApprovedVersion ? 'ACTIVE' : 'REJECTED';

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: newSyllabusStatus,
          reviewedAt: now,
          reviewedByUserId: user.id,
          reviewerRemarks: rejectionReason.trim(),
        },
      });

      // C. Record in SyllabusApprovalLog
      const approvalLog = await tx.syllabusApprovalLog.create({
        data: {
          syllabusVersionId: version.id,
          reviewerId: user.id,
          decision: 'REJECTED',
          comments: rejectionReason.trim(),
          createdAt: now,
        },
      });

      // D. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'RejectSyllabusVersion',
          resultStatus: 'Success',
          description: `Rejected [${syllabus.course.code}] Version ${version.versionNumber}. Reason: "${rejectionReason.trim()}"`,
          entityType: 'SyllabusVersion',
          entityId: version.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { rejectedVersion, updatedSyllabus, approvalLog };
    });

    // 5. Notify Faculty
    const instructorId = syllabus.instructorId;
    if (instructorId) {
      await createNotification(
        instructorId,
        `Syllabus Revision Required: ${syllabus.course.code}`,
        `Your ${syllabus.course.code} syllabus Version ${version.versionNumber} was rejected by ${user.fullName}. Reason: "${rejectionReason.trim()}". Please revise and resubmit.`,
        `/syllabi/${syllabus.id}/edit`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.course.code} Version ${version.versionNumber} was rejected. Faculty has been notified to revise and resubmit.`,
      version: result.rejectedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error rejecting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to reject syllabus: ' + error.message }, { status: 500 });
  }
}
