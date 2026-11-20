import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS, isDeptHeadSubmission, PROPOSAL_VERSION_OFFSET } from '@/lib/status';
import { completeFacultyEditPermission } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Deans may approve proposed syllabus versions.',
      }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    let comments = '';
    try {
      const body = await req.json();
      comments = body?.comments || body?.remarks || '';
    } catch {
      /* optional */
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

    // Rule 1: Self-approval strictly prohibited for both Faculty and Department Heads
    if (version.editorId === currentUserIdInt || version.submittedById === currentUserIdInt) {
      return NextResponse.json({
        error: 'Forbidden: You cannot approve your own proposed syllabus changes.',
      }, { status: 403 });
    }

    // Rule 2: Must be pending review
    if (
      version.approvalStatus !== SYLLABUS_STATUS.SUBMITTED &&
      version.approvalStatus !== SYLLABUS_STATUS.UNDER_REVIEW
    ) {
      return NextResponse.json({
        error: `Cannot approve: Version ${version.versionNumber} is currently in '${version.approvalStatus}' status.`,
      }, { status: 400 });
    }

    // Rule 3: Strict Dual-Workflow Authority
    // - Department Head edits (UNDER_REVIEW or edited by Dept Head) -> ONLY Dean can approve!
    // - Faculty edits (SUBMITTED) -> ONLY corresponding Department Head can approve!
    const deptHeadSub = isDeptHeadSubmission(version);
    if (deptHeadSub) {
      if (user.role !== 'Dean') {
        return NextResponse.json({
          error: 'Forbidden: Department Heads cannot approve their own or peer Department Head changes. Only the authorized Dean role can approve Department Head changes.',
        }, { status: 403 });
      }
    } else {
      if (user.role !== 'DepartmentHead') {
        return NextResponse.json({
          error: 'Forbidden: Faculty syllabus changes must be reviewed and approved by the corresponding Department Head.',
        }, { status: 403 });
      }
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || deptCode !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({
          error: 'Forbidden: Department Heads may only manage and approve syllabi within their assigned department.',
        }, { status: 403 });
      }
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const cleanComments = comments.trim();

    // Once approved, automatically generate the next sequential official version (e.g., Version 2, Version 3...)
    // while preserving all previous official versions and rejected proposals in history!
    const result = await prisma.$transaction(async (tx: any) => {
      const existingApproved = await tx.syllabusVersion.findMany({
        where: {
          syllabusId: syllabus.id,
          approvalStatus: SYLLABUS_STATUS.APPROVED,
          versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
          id: { not: version!.id },
        },
        select: { versionNumber: true },
      });
      const maxApproved = existingApproved.reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
      const nextOfficialVersion = maxApproved + 1;

      const defaultRemarks =
        cleanComments ||
        `Approved by ${user.role === 'Dean' ? 'Dean' : 'Department Head'} (${user.fullName}) — Official Version ${nextOfficialVersion}`;

      const updatedContent: any = {
        ...(version!.content && typeof version!.content === 'object' ? (version!.content as any) : {}),
        _reviewMeta: {
          reviewComments: defaultRemarks,
          reviewerName: user.fullName,
          reviewerRole: user.role,
          reviewedAt: now.toISOString(),
        },
      };
      delete updatedContent._proposalMeta;

      const approvedVersion = await tx.syllabusVersion.update({
        where: { id: version!.id },
        data: {
          versionNumber: nextOfficialVersion,
          approvalStatus: SYLLABUS_STATUS.APPROVED,
          statusAtSave: SYLLABUS_STATUS.APPROVED,
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          rejectionReason: null,
          content: updatedContent,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          currentVersionNumber: nextOfficialVersion,
          status: SYLLABUS_STATUS.APPROVED,
          reviewedAt: now,
          reviewedByUserId: currentUserIdInt,
          reviewerRemarks: defaultRemarks,
        },
      });

      return { approvedVersion, updatedSyllabus, nextOfficialVersion };
    });

    const newVerNum = result.nextOfficialVersion;

    // Close the Faculty edit permission cycle now that their approved revision generated the new official version
    if (!deptHeadSub) {
      await completeFacultyEditPermission(syllabus.id, version.editorId);
    }

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'ApproveSyllabusVersion',
      resultStatus: 'Success',
      description: `Approved [${syllabus.subject.code}] and automatically generated official Version ${newVerNum} (${user.role})${
        cleanComments ? ` — Comments: ${cleanComments}` : ''
      }`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(version.editorId),
      `Syllabus Approved — Official Version ${newVerNum}: ${syllabus.subject.code}`,
      `${user.fullName} (${user.role === 'Dean' ? 'Dean' : 'Department Head'}) approved your proposed changes for [${syllabus.subject.code}] ${syllabus.subject.title}. Official Version ${newVerNum} is now active.`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Approved! Official Version ${newVerNum} for [${syllabus.subject.code}] has been automatically generated and is now the current effective syllabus. All previous versions remain in revision history.`,
      version: result.approvedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error approving syllabus version:', error);
    return NextResponse.json({ error: 'Failed to approve syllabus version: ' + error.message }, { status: 500 });
  }
}
