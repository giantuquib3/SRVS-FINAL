import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Administrators may view syllabus approvals.',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'SUBMITTED';
    const departmentParam = searchParams.get('departmentId');
    const courseIdParam = searchParams.get('courseId');
    const courseCodeParam = searchParams.get('courseCode');
    const instructorParam = searchParams.get('instructorId') || searchParams.get('idNumber');
    const syllabusIdParam = searchParams.get('syllabusId');

    const where: any = {};
    let deptInfo: { id: string; code: string; name: string } | null = null;

    // Department Isolation (Requirement 21)
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ approvals: [], stats: { pending: 0, approved: 0, rejected: 0, total: 0 } });
      deptInfo = { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) };
      where.syllabus = { departmentId: deptCode };
    } else if (departmentParam) {
      const deptCode = String(departmentParam).trim().toUpperCase();
      where.syllabus = { departmentId: deptCode };
      deptInfo = { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) };
    }

    if (statusParam && statusParam !== 'ALL') {
      if (statusParam === 'APPROVED') {
        where.approvalStatus = { in: ['APPROVED', 'Approved'] };
      } else if (statusParam === 'REJECTED') {
        where.approvalStatus = { in: ['REJECTED', 'Rejected'] };
      } else if (statusParam === 'UNDER_REVIEW') {
        where.approvalStatus = { in: ['UNDER_REVIEW', 'Under Review'] };
      } else {
        where.approvalStatus = { in: ['SUBMITTED', 'PENDING_APPROVAL', 'Submitted', 'submitted', 'UNDER_REVIEW', 'Under Review'] };
      }
    }

    if (syllabusIdParam) {
      const sId = parseInt(syllabusIdParam, 10);
      if (!isNaN(sId)) where.syllabusId = sId;
    }
    if (courseIdParam) {
      const parsedCourseId = parseInt(courseIdParam, 10);
      if (!isNaN(parsedCourseId)) {
        where.syllabus = { ...(where.syllabus || {}), courseId: parsedCourseId };
      }
    }
    if (courseCodeParam) {
      where.syllabus = { ...(where.syllabus || {}), course: { code: courseCodeParam.trim().toUpperCase() } };
    }
    if (instructorParam) {
      const parsedInstId = parseInt(instructorParam, 10);
      if (!isNaN(parsedInstId)) {
        where.syllabus = { ...(where.syllabus || {}), instructorId: parsedInstId };
      }
    }

    const versions = await prisma.syllabusVersion.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        syllabus: {
          include: {
            course: true,
            instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
          },
        },
      },
    });

    const formatted = versions.map((v: any) => {
      const sDept = v.syllabus.departmentId;
      return {
        id: v.id,
        versionNumber: v.versionNumber,
        syllabusId: v.syllabusId,
        changeSummary: v.changeSummary,
        approvalStatus: v.approvalStatus,
        statusAtSave: v.statusAtSave,
        fileName: v.fileName,
        fileUrl: v.fileUrl,
        fileType: v.fileType,
        fileSize: v.fileSize,
        submittedAt: v.submittedAt,
        submittedById: v.submittedById,
        reviewedAt: v.reviewedAt,
        reviewedById: v.reviewedById,
        rejectionReason: v.rejectionReason,
        content: v.content,
        syllabus: {
          id: v.syllabus.id,
          academicYear: v.syllabus.academicYear,
          semester: v.syllabus.semester,
          section: v.syllabus.section,
          status: v.syllabus.status,
          departmentId: sDept,
          department: { id: sDept, code: sDept, name: getDepartmentName(sDept) },
          course: {
            id: v.syllabus.course.id,
            code: v.syllabus.course.code,
            title: v.syllabus.course.title,
            units: v.syllabus.course.units,
            departmentId: v.syllabus.course.departmentId,
            professorName: v.syllabus.course.professorName || null,
            department: {
              id: v.syllabus.course.departmentId,
              code: v.syllabus.course.departmentId,
              name: getDepartmentName(v.syllabus.course.departmentId),
            },
          },
          instructor: v.syllabus.instructor
            ? {
                id: v.syllabus.instructor.id,
                idNumber: v.syllabus.instructor.id,
                fullName: v.syllabus.instructor.fullName,
                email: v.syllabus.instructor.email,
              }
            : null,
        },
      };
    });

    const statsWhere: any = where.syllabus ? { syllabus: where.syllabus } : {};
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['SUBMITTED', 'PENDING_APPROVAL', 'Submitted', 'submitted', 'UNDER_REVIEW', 'Under Review'] } } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['APPROVED', 'Approved'] } } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['REJECTED', 'Rejected'] } } }),
    ]);

    return NextResponse.json({
      department: deptInfo,
      approvals: formatted,
      stats: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount, total: pendingCount + approvedCount + rejectedCount },
    });
  } catch (error: any) {
    console.error('Error fetching syllabus approvals:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabus approvals: ' + error.message }, { status: 500 });
  }
}

