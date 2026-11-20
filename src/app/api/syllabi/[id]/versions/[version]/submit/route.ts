import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS } from '@/lib/status';
import { getFacultyEditPermissionForSyllabus } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Faculty' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Faculty and Department Heads may submit a syllabus version.',
      }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    const versionNum = parseInt(params.version, 10);

    if (isNaN(syllabusId) || isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid syllabus ID or version number.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (!userDeptCode || syllabus.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({
        error: 'Forbidden: You may only submit syllabus versions within your assigned department.',
      }, { status: 403 });
    }

    if (user.role === 'Educator' || user.role === 'Faculty') {
      const perm = await getFacultyEditPermissionForSyllabus(syllabus.id, currentUserIdInt);
      if (!perm.hasPermission) {
        return NextResponse.json({
          error: 'Edit permission required: You must obtain edit permission from your Department Head before submitting revisions for this syllabus.',
        }, { status: 403 });
      }
    }

    const syllabusVersion = await prisma.syllabusVersion.findUnique({
      where: { syllabusId_versionNumber: { syllabusId, versionNumber: versionNum } },
    });

    if (!syllabusVersion) {
      return NextResponse.json({ error: `Syllabus Version ${versionNum} does not exist.` }, { status: 404 });
    }
    if (syllabusVersion.approvalStatus === SYLLABUS_STATUS.APPROVED) {
      return NextResponse.json({ error: `Version ${versionNum} is already approved.` }, { status: 400 });
    }
    if (
      syllabusVersion.approvalStatus === SYLLABUS_STATUS.SUBMITTED ||
      syllabusVersion.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW
    ) {
      return NextResponse.json({ error: `Version ${versionNum} is already pending review.` }, { status: 400 });
    }

    // Dual approval workflow:
    // - Faculty submits -> SUBMITTED (Pending Department Head Approval)
    // - Department Head submits -> UNDER_REVIEW (Pending Dean Approval — NEVER self-approved)
    const isDeptHead = user.role === 'DepartmentHead';
    const targetStatus = isDeptHead ? SYLLABUS_STATUS.UNDER_REVIEW : SYLLABUS_STATUS.SUBMITTED;
    const now = new Date();

    const priorApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId, approvalStatus: SYLLABUS_STATUS.APPROVED },
      orderBy: { versionNumber: 'desc' },
    });

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedVersion = await tx.syllabusVersion.update({
        where: { id: syllabusVersion.id },
        data: {
          approvalStatus: targetStatus,
          statusAtSave: targetStatus,
          submittedById: currentUserIdInt,
          submittedAt: now,
          rejectionReason: null,
        },
      });
      // Do NOT replace the currently approved syllabus until approval is granted!
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabusId },
        data: priorApprovedVersion
          ? {
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: priorApprovedVersion.versionNumber,
              submittedAt: now,
            }
          : {
              status: targetStatus,
              currentVersionNumber: versionNum,
              submittedAt: now,
            },
      });
      return { updatedVersion, updatedSyllabus };
    });

    let body: any = {};
    try { body = await req.json(); } catch { /* optional */ }
    const remarksSummary = body?.remarks ? ` – Remarks: "${body.remarks}"` : '';

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabusVersion',
      resultStatus: 'Success',
      description: `Submitted syllabus [${syllabus.subject.code}] Version ${versionNum} (${targetStatus})${remarksSummary}`,
      entityType: 'SyllabusVersion',
      entityId: String(syllabusVersion.id),
    });

    if (isDeptHead) {
      const deans = await prisma.user.findMany({
        where: { role: 'Dean', accountStatus: 'Active' },
        select: { id: true },
      });
      for (const dean of deans) {
        await createNotification(
          String(dean.id),
          `Dept. Head Syllabus Submission: ${syllabus.subject.code}`,
          `Department Head ${user.fullName} submitted ${syllabus.subject.code} (${syllabus.subject.title}) v${versionNum} for Dean approval.`,
          `/department/syllabus-approvals/${syllabusVersion.id}`
        );
      }
    } else {
      const deptHeads = await prisma.user.findMany({
        where: { role: 'DepartmentHead', departmentId: syllabus.departmentId, accountStatus: 'Active' },
        select: { id: true },
      });
      for (const dh of deptHeads) {
        await createNotification(
          String(dh.id),
          `Faculty Syllabus Submission: ${syllabus.subject.code}`,
          `Faculty ${user.fullName} submitted ${syllabus.subject.code} (${syllabus.subject.title}) v${versionNum} for Department Head approval.`,
          `/department/syllabus-approvals/${syllabusVersion.id}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: isDeptHead
        ? `Version ${versionNum} for ${syllabus.subject.code} submitted for Dean approval.`
        : `Version ${versionNum} for ${syllabus.subject.code} submitted for Department Head approval.`,
      version: result.updatedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error submitting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to submit syllabus version: ' + error.message }, { status: 500 });
  }
}
