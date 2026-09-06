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

    const { id } = params;
    const { versionNumber } = await req.json();

    if (!versionNumber) {
      return NextResponse.json({ error: 'Target version number is required for restoration.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    if (user.role === 'Educator' && syllabus.instructorId !== user.id) {
      return NextResponse.json({ error: 'You may only restore versions on your own syllabi.' }, { status: 403 });
    }

    // Find the historical version
    const historicalVersion = await prisma.syllabusVersion.findUnique({
      where: {
        syllabusId_versionNumber: {
          syllabusId: id,
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

    // Next sequential version number
    const newVersionNumber = syllabus.currentVersionNumber + 1;
    const changeSummary = `Restored from Version ${historicalVersion.versionNumber} (originally created by ${historicalVersion.editor.fullName} on ${new Date(historicalVersion.createdAt).toLocaleDateString()})`;

    // Transaction to insert new version without overwriting prior history
    const result = await prisma.$transaction(async (tx) => {
      const restoredVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: id,
          versionNumber: newVersionNumber,
          editorId: user.id,
          changeSummary,
          changeType: 'Restore',
          statusAtSave: 'Draft',
          content: historicalVersion.content as any,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id },
        data: {
          currentVersionNumber: newVersionNumber,
          status: 'Draft',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'RestoreVersion',
          resultStatus: 'Success',
          description: `Restored syllabus [${syllabus.course.code}] to Version ${historicalVersion.versionNumber}, creating new Version ${newVersionNumber} [Draft]`,
          entityType: 'Syllabus',
          entityId: syllabus.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { syllabus: updatedSyllabus, version: restoredVersion };
    });

    return NextResponse.json({
      success: true,
      message: `Version ${historicalVersion.versionNumber} successfully restored as new Version ${newVersionNumber}.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error restoring syllabus version:', error);
    return NextResponse.json({ error: 'Failed to restore version.' }, { status: 500 });
  }
}
