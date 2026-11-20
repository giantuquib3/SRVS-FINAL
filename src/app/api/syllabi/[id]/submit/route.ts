import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS } from '@/lib/status';
import { getFacultyEditPermissionForSyllabus } from '@/lib/edit-permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Faculty' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only Faculty and Department Heads may submit a syllabus.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (!userDeptCode || syllabus.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({ error: 'Forbidden: You may only submit syllabi within your assigned department.' }, { status: 403 });
    }

    if (user.role === 'Educator' || user.role === 'Faculty') {
      const perm = await getFacultyEditPermissionForSyllabus(syllabus.id, currentUserIdInt);
      if (!perm.hasPermission) {
        return NextResponse.json({
          error: 'Edit permission required: You must obtain edit permission from your Department Head before submitting revisions.',
        }, { status: 403 });
      }
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* optional */ }

    const isDeptHead = user.role === 'DepartmentHead';
    const targetStatus = isDeptHead ? SYLLABUS_STATUS.UNDER_REVIEW : SYLLABUS_STATUS.SUBMITTED;
    const now = new Date();

    const priorApproved = await prisma.syllabusVersion.findFirst({
      where: { syllabusId, approvalStatus: SYLLABUS_STATUS.APPROVED },
      orderBy: { versionNumber: 'desc' },
    });

    const result = await prisma.$transaction(async (tx: any) => {
      const latestVersion = await tx.syllabusVersion.findFirst({
        where: { syllabusId },
        orderBy: { versionNumber: 'desc' },
      });
      if (!latestVersion) {
        throw new Error('No syllabus version found to submit.');
      }
      if (latestVersion.approvalStatus === SYLLABUS_STATUS.APPROVED) {
        throw new Error('Latest version is already approved. Edit the syllabus to create a new revision.');
      }

      const updatedVersion = await tx.syllabusVersion.update({
        where: { id: latestVersion.id },
        data: {
          approvalStatus: targetStatus,
          statusAtSave: targetStatus,
          submittedById: currentUserIdInt,
          submittedAt: now,
          rejectionReason: null,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabusId },
        data: priorApproved
          ? {
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: priorApproved.versionNumber,
              submittedAt: now,
            }
          : {
              status: targetStatus,
              currentVersionNumber: latestVersion.versionNumber,
              submittedAt: now,
            },
      });

      return { updatedVersion, updatedSyllabus };
    });

    const notesSummary = body?.notes ? ` – Note: "${body.notes}"` : '';

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabus',
      resultStatus: 'Success',
      description: `Submitted syllabus for [${syllabus.subject.code}] v${result.updatedVersion.versionNumber} (${targetStatus})${notesSummary}`,
      entityType: 'SyllabusVersion',
      entityId: String(result.updatedVersion.id),
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
          `Department Head ${user.fullName} submitted [${syllabus.subject.code}] v${result.updatedVersion.versionNumber} for Dean approval.`,
          `/department/syllabus-approvals/${result.updatedVersion.id}`
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
          `Faculty ${user.fullName} submitted [${syllabus.subject.code}] v${result.updatedVersion.versionNumber} for Department Head approval.`,
          `/department/syllabus-approvals/${result.updatedVersion.id}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: isDeptHead
        ? 'Syllabus submitted to the Dean for review and approval.'
        : 'Syllabus submitted to the Department Head for review and approval.',
      syllabus: result.updatedSyllabus,
      version: result.updatedVersion,
    });
  } catch (error: any) {
    console.error('Error submitting syllabus:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit syllabus.' }, { status: 400 });
  }
}
