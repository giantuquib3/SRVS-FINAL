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
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only educators or department heads can restore versions.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { versionNumber } = await req.json();

    if (!versionNumber) {
      return NextResponse.json({ error: 'Target version number is required.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { course: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;

    if (user.role === 'Educator' && syllabus.instructorId !== currentUserIdInt) {
      return NextResponse.json({ error: 'You may only restore versions on your own syllabi.' }, { status: 403 });
    }

    const historicalVersion = await prisma.syllabusVersion.findUnique({
      where: { syllabusId_versionNumber: { syllabusId, versionNumber: Number(versionNumber) } },
    });

    if (!historicalVersion) {
      return NextResponse.json({ error: `Version ${versionNumber} does not exist.` }, { status: 404 });
    }

    const latestVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId },
      orderBy: { versionNumber: 'desc' },
    });
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    const changeSummary = `Restored from Version ${historicalVersion.versionNumber} (${new Date(historicalVersion.createdAt).toLocaleDateString()})`;

    const result = await prisma.$transaction(async (tx) => {
      const restoredVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId,
          versionNumber: newVersionNumber,
          editorId: currentUserIdInt,
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

      const updatedSyllabus = await tx.syllabus.findUnique({ where: { id: syllabusId } });
      return { syllabus: updatedSyllabus, version: restoredVersion };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'RestoreVersion',
      resultStatus: 'Success',
      description: `Restored syllabus [${syllabus.course.code}] to v${historicalVersion.versionNumber}, creating new v${newVersionNumber} [Draft]`,
      entityType: 'Syllabus',
      entityId: String(syllabus.id),
    });

    return NextResponse.json({
      success: true,
      message: `Version ${historicalVersion.versionNumber} restored as new Version ${newVersionNumber}.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error restoring version:', error);
    return NextResponse.json({ error: 'Failed to restore version: ' + error.message }, { status: 500 });
  }
}
