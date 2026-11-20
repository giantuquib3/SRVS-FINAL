import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS, isDeptHeadSubmission, PROPOSAL_VERSION_OFFSET } from '@/lib/status';
import { extractReviewComments } from '@/lib/syllabus-template';
import { completeFacultyEditPermission } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean' && user.role !== 'Admin')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads, Deans, and Administrators may view syllabus approvals.',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'PENDING_APPROVAL';
    const scopeParam = searchParams.get('scope') || 'QUEUE'; // QUEUE | MY_SUBMISSIONS | ALL
    const departmentParam = searchParams.get('departmentId');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');
    const instructorParam = searchParams.get('instructorId') || searchParams.get('idNumber');
    const syllabusIdParam = searchParams.get('syllabusId');

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const where: any = {};
    let deptInfo: { id: string; code: string; name: string } | null = null;

    // Department Isolation
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) {
        return NextResponse.json({
          approvals: [],
          mySubmissions: [],
          stats: { pending: 0, approved: 0, rejected: 0, total: 0, pendingDean: 0 },
        });
      }
      deptInfo = { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) };
      where.syllabus = { departmentId: deptCode };
    } else if (user.role === 'Dean') {
      const deptCode = user.departmentId
        ? String(user.departmentId).trim().toUpperCase()
        : departmentParam
        ? String(departmentParam).trim().toUpperCase()
        : null;
      if (deptCode) {
        deptInfo = { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) };
        where.syllabus = { departmentId: deptCode };
      }
    } else if (departmentParam) {
      const deptCode = String(departmentParam).trim().toUpperCase();
      where.syllabus = { departmentId: deptCode };
      deptInfo = { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) };
    }

    // Filter by scope / role-appropriate approval queue
    if (scopeParam === 'MY_SUBMISSIONS' && user.role === 'DepartmentHead') {
      where.OR = [{ editorId: currentUserIdInt }, { submittedById: currentUserIdInt }];
    } else if (statusParam && statusParam !== 'ALL') {
      if (statusParam === 'APPROVED') {
        where.approvalStatus = SYLLABUS_STATUS.APPROVED;
      } else if (statusParam === 'REJECTED') {
        where.approvalStatus = SYLLABUS_STATUS.REJECTED;
      } else if (statusParam === 'UNDER_REVIEW') {
        where.approvalStatus = SYLLABUS_STATUS.UNDER_REVIEW;
      } else if (statusParam === 'SUBMITTED') {
        where.approvalStatus = SYLLABUS_STATUS.SUBMITTED;
      } else {
        // PENDING_APPROVAL: role-tailored pending queue!
        // - DepartmentHead reviews Faculty submissions (SUBMITTED, not self-edited)
        // - Dean reviews Department Head submissions (UNDER_REVIEW)
        // - Admin sees both
        if (user.role === 'DepartmentHead') {
          where.approvalStatus = SYLLABUS_STATUS.SUBMITTED;
        } else if (user.role === 'Dean') {
          where.approvalStatus = SYLLABUS_STATUS.UNDER_REVIEW;
        } else {
          where.approvalStatus = { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] };
        }
      }
    } else if (user.role === 'Dean' && statusParam === 'ALL' && scopeParam === 'QUEUE') {
      // Dean's queue shows Department Head submissions (UNDER_REVIEW, APPROVED/REJECTED where editor is DeptHead) or all non-draft versions
      where.approvalStatus = { not: SYLLABUS_STATUS.DRAFT };
    }

    if (syllabusIdParam) {
      const sId = parseInt(syllabusIdParam, 10);
      if (!isNaN(sId)) where.syllabusId = sId;
    }
    if (subjectIdParam) {
      const parsedSubjectId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedSubjectId)) {
        where.syllabus = { ...(where.syllabus || {}), subjectId: parsedSubjectId };
      }
    }
    if (subjectCodeParam) {
      where.syllabus = { ...(where.syllabus || {}), subject: { code: subjectCodeParam.trim().toUpperCase() } };
    }
    if (instructorParam) {
      const parsedInstId = parseInt(instructorParam, 10);
      if (!isNaN(parsedInstId)) {
        where.syllabus = { ...(where.syllabus || {}), instructorId: parsedInstId };
      }
    }

    const versions = await prisma.syllabusVersion.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        editor: { select: { id: true, fullName: true, email: true, role: true } },
        submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
        syllabus: {
          include: {
            subject: true,
            instructor: { select: { id: true, fullName: true, email: true, role: true, academicRank: true } },
          },
        },
      },
    });

    const formatVersion = (v: any) => {
      const sDept = v.syllabus.departmentId;
      const subjData = {
        id: v.syllabus.subject.id,
        code: v.syllabus.subject.code,
        title: v.syllabus.subject.title,
        units: v.syllabus.subject.units,
        departmentId: v.syllabus.subject.departmentId,
        professorName: v.syllabus.subject.professorName || null,
        department: {
          id: v.syllabus.subject.departmentId,
          code: v.syllabus.subject.departmentId,
          name: getDepartmentName(v.syllabus.subject.departmentId),
        },
      };

      const deptHeadSub = isDeptHeadSubmission(v);
      const isSelf = v.editorId === currentUserIdInt || v.submittedById === currentUserIdInt;
      const canReview =
        !isSelf &&
        ((user.role === 'Dean' && v.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW) ||
          (user.role === 'DepartmentHead' &&
            !deptHeadSub &&
            v.approvalStatus === SYLLABUS_STATUS.SUBMITTED &&
            String(user.departmentId || '').toUpperCase() === sDept.toUpperCase()));

      return {
        id: v.id,
        versionNumber: v.versionNumber,
        syllabusId: v.syllabusId,
        subjectId: v.syllabus.subjectId,
        changeSummary: v.changeSummary,
        changeType: v.changeType,
        approvalStatus: v.approvalStatus,
        statusAtSave: v.statusAtSave,
        isDeptHeadSubmission: deptHeadSub,
        isSelfSubmission: isSelf,
        canReview,
        fileName: v.fileName,
        fileUrl: v.fileUrl,
        fileType: v.fileType,
        fileSize: v.fileSize,
        editorId: v.editorId,
        editor: v.editor,
        submittedById: v.submittedById,
        submittedBy: v.submittedBy,
        submittedAt: v.submittedAt,
        reviewedById: v.reviewedById,
        reviewedBy: v.reviewedBy,
        reviewedAt: v.reviewedAt,
        rejectionReason: v.rejectionReason,
        reviewComments: extractReviewComments(v),
        content: v.content?._proposalMeta ? { _proposalMeta: v.content._proposalMeta } : undefined,
        createdAt: v.createdAt,
        syllabus: {
          id: v.syllabus.id,
          subjectId: v.syllabus.subjectId,
          courseId: v.syllabus.subjectId,
          academicYear: v.syllabus.academicYear,
          semester: v.syllabus.semester,
          section: v.syllabus.section,
          status: v.syllabus.status,
          currentVersionNumber: v.syllabus.currentVersionNumber,
          departmentId: sDept,
          department: { id: sDept, code: sDept, name: getDepartmentName(sDept) },
          subject: subjData,
          course: subjData,
          instructor: v.syllabus.instructor
            ? {
                id: v.syllabus.instructor.id,
                idNumber: v.syllabus.instructor.id,
                fullName: v.syllabus.instructor.fullName,
                email: v.syllabus.instructor.email,
                role: v.syllabus.instructor.role,
              }
            : null,
        },
      };
    };

    const formatted = versions.map(formatVersion);

    // Compute accurate role-tailored queue stats
    const baseScopeWhere: any = where.syllabus ? { syllabus: where.syllabus } : {};
    const pendingFilter =
      user.role === 'DepartmentHead'
        ? { ...baseScopeWhere, approvalStatus: SYLLABUS_STATUS.SUBMITTED }
        : user.role === 'Dean'
        ? { ...baseScopeWhere, approvalStatus: SYLLABUS_STATUS.UNDER_REVIEW }
        : { ...baseScopeWhere, approvalStatus: { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] } };

    const [pendingCount, pendingDeanCount, approvedCount, rejectedCount, myDeptHeadSubs] = await Promise.all([
      prisma.syllabusVersion.count({ where: pendingFilter }),
      prisma.syllabusVersion.count({
        where: { ...baseScopeWhere, approvalStatus: SYLLABUS_STATUS.UNDER_REVIEW },
      }),
      prisma.syllabusVersion.count({
        where: { ...baseScopeWhere, approvalStatus: SYLLABUS_STATUS.APPROVED },
      }),
      prisma.syllabusVersion.count({
        where: { ...baseScopeWhere, approvalStatus: SYLLABUS_STATUS.REJECTED },
      }),
      user.role === 'DepartmentHead'
        ? prisma.syllabusVersion.findMany({
            where: {
              syllabus: { departmentId: String(user.departmentId || '').toUpperCase() },
              OR: [{ editorId: currentUserIdInt }, { submittedById: currentUserIdInt }],
            },
            orderBy: { createdAt: 'desc' },
            include: {
              editor: { select: { id: true, fullName: true, email: true, role: true } },
              submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
              reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
              syllabus: {
                include: {
                  subject: true,
                  instructor: { select: { id: true, fullName: true, email: true, role: true, academicRank: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      role: user.role,
      department: deptInfo,
      approvals: formatted,
      mySubmissions: myDeptHeadSubs.map(formatVersion),
      stats: {
        pending: pendingCount,
        pendingDean: pendingDeanCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching syllabus approvals:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabus approvals: ' + error.message }, { status: 500 });
  }
}

async function handleReviewAction(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Deans may approve or reject proposed syllabus changes.',
      }, { status: 403 });
    }

    const body = await req.json();
    const { versionId, action, remarks } = body;

    if (!versionId || !action) {
      return NextResponse.json({ error: 'versionId and action (Approve or Reject) are required.' }, { status: 400 });
    }

    const parsedVersionId = parseInt(String(versionId), 10);
    if (isNaN(parsedVersionId)) return NextResponse.json({ error: 'Invalid version ID.' }, { status: 400 });

    const version = await prisma.syllabusVersion.findUnique({
      where: { id: parsedVersionId },
      include: {
        editor: { select: { id: true, fullName: true, role: true } },
        submittedBy: { select: { id: true, fullName: true, role: true } },
        syllabus: { include: { subject: true } },
      },
    });
    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;

    // Rule: Nobody can approve/reject their own proposed changes
    if (version.editorId === currentUserIdInt || version.submittedById === currentUserIdInt) {
      return NextResponse.json({
        error: 'Forbidden: You cannot approve or reject your own proposed syllabus changes.',
      }, { status: 403 });
    }

    // Rule: Department Head changes can ONLY be approved/rejected by the authorized Dean
    const deptHeadSub = isDeptHeadSubmission(version);
    if (deptHeadSub) {
      if (user.role !== 'Dean') {
        return NextResponse.json({
          error: 'Forbidden: Only the authorized Dean role can review and approve syllabus changes proposed by a Department Head.',
        }, { status: 403 });
      }
    } else {
      // Faculty submission: Department Head of the same department
      if (user.role !== 'DepartmentHead') {
        return NextResponse.json({
          error: 'Forbidden: Faculty syllabus submissions must be reviewed by the corresponding Department Head.',
        }, { status: 403 });
      }
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || version.syllabus.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Forbidden: Department Heads may only manage syllabi within their assigned department (${deptCode || 'None'}).`,
        }, { status: 403 });
      }
    }

    const isApprove = action.toLowerCase() === 'approve';
    const isReject = action.toLowerCase() === 'reject';

    if (!isApprove && !isReject) {
      return NextResponse.json({ error: 'Action must be Approve or Reject.' }, { status: 400 });
    }

    if (isReject && !String(remarks || '').trim()) {
      return NextResponse.json({
        error: 'Rejection requires a clear reason or review feedback.',
      }, { status: 400 });
    }

    const now = new Date();
    const targetStatus = isApprove ? SYLLABUS_STATUS.APPROVED : SYLLABUS_STATUS.REJECTED;
    const cleanRemarks = String(remarks || '').trim();
    const updatedContent = {
      ...(version.content && typeof version.content === 'object' ? (version.content as any) : {}),
      _reviewMeta: {
        reviewComments: cleanRemarks || (isApprove ? `Approved by ${user.fullName} (${user.role})` : cleanRemarks),
        reviewerName: user.fullName,
        reviewerRole: user.role,
        reviewedAt: now.toISOString(),
      },
    };

    const priorApproved = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: version.syllabusId,
        approvalStatus: SYLLABUS_STATUS.APPROVED,
        versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
        id: { not: version.id },
      },
      orderBy: { versionNumber: 'desc' },
    });

    const txResult = await prisma.$transaction(async (tx: any) => {
      let officialVersionNum = version.versionNumber;
      if (isApprove) {
        const existingApproved = await tx.syllabusVersion.findMany({
          where: {
            syllabusId: version.syllabusId,
            approvalStatus: SYLLABUS_STATUS.APPROVED,
            versionNumber: { lte: PROPOSAL_VERSION_OFFSET },
            id: { not: version.id },
          },
          select: { versionNumber: true },
        });
        const maxApproved = existingApproved.reduce((m: number, v: any) => Math.max(m, v.versionNumber), 0);
        officialVersionNum = maxApproved + 1;
        delete (updatedContent as any)._proposalMeta;
      }

      await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          ...(isApprove ? { versionNumber: officialVersionNum } : {}),
          approvalStatus: targetStatus,
          statusAtSave: targetStatus,
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          rejectionReason: isReject ? cleanRemarks : null,
          content: updatedContent,
        },
      });

      if (isApprove) {
        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: {
            status: SYLLABUS_STATUS.APPROVED,
            currentVersionNumber: officialVersionNum,
            reviewedByUserId: currentUserIdInt,
            reviewedAt: now,
            reviewerRemarks:
              cleanRemarks ||
              `Approved by ${user.role === 'Dean' ? 'Dean' : 'Department Head'} (${user.fullName}) — Official Version ${officialVersionNum}`,
          },
        });
      } else {
        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: priorApproved
            ? {
                status: SYLLABUS_STATUS.APPROVED,
                currentVersionNumber: priorApproved.versionNumber,
                reviewedByUserId: currentUserIdInt,
                reviewedAt: now,
              }
            : {
                status: SYLLABUS_STATUS.REJECTED,
                reviewedByUserId: currentUserIdInt,
                reviewedAt: now,
                reviewerRemarks: `Rejected: ${cleanRemarks}`,
              },
        });
      }

      return { officialVersionNum };
    });

    const finalVerNum = txResult.officialVersionNum;

    if (isApprove && !deptHeadSub) {
      await completeFacultyEditPermission(version.syllabusId, version.editorId);
    }

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: isApprove ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${isApprove ? `Approved & generated Version ${finalVerNum}` : 'Rejected'} [${version.syllabus.subject.code}]${cleanRemarks ? ` — Remarks: ${cleanRemarks}` : ''}`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    await createNotification(
      String(version.editorId),
      isApprove
        ? `Syllabus Approved — Official Version ${finalVerNum}: ${version.syllabus.subject.code}`
        : `Syllabus Returned for Revision: ${version.syllabus.subject.code}`,
      isApprove
        ? `${user.fullName} approved your proposed changes for [${version.syllabus.subject.code}]. Official Version ${finalVerNum} is now active.`
        : `${user.fullName} returned your proposed changes for [${version.syllabus.subject.code}] for revision. Feedback: "${cleanRemarks}"`,
      `/syllabi/${version.syllabusId}/versions`
    );

    return NextResponse.json({
      success: true,
      message: isApprove
        ? `Approved! Official Version ${finalVerNum} is now the current effective syllabus.`
        : `Proposed revision rejected with feedback. It remains preserved in version history.`,
    });
  } catch (error: any) {
    console.error('Error processing syllabus review:', error);
    return NextResponse.json({ error: 'Failed to process syllabus review: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleReviewAction(req);
}

export async function PATCH(req: NextRequest) {
  return handleReviewAction(req);
}
