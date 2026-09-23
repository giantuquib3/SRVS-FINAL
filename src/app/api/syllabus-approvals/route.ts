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
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may view syllabus approvals.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'PENDING_APPROVAL';
    const departmentParam = searchParams.get('departmentId');

    const where: any = {};
    let deptInfo: { id: string; code: string; name: string } | null = null;

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
      } else {
        where.approvalStatus = { in: ['PENDING_APPROVAL', 'Submitted', 'submitted'] };
      }
    }

    const courseParam = (searchParams.get('courseId') || searchParams.get('subjectId'))?.trim();
    const instructorParam = searchParams.get('instructorId')?.trim();
    const syllabusIdParam = searchParams.get('syllabusId')?.trim();

    if (syllabusIdParam) {
      const sId = parseInt(syllabusIdParam, 10);
      if (!isNaN(sId)) where.syllabusId = sId;
    }
    if (courseParam) {
      const parsedCourseId = parseInt(courseParam, 10);
      where.syllabus = {
        ...(where.syllabus || {}),
        ...(!isNaN(parsedCourseId) ? { courseId: parsedCourseId } : { course: { code: courseParam.toUpperCase() } }),
      };
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
            instructor: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    const formatted = versions.map((v) => {
      const sDept = v.syllabus.departmentId;
      return {
        ...v,
        syllabus: {
          ...v.syllabus,
          department: { id: sDept, code: sDept, name: getDepartmentName(sDept) },
          course: {
            ...v.syllabus.course,
            department: {
              id: v.syllabus.course.departmentId,
              code: v.syllabus.course.departmentId,
              name: getDepartmentName(v.syllabus.course.departmentId),
            },
          },
          subject: v.syllabus.course,
          subjectId: v.syllabus.courseId,
          courseId: v.syllabus.courseId,
        },
      };
    });

    const statsWhere: any = where.syllabus ? { syllabus: where.syllabus } : {};
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['PENDING_APPROVAL', 'Submitted', 'submitted'] } } }),
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads may approve/reject syllabi.' }, { status: 403 });
    }

    const body = await req.json();
    const { versionId, syllabusId, action, remarks } = body;

    if (!versionId || !action) {
      return NextResponse.json({ error: 'versionId and action are required.' }, { status: 400 });
    }

    const parsedVersionId = parseInt(String(versionId), 10);
    if (isNaN(parsedVersionId)) return NextResponse.json({ error: 'Invalid version ID.' }, { status: 400 });

    const version = await prisma.syllabusVersion.findUnique({
      where: { id: parsedVersionId },
      include: { syllabus: { include: { course: true } } },
    });
    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (deptCode && version.syllabus.departmentId !== deptCode) {
      return NextResponse.json({ error: 'You may only review syllabi within your department.' }, { status: 403 });
    }

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isApprove = action === 'Approve' || action === 'APPROVE';
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: isApprove ? 'APPROVED' : 'REJECTED',
          reviewedById: currentUserIdInt,
          reviewedAt: now,
          statusAtSave: isApprove ? 'APPROVED' : 'REJECTED',
        },
      });

      if (isApprove) {
        // Archive all previously active syllabi for this course
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
          data: { status: 'ACTIVE', reviewedAt: now, reviewedByUserId: currentUserIdInt, reviewerRemarks: remarks || 'Approved' },
        });
      } else {
        await tx.syllabus.update({
          where: { id: version.syllabusId },
          data: { status: 'REJECTED', reviewedAt: now, reviewedByUserId: currentUserIdInt, reviewerRemarks: remarks || 'Rejected' },
        });
      }
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: isApprove ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${isApprove ? 'Approved' : 'Rejected'} syllabus v${version.versionNumber} for ${version.syllabus.course.code}${remarks ? ` – Remarks: ${remarks}` : ''}`,
      entityType: 'Syllabus',
      entityId: String(version.syllabusId),
    });

    return NextResponse.json({
      success: true,
      message: `Syllabus ${isApprove ? 'approved' : 'rejected'} successfully.`,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to review syllabus: ' + error.message }, { status: 500 });
  }
}
