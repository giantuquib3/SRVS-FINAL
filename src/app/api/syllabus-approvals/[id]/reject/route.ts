import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may review syllabi.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus approval request ID.' }, { status: 400 });
    }

    const { rejectionReason } = await req.json();

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json({
        error: 'A rejection reason is strictly required to provide actionable feedback for the faculty member.',
      }, { status: 400 });
    }

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: numericId },
      include: {
        syllabus: {
          include: {
            subject: true,
            instructor: true,
            department: true,
          },
        },
      },
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: numericId },
        orderBy: { versionNumber: 'desc' },
        include: {
          syllabus: {
            include: {
              subject: true,
              instructor: true,
              department: true,
            },
          },
        },
      });
    }

    if (!version) {
      return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead') {
      let deptHeadDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!deptHeadDeptId) {
        const dh = await prisma.departmentHead.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (dh?.departmentRel?.id) {
          deptHeadDeptId = dh.departmentRel.id;
        } else if (dh?.department) {
          const d = await prisma.department.findUnique({ where: { code: dh.department } });
          if (d) deptHeadDeptId = d.id;
        }
      }

      if (!deptHeadDeptId || deptHeadDeptId !== version.syllabus.departmentId) {
        return NextResponse.json({
          error: 'Forbidden: You may only review syllabi belonging to your authorized department.',
        }, { status: 403 });
      }
    }

    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({
        error: `Cannot reject: Version is currently in '${version.approvalStatus}' status, not 'PENDING_APPROVAL'.`,
      }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const currentUserId = Number(user.id);

    const hasPriorApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: syllabus.id,
        approvalStatus: 'APPROVED',
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const rejectedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: 'REJECTED',
          statusAtSave: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
          reviewedById: currentUserId,
          reviewedAt: now,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: hasPriorApprovedVersion ? 'ACTIVE' : 'REJECTED',
          reviewedAt: now,
          reviewedByUserId: currentUserId,
          reviewerRemarks: `Rejected: ${rejectionReason.trim()}`,
        },
      });

      return { rejectedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: 'RejectSyllabusVersion',
      resultStatus: 'Success',
      description: `Returned for revision: [${syllabus.subject.code}] Version ${version.versionNumber}. Reason: ${rejectionReason.trim()}`,
      entityType: 'SyllabusVersion',
      entityId: version.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    await createNotification(
      syllabus.instructorId,
      `Syllabus Returned for Revision: ${syllabus.subject.code}`,
      `Your ${syllabus.subject.code} syllabus Version ${version.versionNumber} has been returned by ${user.fullName}. Remarks: "${rejectionReason.trim()}". Please revise and resubmit.`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.subject.code} Version ${version.versionNumber} has been rejected with feedback returned to instructor.`,
      version: result.rejectedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error rejecting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to reject syllabus: ' + error.message }, { status: 500 });
  }
}
