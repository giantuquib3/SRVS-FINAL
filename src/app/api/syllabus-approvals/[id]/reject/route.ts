import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS, isDeptHeadSubmission, PROPOSAL_VERSION_OFFSET } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Deans may review and reject proposed syllabus versions.',
      }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    const body = await req.json();
    const rejectionReason = String(body?.rejectionReason || body?.remarks || '').trim();

    if (!rejectionReason) {
      return NextResponse.json({
        error: 'Rejection requires a clear reason or review feedback so the author can revise and resubmit.',
      }, { status: 400 });
    }

    const include = {
      editor: { select: { id: true, fullName: true, role: true } },
      submittedBy: { select: { id: true, fullName: true, role: true } },
      syllabus: { include: { subject: true, instructor: true } },
    };

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include,
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include,
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;

    // Rule 1: Cannot reject your own submission
    if (version.editorId === currentUserIdInt || version.submittedById === currentUserIdInt) {
      return NextResponse.json({
        error: 'Forbidden: You cannot review your own proposed syllabus changes.',
      }, { status: 403 });
    }

    // Rule 2: Must be pending review
    if (
      version.approvalStatus !== SYLLABUS_STATUS.SUBMITTED &&
      version.approvalStatus !== SYLLABUS_STATUS.UNDER_REVIEW
    ) {
      return NextResponse.json({
        error: `Cannot reject: Version ${version.versionNumber} is in '${version.approvalStatus}' status.`,
      }, { status: 400 });
    }

    // Rule 3: Strict Dual-Workflow Authority
    const deptHeadSub = isDeptHeadSubmission(version);
    if (deptHeadSub) {
      if (user.role !== 'Dean') {
        return NextResponse.json({
          error: 'Forbidden: Only the authorized Dean role can review syllabus changes proposed by a Department Head.',
        }, { status: 403 });
      }
    } else {
      if (user.role !== 'DepartmentHead') {
        return NextResponse.json({
          error: 'Forbidden: Faculty syllabus submissions must be reviewed by the corresponding Department Head.',
        }, { status: 403 });
      }
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || deptCode !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({
          error: 'Forbidden: Department Heads may only manage syllabi within their assigned department.',
        }, { status: 403 });
      }
    }

    const now = new Date();
    const syllabus = version.syllabus;

    const priorApproved = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: syllabus.id,
        approvalStatus: SYLLABUS_STATUS.APPROVED,
        versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
        id: { not: version.id },
      },
      orderBy: { versionNumber: 'desc' },
    });

    const updatedContent = {
      ...(version.content && typeof version.content === 'object' ? (version.content as any) : {}),
      _reviewMeta: {
        reviewComments: rejectionReason,
        reviewerName: user.fullName,
        reviewerRole: user.role,
        reviewedAt: now.toISOString(),
      },
    };

    // Rejected version remains permanently in history; prior approved version stays effective!
    const result = await prisma.$transaction(async (tx: any) => {
      const rejectedVersion = await tx.syllabusVersion.update({
        where: { id: version!.id },
        data: {
          approvalStatus: SYLLABUS_STATUS.REJECTED,
          statusAtSave: SYLLABUS_STATUS.REJECTED,
          rejectionReason,
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          content: updatedContent,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: priorApproved
          ? {
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: priorApproved.versionNumber,
              reviewedAt: now,
              reviewedByUserId: currentUserIdInt,
            }
          : {
              status: SYLLABUS_STATUS.REJECTED,
              reviewedAt: now,
              reviewedByUserId: currentUserIdInt,
              reviewerRemarks: `Rejected: ${rejectionReason}`,
            },
      });

      return { rejectedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'RejectSyllabusVersion',
      resultStatus: 'Success',
      description: `Returned [${syllabus.subject.code}] v${version.versionNumber} for revision (${user.role}). Reason: ${rejectionReason}`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(version.editorId),
      `Syllabus Revision Returned (v${version.versionNumber}): ${syllabus.subject.code}`,
      `${user.fullName} returned Version ${version.versionNumber} of [${syllabus.subject.code}] ${syllabus.subject.title} for revision. Feedback: "${rejectionReason}"`,
      `/syllabi/${syllabus.id}/edit?fromVersion=${version.versionNumber}`
    );

    return NextResponse.json({
      success: true,
      message: `Version ${version.versionNumber} for [${syllabus.subject.code}] has been rejected with feedback. It remains preserved in history for revision and resubmission.`,
      version: result.rejectedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error rejecting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to reject syllabus version: ' + error.message }, { status: 500 });
  }
}
