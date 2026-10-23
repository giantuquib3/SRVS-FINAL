import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS } from '@/lib/status';

export const dynamic = 'force-dynamic';

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
        subject: true,
        instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    // Department Head: strictly scoped to own department
    if (user.role === 'DepartmentHead' && userDeptCode && userDeptCode !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json({ error: 'Access denied: Department Heads may only view syllabi within their assigned department.' }, { status: 403 });
    }

    // Student: must be approved, in own department, and enrolled in the subject
    if (user.role === 'Student') {
      if (syllabus.status !== SYLLABUS_STATUS.APPROVED) {
        return NextResponse.json({ error: 'Students can only view active, approved syllabi.' }, { status: 403 });
      }
      if (!userDeptCode || syllabus.departmentId.toUpperCase() !== userDeptCode) {
        return NextResponse.json({ error: 'Access denied: Students can only view syllabi in their assigned department.' }, { status: 403 });
      }
      const studentIntId = parseInt(user.id, 10);
      const enrollment = !isNaN(studentIntId)
        ? await prisma.studentSubject.findUnique({
            where: { studentId_subjectId: { studentId: studentIntId, subjectId: syllabus.subjectId } },
          })
        : null;
      if (!enrollment || enrollment.status !== 'ENROLLED') {
        return NextResponse.json({ error: 'Access restricted: You can only view syllabi for subjects you are actively enrolled in.' }, { status: 403 });
      }
    }

    const currentVersion =
      syllabus.versions.find((v: any) => v.versionNumber === syllabus.currentVersionNumber) ||
      syllabus.versions[0];

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const canEdit =
      user.role === 'Admin' ||
      (user.role === 'DepartmentHead' && userDeptCode === syllabus.departmentId.toUpperCase()) ||
      (user.role === 'Educator' && currentUserIdInt === syllabus.instructorId);

    const deptCode = syllabus.departmentId;
    const subjectData = {
      id: syllabus.subject.id,
      code: syllabus.subject.code,
      title: syllabus.subject.title,
      units: syllabus.subject.units,
      departmentId: syllabus.subject.departmentId,
      professorName: syllabus.subject.professorName || null,
      department: {
        id: syllabus.subject.departmentId,
        code: syllabus.subject.departmentId,
        name: getDepartmentName(syllabus.subject.departmentId),
      },
    };

    const formatted = {
      id: syllabus.id,
      subjectId: syllabus.subjectId,
      courseId: syllabus.subjectId, // Alias
      instructorId: syllabus.instructorId,
      departmentId: deptCode,
      academicYear: syllabus.academicYear,
      semester: syllabus.semester,
      section: syllabus.section,
      status: syllabus.status,
      currentVersionNumber: syllabus.currentVersionNumber,
      reviewerRemarks: syllabus.reviewerRemarks,
      submittedAt: syllabus.submittedAt,
      reviewedAt: syllabus.reviewedAt,
      reviewedByUserId: syllabus.reviewedByUserId,
      createdAt: syllabus.createdAt,
      updatedAt: syllabus.updatedAt,
      department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
      subject: subjectData,
      course: subjectData, // Alias
      instructor: syllabus.instructor
        ? {
            id: syllabus.instructor.id,
            idNumber: syllabus.instructor.id,
            fullName: syllabus.instructor.fullName,
            email: syllabus.instructor.email,
            academicRank: syllabus.instructor.academicRank,
          }
        : null,
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
        subject: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isAuthor = syllabus.instructorId === currentUserIdInt;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    const isDeptHead = user.role === 'DepartmentHead' && userDeptCode === syllabus.departmentId.toUpperCase();

    if (!isAuthor && !isDeptHead && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Only the assigned Educator author and Department Head may revise this syllabus.' }, { status: 403 });
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

    if (!changeSummary?.trim()) {
      return NextResponse.json({ error: 'A change summary is required for revision history tracking.' }, { status: 400 });
    }

    // PDF only validation
    if (fileUrl && fileType && fileType.toUpperCase() !== 'PDF') {
      return NextResponse.json({ error: 'Invalid file format. The SRVS system accepts PDF documents only (.pdf).' }, { status: 400 });
    }

    const latestVersion = syllabus.versions[0];
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const isDraft = saveAsDraft === true && submitForApproval === false;
    const versionStatus = isDraft ? SYLLABUS_STATUS.DRAFT : SYLLABUS_STATUS.SUBMITTED;
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
      where: { syllabusId: syllabus.id, approvalStatus: SYLLABUS_STATUS.APPROVED },
    });

    const result = await prisma.$transaction(async (tx) => {
      const newVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: newVersionNumber,
          editorId: currentUserIdInt,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: versionStatus,
          approvalStatus: versionStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: 'PDF',
          fileSize: fileSize || null,
          submittedById: isDraft ? null : currentUserIdInt,
          submittedAt: isDraft ? null : now,
        },
      });

      // Keep active status if prior version was approved while new revision is pending review
      const newSyllabusStatus = priorApprovedVersion ? SYLLABUS_STATUS.APPROVED : versionStatus;

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: newSyllabusStatus,
          submittedAt: isDraft ? syllabus.submittedAt : now,
        },
      });

      return { updatedSyllabus, newVersion };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'CreateRevision',
      resultStatus: 'Success',
      description: `Created syllabus revision v${newVersionNumber} for [${syllabus.subject.code}] ${syllabus.subject.title} (${versionStatus})`,
      entityType: 'SyllabusVersion',
      entityId: String(result.newVersion.id),
    });

    return NextResponse.json({
      success: true,
      syllabus: result.updatedSyllabus,
      version: result.newVersion,
      message: isDraft
        ? `Version ${newVersionNumber} saved as draft.`
        : `Version ${newVersionNumber} submitted for Department Head review.`,
    });
  } catch (error: any) {
    console.error('Error revising syllabus:', error);
    return NextResponse.json({ error: 'Failed to create revision: ' + error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  return PATCH(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    // Department Isolation
    if (user.role === 'DepartmentHead') {
      const userDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!userDept || syllabus.departmentId.toUpperCase() !== userDept) {
        return NextResponse.json({ error: 'Forbidden: You may only delete syllabi within your assigned department.' }, { status: 403 });
      }
    }

    await prisma.syllabus.delete({ where: { id: syllabusId } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'DeleteSyllabus',
      resultStatus: 'Success',
      description: `Deleted syllabus ID ${syllabusId} for subject [${syllabus.subject.code}]`,
      entityType: 'Syllabus',
      entityId: String(syllabusId),
    });

    return NextResponse.json({ success: true, message: `Syllabus ${syllabusId} deleted successfully.` });
  } catch (error: any) {
    console.error('Error deleting syllabus:', error);
    return NextResponse.json({ error: 'Failed to delete syllabus.' }, { status: 500 });
  }
}
