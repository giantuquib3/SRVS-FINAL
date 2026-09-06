import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only faculty, department heads, or administrators may submit a syllabus.' }, { status: 403 });
    }

    const { id, version } = params;
    const versionNum = parseInt(version, 10);

    if (isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid version number.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: { include: { department: true } },
        department: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    // Ownership check: Educator must own the syllabus (Admins can submit on behalf)
    if (user.role === 'Educator' && syllabus.instructorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You may only submit your own syllabus.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && syllabus.instructorId !== user.id && syllabus.departmentId !== user.departmentId) {
      return NextResponse.json({ error: 'Forbidden: You cannot submit a syllabus for another department.' }, { status: 403 });
    }

    // Find the specific version
    const syllabusVersion = await prisma.syllabusVersion.findUnique({
      where: {
        syllabusId_versionNumber: {
          syllabusId: id,
          versionNumber: versionNum,
        },
      },
    });

    if (!syllabusVersion) {
      return NextResponse.json({ error: `Syllabus Version ${versionNum} does not exist.` }, { status: 404 });
    }

    if (syllabusVersion.approvalStatus === 'APPROVED') {
      return NextResponse.json({ error: `Version ${versionNum} is already officially approved.` }, { status: 400 });
    }

    if (syllabusVersion.approvalStatus === 'PENDING_APPROVAL') {
      return NextResponse.json({ error: `Version ${versionNum} is already pending review.` }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update version approval status
      const updatedVersion = await tx.syllabusVersion.update({
        where: { id: syllabusVersion.id },
        data: {
          approvalStatus: 'PENDING_APPROVAL',
          statusAtSave: 'PENDING_APPROVAL',
          submittedById: user.id,
          submittedAt: now,
        },
      });

      // 2. Update syllabus status
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: 'PENDING_APPROVAL',
          submittedAt: now,
        },
      });

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'SubmitSyllabusVersion',
          resultStatus: 'Success',
          description: `Submitted syllabus [${syllabus.course.code}] Version ${versionNum} for Department Head review`,
          entityType: 'SyllabusVersion',
          entityId: updatedVersion.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { updatedSyllabus, updatedVersion };
    });

    // 4. Notify Department Head(s) of the authorized department and Administrators
    const reviewers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin', accountStatus: 'Active' },
          { role: 'DepartmentHead', departmentId: syllabus.departmentId, accountStatus: 'Active' },
        ],
      },
      select: { id: true, role: true },
    });

    for (const reviewer of reviewers) {
      // Don't notify oneself if the instructor is a Department Head
      if (reviewer.id !== user.id) {
        await createNotification(
          reviewer.id,
          `Pending Syllabus Review: ${syllabus.course.code}`,
          `You have a new syllabus awaiting review: ${syllabus.course.code} (${syllabus.course.title}) Version ${versionNum}, submitted by ${user.fullName}.`,
          `/department/syllabus-approvals/${result.updatedVersion.id}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Your ${syllabus.course.code} syllabus Version ${versionNum} has been submitted for Department Head approval.`,
      syllabus: result.updatedSyllabus,
      version: result.updatedVersion,
    });
  } catch (error: any) {
    console.error('Error submitting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to submit syllabus version for approval: ' + error.message }, { status: 500 });
  }
}
