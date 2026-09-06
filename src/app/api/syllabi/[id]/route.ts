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

    // Role-based access checks
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 1. Department Head: Strictly scoped to own department
    if (user.role === 'DepartmentHead' && user.departmentId !== syllabus.departmentId) {
      return NextResponse.json({
        error: 'Access denied: Department Heads may only view syllabi within their assigned department.',
      }, { status: 403 });
    }

    // 2. Student: Must be Approved/Active AND must be actively enrolled in this course
    if (user.role === 'Student') {
      if (syllabus.status !== 'Approved' && syllabus.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Students can only view approved syllabi.' }, { status: 403 });
      }

      const activeEnrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: user.id,
          courseId: syllabus.courseId,
          status: 'ENROLLED',
        },
      });

      if (!activeEnrollment) {
        return NextResponse.json({
          error: 'Access restricted: You can only view syllabi for subjects you are actively enrolled in.',
        }, { status: 403 });
      }
    }

    // Identify official approved current version
    const currentVersion =
      syllabus.versions.find((v) => v.versionNumber === syllabus.currentVersionNumber && (v.approvalStatus === 'APPROVED' || syllabus.status === 'Approved')) ||
      syllabus.versions.find((v) => v.versionNumber === syllabus.currentVersionNumber) ||
      syllabus.versions[0];

    // Students only view current approved version (no internal revision drafts or pending revisions)
    const sanitizedSyllabus = user.role === 'Student'
      ? { ...syllabus, versions: currentVersion ? [currentVersion] : [] }
      : syllabus;

    return NextResponse.json({ syllabus: sanitizedSyllabus, currentVersion });
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
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
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
      saveAsDraft = false,
      submitForApproval = true,
      fileName,
      fileUrl,
      fileType,
      fileSize,
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
        course: { include: { department: true } },
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    // Verify educator ownership unless Admin
    if (user.role === 'Educator' && syllabus.instructorId !== user.id) {
      return NextResponse.json({ error: 'You may only edit syllabi you have created.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && syllabus.instructorId !== user.id && syllabus.departmentId !== user.departmentId) {
      return NextResponse.json({ error: 'You may only edit syllabi within your department.' }, { status: 403 });
    }

    // Calculate new sequential version number based on highest existing version
    const maxVersionRecord = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: syllabus.id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const newVersionNumber = (maxVersionRecord?.versionNumber || syllabus.currentVersionNumber) + 1;

    const isDraft = saveAsDraft === true && submitForApproval === false;
    const versionApprovalStatus = isDraft ? 'DRAFT' : 'PENDING_APPROVAL';
    const now = new Date();

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    // Atomic transaction: Create new version WITHOUT overwriting currentVersionNumber!
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create new immutable version record
      const newVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: newVersionNumber,
          editorId: user.id,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: isDraft ? null : user.id,
          submittedAt: isDraft ? null : now,
        },
      });

      // 2. Update syllabus metadata
      // CRITICAL RULE: A pending or rejected revision must NOT replace the previously approved current version.
      // currentVersionNumber remains the previously approved version.
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
          submittedAt: isDraft ? syllabus.submittedAt : now,
        },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: isDraft ? 'CreateRevisionDraft' : 'SubmitSyllabusRevision',
          resultStatus: 'Success',
          description: `Created Version ${newVersionNumber} for [${syllabus.course.code}] (${versionApprovalStatus}) with summary: "${changeSummary.trim()}"`,
          entityType: 'SyllabusVersion',
          entityId: newVersion.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { syllabus: updatedSyllabus, version: newVersion };
    });

    // 4. Notify Department Head & Admins if submitted for approval
    if (!isDraft) {
      const reviewers = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'Admin', accountStatus: 'Active' },
            { role: 'DepartmentHead', departmentId: syllabus.departmentId, accountStatus: 'Active' },
          ],
        },
        select: { id: true },
      });

      for (const reviewer of reviewers) {
        if (reviewer.id !== user.id) {
          const { createNotification } = await import('@/lib/notifications');
          await createNotification(
            reviewer.id,
            `Pending Revision Review: ${syllabus.course.code}`,
            `A new revision for ${syllabus.course.code} (Version ${newVersionNumber}) was submitted by ${user.fullName} for Department Head review.`,
            `/department/syllabus-approvals/${result.version.id}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: isDraft
        ? `Revision draft Version ${newVersionNumber} saved.`
        : `Revision Version ${newVersionNumber} submitted for Department Head review. Previous approved version remains active for students until approved.`,
      syllabus: result.syllabus,
      version: result.version,
    });
  } catch (error: any) {
    console.error('Error updating syllabus version:', error);
    return NextResponse.json({ error: 'Failed to save new syllabus revision: ' + error.message }, { status: 500 });
  }
}

