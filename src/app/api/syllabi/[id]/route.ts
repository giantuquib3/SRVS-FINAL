import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS, PROPOSAL_VERSION_OFFSET } from '@/lib/status';
import { normalizeSyllabusContent, extractReviewComments } from '@/lib/syllabus-template';
import { getFacultyEditPermissionForSyllabus } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const requestedVersionParam = searchParams.get('version');
    const requestedVersionNum = requestedVersionParam ? parseInt(requestedVersionParam, 10) : null;

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: {
        subject: true,
        department: true,
        instructor: { select: { id: true, fullName: true, email: true, role: true, academicRank: true } },
        versions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            editor: { select: { id: true, fullName: true, email: true, role: true } },
            submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
            reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
          },
        },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    // Department isolation for DepartmentHead & Faculty
    if (
      (user.role === 'DepartmentHead' || user.role === 'Educator' || user.role === 'Faculty') &&
      (!userDeptCode || userDeptCode !== syllabus.departmentId.toUpperCase())
    ) {
      return NextResponse.json({
        error: `Access denied: You may only view syllabi within your assigned department (${userDeptCode || 'None'}).`,
      }, { status: 403 });
    }

    // Dean with assigned department check (if Dean has departmentId=null, Dean can view all departments)
    if (user.role === 'Dean' && userDeptCode && userDeptCode !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json({
        error: `Access denied: You may only view syllabi within your designated department (${userDeptCode}).`,
      }, { status: 403 });
    }

    const enrichedVersions = syllabus.versions.map((v: any) => ({
      ...v,
      subjectId: syllabus.subjectId,
      reviewComments: extractReviewComments(v),
    }));

    const approvedVersion =
      enrichedVersions.find(
        (v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber === syllabus.currentVersionNumber
      ) ||
      enrichedVersions.find((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED) ||
      null;

    // Student rule: ONLY currently approved syllabi for enrolled subjects
    if (user.role === 'Student') {
      const enrollment = await prisma.studentSubject.findFirst({
        where: { studentId: currentUserIdInt, subjectId: syllabus.subjectId, status: 'ENROLLED' },
      });
      if (!enrollment) {
        return NextResponse.json({
          error: 'Access denied: Students may only view syllabi for their enrolled subjects.',
        }, { status: 403 });
      }
      if (!approvedVersion) {
        return NextResponse.json({
          error: 'No approved syllabus is currently available for this subject.',
        }, { status: 403 });
      }
    }

    const latestVersion = enrichedVersions[0] || null;
    const pendingVersion =
      enrichedVersions.find(
        (v: any) =>
          v.approvalStatus === SYLLABUS_STATUS.SUBMITTED ||
          v.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW
      ) || null;

    let currentVersion = approvedVersion || latestVersion;
    if (
      user.role !== 'Student' &&
      requestedVersionNum &&
      !isNaN(requestedVersionNum)
    ) {
      const match = enrichedVersions.find((v: any) => v.versionNumber === requestedVersionNum);
      if (match) currentVersion = match;
    }

    // Read-only global viewers (Registrar, VP-Academics) see the approved version if available
    if ((user.role === 'Registrar' || user.role === 'VPAcademics') && approvedVersion && !requestedVersionNum) {
      currentVersion = approvedVersion;
    }

    const isDeptHeadInDept =
      user.role === 'DepartmentHead' &&
      Boolean(userDeptCode && userDeptCode === syllabus.departmentId.toUpperCase());
    const isFacultyInDept =
      (user.role === 'Educator' || user.role === 'Faculty') &&
      Boolean(userDeptCode && userDeptCode === syllabus.departmentId.toUpperCase());

    let editPermission: {
      canEdit: boolean;
      requiresPermission: boolean;
      status: string;
      request: any | null;
    } = {
      canEdit: false,
      requiresPermission: false,
      status: 'READ_ONLY',
      request: null,
    };

    if (isDeptHeadInDept) {
      editPermission = {
        canEdit: true,
        requiresPermission: false,
        status: 'DIRECT_ACCESS',
        request: null,
      };
    } else if (isFacultyInDept) {
      const perm = await getFacultyEditPermissionForSyllabus(syllabus.id, currentUserIdInt);
      editPermission = {
        canEdit: perm.hasPermission,
        requiresPermission: true,
        status: perm.status,
        request: perm.request,
      };
    }

    const canEdit = editPermission.canEdit;

    const deptCode = syllabus.departmentId;
    const deptName = syllabus.department?.name || getDepartmentName(deptCode);
    const subjectData = {
      id: syllabus.subject.id,
      code: syllabus.subject.code,
      title: syllabus.subject.title,
      description: syllabus.subject.description,
      units: syllabus.subject.units,
      lecHours: syllabus.subject.lecHours,
      labHours: syllabus.subject.labHours,
      prerequisite: syllabus.subject.prerequisite,
      yearLevel: syllabus.subject.yearLevel,
      semester: syllabus.subject.semester,
      departmentId: syllabus.subject.departmentId,
      professorName: syllabus.subject.professorName || null,
      department: {
        id: syllabus.subject.departmentId,
        code: syllabus.subject.departmentId,
        name: deptName,
      },
    };

    const formatted = {
      id: syllabus.id,
      subjectId: syllabus.subjectId,
      courseId: syllabus.subjectId,
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
      department: { id: deptCode, code: deptCode, name: deptName },
      subject: subjectData,
      course: subjectData,
      instructor: syllabus.instructor
        ? {
            id: syllabus.instructor.id,
            idNumber: syllabus.instructor.id,
            fullName: syllabus.instructor.fullName,
            email: syllabus.instructor.email,
            role: syllabus.instructor.role,
            academicRank: syllabus.instructor.academicRank,
          }
        : null,
    };

    const visibleVersions = user.role === 'Student' ? (approvedVersion ? [approvedVersion] : []) : enrichedVersions;

    return NextResponse.json({
      syllabus: formatted,
      currentVersion,
      effectiveVersion: approvedVersion,
      pendingVersion: user.role === 'Student' ? null : pendingVersion,
      latestVersion: user.role === 'Student' ? approvedVersion : latestVersion,
      versions: visibleVersions,
      canEdit,
      editPermission,
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
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: {
        subject: true,
        department: true,
        versions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    const isFacultyInDept =
      (user.role === 'Educator' || user.role === 'Faculty') &&
      Boolean(userDeptCode && userDeptCode === syllabus.departmentId.toUpperCase());
    const isDeptHead =
      user.role === 'DepartmentHead' &&
      Boolean(userDeptCode && userDeptCode === syllabus.departmentId.toUpperCase());

    if (!isFacultyInDept && !isDeptHead) {
      return NextResponse.json({
        error: 'Forbidden: Only Faculty and the Department Head of this department may edit or revise this syllabus.',
      }, { status: 403 });
    }

    // Rule: Faculty MUST obtain approved edit permission from their Department Head BEFORE editing!
    if (isFacultyInDept) {
      const perm = await getFacultyEditPermissionForSyllabus(syllabus.id, currentUserIdInt);
      if (!perm.hasPermission) {
        return NextResponse.json(
          {
            error:
              perm.status === 'PENDING'
                ? 'Edit permission pending: Your edit permission request is currently awaiting your Department Head’s approval.'
                : 'Edit permission required: You must request and receive edit permission from your Department Head before editing this syllabus.',
            editPermissionStatus: perm.status,
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const {
      content: structuredContent,
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
      return NextResponse.json(
        { error: 'A change summary is mandatory for automatic syllabus version tracking.' },
        { status: 400 }
      );
    }

    // Create an immutable proposed revision (proposal slot >= 1001).
    // Once approved, it is automatically promoted to the next official Version (maxApproved + 1, e.g. Version 2, Version 3...)
    const latestVersion = syllabus.versions[0];
    const maxApprovedVersion = syllabus.versions
      .filter((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber <= PROPOSAL_VERSION_OFFSET)
      .reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
    const maxProposalVersion = syllabus.versions
      .filter((v: any) => v.versionNumber > PROPOSAL_VERSION_OFFSET)
      .reduce((m: number, v: any) => Math.max(m, v.versionNumber), PROPOSAL_VERSION_OFFSET);

    const newVersionNumber = maxProposalVersion + 1;
    const proposalNumber = newVersionNumber - PROPOSAL_VERSION_OFFSET;
    const targetOfficialVersion = maxApprovedVersion + 1;

    const isDraft = saveAsDraft === true && submitForApproval === false;
    // Dual Approval Routing:
    // - Faculty submits -> SUBMITTED (Pending Department Head Approval ONLY)
    // - Department Head submits -> UNDER_REVIEW (Pending Dean Approval — NEVER self-approved!)
    const versionStatus = isDraft
      ? SYLLABUS_STATUS.DRAFT
      : isDeptHead
      ? SYLLABUS_STATUS.UNDER_REVIEW
      : SYLLABUS_STATUS.SUBMITTED;
    const now = new Date();

    const normalizedContent: any = normalizeSyllabusContent(
      structuredContent || {
        ...(typeof latestVersion?.content === 'object' ? (latestVersion.content as any) : {}),
        courseDescription,
        learningOutcomes,
        topics,
        references,
        gradingSystem,
        schedule,
      },
      syllabus.subject,
      syllabus.department?.name || getDepartmentName(syllabus.departmentId)
    );
    delete normalizedContent._reviewMeta;
    normalizedContent._proposalMeta = {
      proposalNumber,
      baseVersionNumber: maxApprovedVersion || syllabus.currentVersionNumber,
      targetVersionNumber: targetOfficialVersion,
    };

    // Protect currently approved syllabus: NEVER replace currentVersionNumber until required approval is granted!
    const priorApprovedVersion = syllabus.versions.find(
      (v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber === maxApprovedVersion
    ) || null;

    const result = await prisma.$transaction(async (tx: any) => {
      const newVersion = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: newVersionNumber,
          editorId: currentUserIdInt,
          changeSummary: changeSummary.trim(),
          changeType: 'Edit',
          statusAtSave: versionStatus,
          approvalStatus: versionStatus,
          content: normalizedContent as any,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileUrl ? fileType || 'PDF' : null,
          fileSize: fileSize || null,
          submittedById: isDraft ? null : currentUserIdInt,
          submittedAt: isDraft ? null : now,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: priorApprovedVersion
          ? {
              // Keep the currently approved version effective and active until the new revision is approved!
              status: SYLLABUS_STATUS.APPROVED,
              currentVersionNumber: priorApprovedVersion.versionNumber,
              submittedAt: isDraft ? syllabus.submittedAt : now,
            }
          : {
              status: versionStatus,
              currentVersionNumber: newVersionNumber,
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
      description: `Created proposed revision #${proposalNumber} (Target Version ${targetOfficialVersion}) for [${syllabus.subject.code}] ${syllabus.subject.title} (${versionStatus}) — ${changeSummary.trim()}`,
      entityType: 'SyllabusVersion',
      entityId: String(result.newVersion.id),
    });

    // Notify appropriate reviewer when submitted
    if (!isDraft) {
      if (isDeptHead) {
        const deans = await prisma.user.findMany({
          where: { role: 'Dean', accountStatus: 'Active' },
          select: { id: true },
        });
        for (const dean of deans) {
          await createNotification(
            String(dean.id),
            `Dept. Head Syllabus Revision: ${syllabus.subject.code} (→ v${targetOfficialVersion})`,
            `Department Head ${user.fullName} submitted proposed changes for [${syllabus.subject.code}] ${syllabus.subject.title} for Dean approval (becomes Version ${targetOfficialVersion} upon approval).`,
            `/department/syllabus-approvals/${result.newVersion.id}`
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
            `Faculty Syllabus Revision: ${syllabus.subject.code} (→ v${targetOfficialVersion})`,
            `Faculty ${user.fullName} submitted proposed changes for [${syllabus.subject.code}] ${syllabus.subject.title} for Department Head approval (becomes Version ${targetOfficialVersion} upon approval).`,
            `/department/syllabus-approvals/${result.newVersion.id}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      syllabus: result.updatedSyllabus,
      version: result.newVersion,
      message: isDraft
        ? `Draft Proposal #${proposalNumber} saved. Submit it for approval to generate Version ${targetOfficialVersion}.`
        : isDeptHead
        ? `Proposed changes submitted to the Dean for approval. Once approved, Version ${targetOfficialVersion} will be automatically generated while retaining Version ${priorApprovedVersion?.versionNumber || 1}.`
        : `Proposed changes submitted to the Department Head for approval (Dean approval not required). Once approved, Version ${targetOfficialVersion} will be automatically generated while retaining Version ${priorApprovedVersion?.versionNumber || 1}.`,
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

    if (user.role === 'DepartmentHead') {
      const userDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!userDept || syllabus.departmentId.toUpperCase() !== userDept) {
        return NextResponse.json({ error: 'Forbidden: You may only manage syllabi within your assigned department.' }, { status: 403 });
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
