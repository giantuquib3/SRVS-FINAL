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

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus approval request ID.' }, { status: 400 });
    }

    let comments = '';
    try {
      const body = await req.json();
      comments = body?.comments || '';
    } catch {
      // Body is optional on approve
    }

    const version = await prisma.syllabusVersion.findUnique({
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
      return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== version.syllabus.departmentId) {
      return NextResponse.json({
        error: 'Forbidden: You may only approve syllabi belonging to your authorized department.',
      }, { status: 403 });
    }

    if (version.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({
        error: `Cannot approve: Version is currently in '${version.approvalStatus}' status, not 'PENDING_APPROVAL'.`,
      }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const currentUserId = Number(user.id);

    const result = await prisma.$transaction(async (tx) => {
      const approvedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: {
          approvalStatus: 'APPROVED',
          statusAtSave: 'APPROVED',
          reviewedById: currentUserId,
          reviewedAt: now,
          rejectionReason: null,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          currentVersionNumber: version.versionNumber,
          status: 'ACTIVE',
          reviewedAt: now,
          reviewedByUserId: currentUserId,
          reviewerRemarks: comments.trim() || 'Approved',
        },
      });

      return { approvedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: 'ApproveSyllabusVersion',
      resultStatus: 'Success',
      description: `Approved [${syllabus.subject.code}] Version ${version.versionNumber} as official syllabus for ${syllabus.semester}, AY ${syllabus.academicYear}`,
      entityType: 'SyllabusVersion',
      entityId: version.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    await createNotification(
      syllabus.instructorId,
      `Syllabus Approved: ${syllabus.subject.code}`,
      `Your ${syllabus.subject.code} syllabus Version ${version.versionNumber} has been approved by ${user.fullName}. It is now active and available to enrolled students.`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus for ${syllabus.subject.code} Version ${version.versionNumber} approved successfully. It is now the official active version.`,
      version: result.approvedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error approving syllabus version:', error);
    return NextResponse.json({ error: 'Failed to approve syllabus: ' + error.message }, { status: 500 });
  }
}
