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
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may approve syllabi.' }, { status: 403 });
    }

    const { id } = params;
    let comments = '';
    try {
      const body = await req.json();
      comments = body?.comments || '';
    } catch {
      // Body is optional on approve
    }

    const version = await prisma.syllabusVersion.findUnique({
      where: { id },
      include: {
        syllabus: {
          include: {
            course: true,
            instructor: true,
            department: true,
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });
    }

    // 1. Department Authorization Check
    if (user.role === 'DepartmentHead' && user.departmentId !== version.syllabus.departmentId) {
      return NextResponse.json({
        error: 'Forbidden: You may only approve syllabi belonging to your authorized department.',
      }, { status: 403 });
    }

    // 2. Self-Approval Prevention Check
    const isSelfSubmission =
      user.id === version.submittedById ||
      user.id === version.syllabus.instructorId;

    if (isSelfSubmission) {
      return NextResponse.json({
        error: 'Self-approval is strictly prohibited. Syllabi submitted by a Department Head must be reviewed and approved by another authorized reviewer or administrator.',
      }, { status: 403 });
    }

    // 3. Status Check
    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({
        error: `Cannot approve: Version is currently in '${version.approvalStatus}' status, not 'PENDING_APPROVAL'.`,
      }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;

    // 4. Atomic Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Update Syllabus Version to APPROVED
      const approvedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: 'APPROVED',
          statusAtSave: 'APPROVED',
          reviewedById: user.id,
          reviewedAt: now,
          rejectionReason: null,
        },
      });

      // B. Update Syllabus: make this version the official current version and set status ACTIVE
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          currentVersionNumber: version.versionNumber,
          status: 'ACTIVE',
          reviewedAt: now,
          reviewedByUserId: user.id,
          reviewerRemarks: comments.trim() || 'Approved',
        },
      });

      // C. Record in SyllabusApprovalLog
      const approvalLog = await tx.syllabusApprovalLog.create({
        data: {
          syllabusVersionId: version.id,
          reviewerId: user.id,
          decision: 'APPROVED',
          comments: comments.trim() || 'Approved and designated as official syllabus version',
          createdAt: now,
        },
      });

      // D. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'ApproveSyllabusVersion',
          resultStatus: 'Success',
          description: `Approved [${syllabus.course.code}] Version ${version.versionNumber} as the official current syllabus for ${syllabus.semester}, AY ${syllabus.academicYear}`,
          entityType: 'SyllabusVersion',
          entityId: version.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { approvedVersion, updatedSyllabus, approvalLog };
    });

    // 5. Notify Faculty
    const instructorId = syllabus.instructorId;
    if (instructorId) {
      await createNotification(
        instructorId,
        `Syllabus Approved: ${syllabus.course.code}`,
        `Your ${syllabus.course.code} syllabus Version ${version.versionNumber} has been approved by ${user.fullName} (${user.role}). It is now active and available to enrolled students.`,
        `/syllabi/${syllabus.id}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.course.code} Version ${version.versionNumber} approved successfully. It is now the official active version.`,
      version: result.approvedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error approving syllabus version:', error);
    return NextResponse.json({ error: 'Failed to approve syllabus: ' + error.message }, { status: 500 });
  }
}
