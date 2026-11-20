import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { PROPOSAL_VERSION_OFFSET, SYLLABUS_STATUS } from '@/lib/status';
import { getFacultyEditPermissionForSyllabus } from '@/lib/edit-permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Faculty' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only Faculty or Department Heads can restore versions.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { versionNumber } = await req.json();
    if (!versionNumber) {
      return NextResponse.json({ error: 'Target version number is required.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (!userDeptCode || syllabus.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({ error: 'Forbidden: You may only restore versions within your assigned department.' }, { status: 403 });
    }

    if (user.role === 'Educator' || user.role === 'Faculty') {
      const perm = await getFacultyEditPermissionForSyllabus(syllabus.id, currentUserIdInt);
      if (!perm.hasPermission) {
        return NextResponse.json({
          error: 'Edit permission required: You must obtain edit permission from your Department Head before restoring a syllabus version.',
        }, { status: 403 });
      }
    }

    const historicalVersion = await prisma.syllabusVersion.findUnique({
      where: { syllabusId_versionNumber: { syllabusId, versionNumber: Number(versionNumber) } },
    });

    if (!historicalVersion) {
      return NextResponse.json({ error: `Version ${versionNumber} does not exist.` }, { status: 404 });
    }

    const existingVersions = await prisma.syllabusVersion.findMany({
      where: { syllabusId },
      select: { versionNumber: true, approvalStatus: true },
    });
    const maxApproved = existingVersions
      .filter((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber <= PROPOSAL_VERSION_OFFSET)
      .reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
    const maxProposal = existingVersions
      .filter((v: any) => v.versionNumber > PROPOSAL_VERSION_OFFSET)
      .reduce((m: number, v: any) => Math.max(m, v.versionNumber), PROPOSAL_VERSION_OFFSET);
    const newVersionNumber = maxProposal + 1;
    const proposalNumber = newVersionNumber - PROPOSAL_VERSION_OFFSET;
    const targetVersionNumber = maxApproved + 1;
    const changeSummary = `Restored content from Version ${historicalVersion.versionNumber} (${new Date(historicalVersion.createdAt).toLocaleDateString()}) as Draft Proposal #${proposalNumber}`;

    const cleanContent =
      historicalVersion.content && typeof historicalVersion.content === 'object'
        ? { ...(historicalVersion.content as any) }
        : {};
    delete cleanContent._reviewMeta;
    cleanContent._proposalMeta = {
      proposalNumber,
      baseVersionNumber: syllabus.currentVersionNumber,
      targetVersionNumber,
    };

    // Never overwrite previous versions and never replace currently approved syllabus!
    const result = await prisma.$transaction(async (tx: any) => {
      const restoredVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId,
          versionNumber: newVersionNumber,
          editorId: currentUserIdInt,
          changeSummary,
          changeType: 'Restore',
          statusAtSave: 'DRAFT',
          approvalStatus: 'DRAFT',
          content: cleanContent,
          fileName: historicalVersion.fileName,
          fileUrl: historicalVersion.fileUrl,
          fileType: historicalVersion.fileType,
          fileSize: historicalVersion.fileSize,
        },
      });

      const updatedSyllabus = await tx.syllabus.findUnique({ where: { id: syllabusId } });
      return { syllabus: updatedSyllabus, version: restoredVersion };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'RestoreVersion',
      resultStatus: 'Success',
      description: `Restored syllabus [${syllabus.subject.code}] from v${historicalVersion.versionNumber}, creating Draft Proposal #${proposalNumber} (Target v${targetVersionNumber})`,
      entityType: 'SyllabusVersion',
      entityId: String(result.version.id),
    });

    return NextResponse.json({
      success: true,
      message: `Version ${historicalVersion.versionNumber} restored as Draft Proposal #${proposalNumber}. Submit it for approval to generate Version ${targetVersionNumber}.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error restoring version:', error);
    return NextResponse.json({ error: 'Failed to restore version: ' + error.message }, { status: 500 });
  }
}