async function handleReviewAction(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads may approve or reject syllabi.' }, { status: 403 });
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
      include: { syllabus: { include: { course: true } } },
    });
    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    // Department Isolation (Requirement 21)
    const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (deptCode && version.syllabus.departmentId.toUpperCase() !== deptCode) {
      return NextResponse.json({
        error: `Forbidden: You may only review syllabi within your assigned department (${deptCode}).`,
      }, { status: 403 });
    }

    // Reviewer identity strictly derived from authenticated session (Requirement 10)
    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isApprove = action.toLowerCase() === 'approve';
    const isReject = action.toLowerCase() === 'reject';
    const isUnderReview = action.toLowerCase() === 'under_review' || action.toLowerCase() === 'under review';

    if (!isApprove && !isReject && !isUnderReview) {
      return NextResponse.json({ error: 'Action must be Approve, Reject, or Under_Review.' }, { status: 400 });
    }

    const now = new Date();
    const targetStatus = isApprove ? 'APPROVED' : (isReject ? 'REJECTED' : 'UNDER_REVIEW');

    await prisma.$transaction(async (tx) => {
      await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: targetStatus,
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          statusAtSave: targetStatus,
          rejectionReason: isReject ? (remarks || 'Rejected with feedback') : null,
        },
      });

      if (isApprove) {
        // Archive previously active versions for this course
        await tx.syllabus.updateMany({
          where: {
            courseId: version.syllabus.courseId,
            id: { not: version.syllabusId },
            status: { in: ['ACTIVE', 'Active', 'Approved', 'APPROVED'] },
          },
          data: { status: 'ARCHIVED' },
        });

        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: {
            status: 'APPROVED',
            currentVersionNumber: version.versionNumber,
            reviewedAt: now,
            reviewedByUserId: currentUserIdInt,
            reviewerRemarks: remarks || 'Approved by Department Head',
          },
        });
      } else if (isReject) {
        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: {
            status: 'REJECTED',
            reviewedAt: now,
            reviewedByUserId: currentUserIdInt,
            reviewerRemarks: remarks || 'Rejected by Department Head',
          },
        });
      } else {
        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: {
            status: 'UNDER_REVIEW',
            reviewedAt: now,
            reviewedByUserId: currentUserIdInt,
          },
        });
      }
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: isApprove ? 'ApproveSyllabus' : (isReject ? 'RejectSyllabus' : 'ReviewSyllabus'),
      resultStatus: 'Success',
      description: `${action} syllabus v${version.versionNumber} for [${version.syllabus.course.code}]${remarks ? ` – Remarks: ${remarks}` : ''}`,
      entityType: 'Syllabus',
      entityId: String(version.syllabusId),
    });

    return NextResponse.json({
      success: true,
      message: `Syllabus v${version.versionNumber} ${targetStatus.toLowerCase()} successfully.`,
      status: targetStatus,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to process review action: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleReviewAction(req);
}

export async function PATCH(req: NextRequest) {
  return handleReviewAction(req);
}
