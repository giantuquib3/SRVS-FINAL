import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS, isDeptHeadSubmission, PROPOSAL_VERSION_OFFSET } from '@/lib/status';
import { completeFacultyEditPermission } from '@/lib/edit-permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Deans may approve or reject proposed syllabus changes.',
      }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { action, remarks, versionId } = await req.json();

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    if (action === 'Reject' && !String(remarks || '').trim()) {
      return NextResponse.json({ error: 'Rejection requires a reason or review feedback.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true, instructor: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    // Resolve target pending version
    const version = versionId
      ? await prisma.syllabusVersion.findUnique({
          where: { id: Number(versionId) },
          include: {
            editor: { select: { id: true, fullName: true, role: true } },
            submittedBy: { select: { id: true, fullName: true, role: true } },
          },
        })
      : await prisma.syllabusVersion.findFirst({
          where: {
            syllabusId,
            approvalStatus: {
              in: user.role === 'Dean' ? [SYLLABUS_STATUS.UNDER_REVIEW] : [SYLLABUS_STATUS.SUBMITTED],
            },
          },
          orderBy: { versionNumber: 'desc' },
          include: {
            editor: { select: { id: true, fullName: true, role: true } },
            submittedBy: { select: { id: true, fullName: true, role: true } },
          },
        });

    if (!version) {
      return NextResponse.json({ error: 'No pending syllabus version found for your review.' }, { status: 404 });
    }

    const currentUserIdInt = parseInt(user.id, 10) || 0;

    // Self-approval strictly forbidden
    if (version.editorId === currentUserIdInt || version.submittedById === currentUserIdInt) {
      return NextResponse.json({
        error: 'Forbidden: You cannot approve or reject your own proposed syllabus changes.',
      }, { status: 403 });
    }

    const deptHeadSub = isDeptHeadSubmission(version);
    if (deptHeadSub && user.role !== 'Dean') {
      return NextResponse.json({
        error: 'Forbidden: Only the authorized Dean role can approve Department Head syllabus changes.',
      }, { status: 403 });
    }
    if (!deptHeadSub && user.role !== 'DepartmentHead') {
      return NextResponse.json({
        error: 'Forbidden: Faculty syllabus submissions must be reviewed by the corresponding Department Head.',
      }, { status: 403 });
    }
    if (
      user.role === 'DepartmentHead' &&
      (!user.departmentId || String(user.departmentId).toUpperCase() !== syllabus.departmentId.toUpperCase())
    ) {
      return NextResponse.json({
        error: 'Forbidden: Department Heads may only manage syllabi within their assigned department.',
      }, { status: 403 });
    }

    const isApprove = action === 'Approve';
    const targetStatus = isApprove ? SYLLABUS_STATUS.APPROVED : SYLLABUS_STATUS.REJECTED;
    const now = new Date();
    const cleanRemarks = String(remarks || '').trim();
    const defaultRemarks =
      cleanRemarks ||
      (isApprove
        ? `Approved by ${user.role === 'Dean' ? 'Dean' : 'Department Head'} (${user.fullName})`
        : cleanRemarks);

    const priorApproved = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId,
        approvalStatus: SYLLABUS_STATUS.APPROVED,
        versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
        id: { not: version.id },
      },
      orderBy: { versionNumber: 'desc' },
    });

    const updatedContent = {
      ...(version.content && typeof version.content === 'object' ? (version.content as any) : {}),
      _reviewMeta: {
        reviewComments: defaultRemarks,
        reviewerName: user.fullName,
        reviewerRole: user.role,
        reviewedAt: now.toISOString(),
      },
    };

    const result = await prisma.$transaction(async (tx: any) => {
      let officialVersionNum = version.versionNumber;
      if (isApprove) {
        const existingApproved = await tx.syllabusVersion.findMany({
          where: {
            syllabusId,
            approvalStatus: SYLLABUS_STATUS.APPROVED,
            versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
            id: { not: version.id },
          },
          select: { versionNumber: true },
        });
        const maxApproved = existingApproved.reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
        officialVersionNum = maxApproved + 1;
        delete (updatedContent as any)._proposalMeta;
      }

      await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          ...(isApprove ? { versionNumber: officialVersionNum } : {}),
          approvalStatus: targetStatus,
          statusAtSave: targetStatus,
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          rejectionReason: isApprove ? null : cleanRemarks,
          content: updatedContent,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabusId },
        data: isApprove
          ? {
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: officialVersionNum,
              reviewerRemarks: defaultRemarks,
              reviewedAt: now,
              reviewedByUserId: currentUserIdInt,
            }
          : priorApproved
          ? {
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: priorApproved.versionNumber,
              reviewedAt: now,
              reviewedByUserId: currentUserIdInt,
            }
          : {
              status: SYLLABUS_STATUS.REJECTED,
              reviewerRemarks: defaultRemarks,
              reviewedAt: now,
              reviewedByUserId: currentUserIdInt,
            },
      });

      return { updatedSyllabus, officialVersionNum };
    });

    const updated = result.updatedSyllabus;
    const promotedVersionNum = result.officialVersionNum;

    if (isApprove && !deptHeadSub) {
      await completeFacultyEditPermission(syllabus.id, version.editorId);
    }

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: isApprove ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${isApprove ? `Approved & generated Version ${promotedVersionNum}` : 'Rejected'} [${syllabus.subject.code}] (${user.role})${
        cleanRemarks ? ` — Remarks: ${cleanRemarks}` : ''
      }`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(version.editorId),
      isApprove
        ? `Syllabus Approved — Official Version ${promotedVersionNum}: ${syllabus.subject.code}`
        : `Syllabus Returned for Revision: ${syllabus.subject.code}`,
      isApprove
        ? `${user.fullName} approved your proposed changes for [${syllabus.subject.code}] ${syllabus.subject.title}. Official Version ${promotedVersionNum} is now active.`
        : `${user.fullName} returned your proposed changes for [${syllabus.subject.code}] for revision. Feedback: "${cleanRemarks}"`,
      isApprove ? `/syllabi/${syllabus.id}` : `/syllabi/${syllabus.id}/edit?fromVersion=${version.versionNumber}`
    );

    return NextResponse.json({
      success: true,
      syllabus: updated,
      message: isApprove
        ? `Approved! Official Version ${promotedVersionNum} is now the current effective syllabus.`
        : `Proposed revision returned for revision with feedback.`,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to review syllabus.' }, { status: 500 });
  }
}
