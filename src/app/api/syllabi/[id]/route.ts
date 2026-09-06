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
    const numericId = Number(params.id);

    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: {
          include: {
            department: true,
          },
        },
        instructor: {
          select: {
            id: true,
            idNumber: true,
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
                idNumber: true,
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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 1. Department Head: Strictly scoped to own department
    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== syllabus.departmentId) {
      return NextResponse.json({
        error: 'Access denied: Department Heads may only view syllabi within their assigned department.',
      }, { status: 403 });
    }

    // 2. Student: Must be Approved/Active AND actively enrolled in this subject
    if (user.role === 'Student') {
      if (syllabus.status !== 'Approved' && syllabus.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Students can only view approved syllabi.' }, { status: 403 });
      }

      const activeEnrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: Number(user.id),
          subjectId: syllabus.subjectId,
          status: 'ENROLLED',
        },
      });

      if (!activeEnrollment) {
        return NextResponse.json({
          error: 'Access restricted: You can only view syllabi for subjects you are actively enrolled in.',
        }, { status: 403 });
      }
    }

    const currentVersion =
      syllabus.versions.find((v) => v.versionNumber === syllabus.currentVersionNumber) ||
      syllabus.versions[0];

    const canEdit =
      user.role === 'Admin' ||
      user.role === 'DepartmentHead' ||
      (user.role === 'Educator' && Number(user.id) === syllabus.instructorId);

    const formattedSyllabus = {
      ...syllabus,
      course: syllabus.subject,
      courseId: syllabus.subjectId,
    };

    return NextResponse.json({
      syllabus: formattedSyllabus,
      currentVersion,
      versions: syllabus.versions,
      canEdit,
    });
  } catch (error: any) {
    console.error('Error fetching syllabus details:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabus.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: { include: { department: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    const currentUserId = Number(user.id);
    const isAuthor = syllabus.instructorId === currentUserId;
    const isDeptHead = user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) === syllabus.departmentId;
    const isAdmin = user.role === 'Admin';

    if (!isAuthor && !isDeptHead && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to modify this syllabus.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      changeSummary,
      saveAsDraft = false,
      submitForApproval = false,
      fileName,
      fileUrl,
      fileType,
      fileSize,
    } = body;

    if (!changeSummary || !changeSummary.trim()) {
      return NextResponse.json({ error: 'A summary of changes is required for revision history tracking.' }, { status: 400 });
    }

    const latestVersion = syllabus.versions[0];
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const canDirectApprove = (user.role === 'DepartmentHead' || user.role === 'Admin') && body.directApprove === true;
    const isDraft = !canDirectApprove && saveAsDraft === true && submitForApproval === false;
    const versionApprovalStatus = canDirectApprove ? 'APPROVED' : (isDraft ? 'DRAFT' : 'PENDING_APPROVAL');
    const now = new Date();
    const uIdNumber = String(user.idNumber || user.username || user.id);

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    const priorApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: syllabus.id, approvalStatus: 'APPROVED' },
    });

    const result = await prisma.$transaction(async (tx) => {
      const newVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: newVersionNumber,
          editorId: currentUserId,
          uploadedByUserId: uIdNumber,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: isDraft ? null : currentUserId,
          submittedAt: isDraft ? null : now,
          reviewedById: canDirectApprove ? currentUserId : null,
          reviewedAt: canDirectApprove ? now : null,
        },
      });

      let newSyllabusStatus = syllabus.status;
      let newCurrentVersion = syllabus.currentVersionNumber;

      if (canDirectApprove) {
        newSyllabusStatus = 'ACTIVE';
        newCurrentVersion = newVersionNumber;
      } else if (priorApprovedVersion) {
        newSyllabusStatus = 'ACTIVE';
      } else {
        newSyllabusStatus = isDraft ? 'DRAFT' : 'PENDING_APPROVAL';
      }

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          currentVersionNumber: newCurrentVersion,
          status: newSyllabusStatus,
          submittedAt: isDraft ? syllabus.submittedAt : now,
          reviewedAt: canDirectApprove ? now : syllabus.reviewedAt,
          reviewedByUserId: canDirectApprove ? currentUserId : syllabus.reviewedByUserId,
          reviewerRemarks: canDirectApprove ? 'Directly approved by Department Head' : syllabus.reviewerRemarks,
        },
      });

      return { updatedSyllabus, newVersion };
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: 'CreateRevision',
      resultStatus: 'Success',
      description: `Created syllabus version ${newVersionNumber} for ${syllabus.subject.code} (${versionApprovalStatus})`,
      entityType: 'SyllabusVersion',
      entityId: result.newVersion.id,
    });

    return NextResponse.json({
      success: true,
      syllabus: result.updatedSyllabus,
      version: result.newVersion,
      message: canDirectApprove
        ? `Version ${newVersionNumber} approved and published as the official active syllabus.`
        : (isDraft
          ? `Version ${newVersionNumber} saved as draft.`
          : `Version ${newVersionNumber} submitted for Department Head review.`),
    });
  } catch (error: any) {
    console.error('Error revising syllabus:', error);
    return NextResponse.json({ error: 'Failed to create revision: ' + error.message }, { status: 500 });
  }
}
