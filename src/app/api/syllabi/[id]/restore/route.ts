import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only educators or administrators can restore versions.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const { versionNumber } = await req.json();

    if (!versionNumber) {
      return NextResponse.json({ error: 'Target version number is required for restoration.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    const currentUserId = Number(user.id);

    if (user.role === 'Educator' && syllabus.instructorId !== currentUserId) {
      return NextResponse.json({ error: 'You may only restore versions on your own syllabi.' }, { status: 403 });
    }

    // Find the historical version
    const historicalVersion = await prisma.syllabusVersion.findUnique({
      where: {
        syllabusId_versionNumber: {
          syllabusId: numericId,
          versionNumber: Number(versionNumber),
        },
      },
      include: {
        editor: true,
      },
    });

    if (!historicalVersion) {
      return NextResponse.json({ error: `Historical Version ${versionNumber} does not exist.` }, { status: 404 });
    }

    // Find latest version number to determine next version
    const latestVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: numericId },
      orderBy: { versionNumber: 'desc' },
    });
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    const changeSummary = `Restored from Version ${historicalVersion.versionNumber} (originally created by ${historicalVersion.editor.fullName} on ${new Date(historicalVersion.createdAt).toLocaleDateString()})`;
    const uIdNumber = String(user.idNumber || user.username || user.id);

    // Transaction to insert new version without overwriting prior history
    const result = await prisma.$transaction(async (tx) => {
      const restoredVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: numericId,
          versionNumber: newVersionNumber,
          editorId: currentUserId,
          uploadedByUserId: uIdNumber,
          changeSummary,
          changeType: 'Restore',
          statusAtSave: 'DRAFT',
          approvalStatus: 'DRAFT',
          content: historicalVersion.content as any,
          fileName: historicalVersion.fileName,
          fileUrl: historicalVersion.fileUrl,
          fileType: historicalVersion.fileType,
          fileSize: historicalVersion.fileSize,
        },
      });

      const updatedSyllabus = await tx.syllabus.findUnique({
        where: { id: numericId },
      });

      return { syllabus: updatedSyllabus, version: restoredVersion };
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: 'RestoreVersion',
      resultStatus: 'Success',
      description: `Restored syllabus [${syllabus.subject.code}] to Version ${historicalVersion.versionNumber}, creating new Version ${newVersionNumber} [Draft]`,
      entityType: 'Syllabus',
      entityId: syllabus.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `Version ${historicalVersion.versionNumber} successfully restored as new Version ${newVersionNumber}.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error restoring version:', error);
    return NextResponse.json({ error: 'Failed to restore version: ' + error.message }, { status: 500 });
  }
}
