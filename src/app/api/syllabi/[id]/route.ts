import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: {
        course: true,
        instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    // Department Head: strictly scoped to own department
    if (user.role === 'DepartmentHead' && userDeptCode && userDeptCode !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json({ error: 'Access denied: Department Heads may only view syllabi within their department.' }, { status: 403 });
    }

    // Student: must be approved, in own department, and enrolled in the course
    if (user.role === 'Student') {
      if (syllabus.status !== 'Approved' && syllabus.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Students can only view approved syllabi.' }, { status: 403 });
      }
      if (!userDeptCode || syllabus.departmentId.toUpperCase() !== userDeptCode) {
        return NextResponse.json({ error: 'Access denied: Students can only view syllabi in their department.' }, { status: 403 });
      }
      const studentIntId = parseInt(user.id, 10);
      const enrollment = !isNaN(studentIntId)
        ? await prisma.enrollment.findFirst({
            where: { studentId: studentIntId, courseId: syllabus.courseId, status: 'ENROLLED' },
          })
        : null;
      if (!enrollment) {
        return NextResponse.json({ error: 'Access restricted: You can only view syllabi for courses you are enrolled in.' }, { status: 403 });
      }
    }

    const currentVersion =
      syllabus.versions.find((v) => v.versionNumber === syllabus.currentVersionNumber) ||
      syllabus.versions[0];

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const canEdit =
      user.role === 'Admin' ||
      (user.role === 'DepartmentHead' && userDeptCode === syllabus.departmentId.toUpperCase()) ||
      (user.role === 'Educator' && currentUserIdInt === syllabus.instructorId);

    const deptCode = syllabus.departmentId;
    const formatted = {
      ...syllabus,
      department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
      course: {
        ...syllabus.course,
        department: {
          id: syllabus.course.departmentId,
          code: syllabus.course.departmentId,
          name: getDepartmentName(syllabus.course.departmentId),
        },
      },
      subject: syllabus.course,
      subjectId: syllabus.courseId,
      courseId: syllabus.courseId,
    };

    return NextResponse.json({ syllabus: formatted, currentVersion, versions: syllabus.versions, canEdit });
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
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: {
        course: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isAuthor = syllabus.instructorId === currentUserIdInt;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    const isDeptHead = user.role === 'DepartmentHead' && userDeptCode === syllabus.departmentId.toUpperCase();

    if (!isAuthor && !isDeptHead) {
      return NextResponse.json({ error: 'Forbidden: Only the assigned Educator author and Department Head may revise this syllabus.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseDescription, learningOutcomes, topics, references, gradingSystem, schedule,
      changeSummary, saveAsDraft = false, submitForApproval = false,
      fileName, fileUrl, fileType, fileSize,
    } = body;

    if (!changeSummary?.trim()) {
      return NextResponse.json({ error: 'A change summary is required for revision history tracking.' }, { status: 400 });
    }

    const latestVersion = syllabus.versions[0];
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const canDirectApprove = user.role === 'DepartmentHead' && body.directApprove === true;
    const isDraft = !canDirectApprove && saveAsDraft === true && submitForApproval === false;
    const versionApprovalStatus = canDirectApprove ? 'APPROVED' : (isDraft ? 'DRAFT' : 'PENDING_APPROVAL');
    const now = new Date();

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
          editorId: currentUserIdInt,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: isDraft ? null : currentUserIdInt,
          submittedAt: isDraft ? null : now,
          reviewedById: canDirectApprove ? currentUserIdInt : null,
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
          reviewedByUserId: canDirectApprove ? currentUserIdInt : syllabus.reviewedByUserId,
          reviewerRemarks: canDirectApprove ? 'Directly approved by Department Head' : syllabus.reviewerRemarks,
        },
      });

      return { updatedSyllabus, newVersion };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'CreateRevision',
      resultStatus: 'Success',
      description: `Created syllabus v${newVersionNumber} for ${syllabus.course.code} (${versionApprovalStatus})`,
      entityType: 'SyllabusVersion',
      entityId: String(result.newVersion.id),
    });

    return NextResponse.json({
      success: true,
      syllabus: result.updatedSyllabus,
      version: result.newVersion,
      message: canDirectApprove
        ? `Version ${newVersionNumber} approved and published.`
        : isDraft ? `Version ${newVersionNumber} saved as draft.` : `Version ${newVersionNumber} submitted for review.`,
    });
  } catch (error: any) {
    console.error('Error revising syllabus:', error);
    return NextResponse.json({ error: 'Failed to create revision: ' + error.message }, { status: 500 });
  }
}
