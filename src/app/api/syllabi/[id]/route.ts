import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    const { id } = params;

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            department: true,
          },
        },
        instructor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        department: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            editor: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    // Role-based access check
    if (syllabus.status !== 'Approved') {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
      if (user.role === 'Student') {
        return NextResponse.json({ error: 'Students can only view approved syllabi.' }, { status: 403 });
      }
      if (user.role === 'DepartmentHead' && user.departmentId !== syllabus.departmentId) {
        return NextResponse.json({ error: 'Cannot view syllabi from another department.' }, { status: 403 });
      }
    }

    // Identify current version
    const currentVersion =
      syllabus.versions.find((v) => v.versionNumber === syllabus.currentVersionNumber) ||
      syllabus.versions[0];

    return NextResponse.json({ syllabus, currentVersion });
  } catch (error: any) {
    console.error('Error fetching syllabus:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabus details.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const {
      changeSummary,
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      status, // Optional status change e.g. "Submitted"
    } = body;

    // Change summary is strictly mandatory when editing
    if (!changeSummary || !changeSummary.trim()) {
      return NextResponse.json({
        error: 'A Change Summary is mandatory when saving revisions to document what changed.',
      }, { status: 400 });
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

    // Verify educator ownership unless Admin
    if (user.role === 'Educator' && syllabus.instructorId !== user.id) {
      return NextResponse.json({ error: 'You may only edit syllabi you have created.' }, { status: 403 });
    }

    // Calculate new sequential version number
    const newVersionNumber = syllabus.currentVersionNumber + 1;
    const targetStatus = status || syllabus.status;

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    // Atomic transaction creating new version and updating syllabus current_version_number
    const result = await prisma.$transaction(async (tx) => {
      // Create new immutable version record
      const newVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: newVersionNumber,
          editorId: user.id,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: targetStatus,
          content: contentSnapshot,
        },
      });

      // Update syllabus metadata
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          currentVersionNumber: newVersionNumber,
          status: targetStatus,
          submittedAt: targetStatus === 'Submitted' ? new Date() : syllabus.submittedAt,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'EditSyllabus',
          resultStatus: 'Success',
          description: `Created Version ${newVersionNumber} for [${syllabus.course.code}] with summary: "${changeSummary.trim()}"`,
          entityType: 'Syllabus',
          entityId: syllabus.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { syllabus: updatedSyllabus, version: newVersion };
    });

    return NextResponse.json({
      success: true,
      message: `Version ${newVersionNumber} saved successfully.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error updating syllabus version:', error);
    return NextResponse.json({ error: 'Failed to save new syllabus revision.' }, { status: 500 });
  }
}
