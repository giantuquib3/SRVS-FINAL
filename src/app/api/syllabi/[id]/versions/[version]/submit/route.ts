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
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only faculty and department heads may submit a syllabus version.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    const versionNum = parseInt(params.version, 10);

    if (isNaN(numericId) || isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid syllabus ID or version number.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: { include: { department: true } },
        department: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    const currentUserId = Number(user.id);

    // Ownership check: Educator must own the syllabus (Admins can submit on behalf)
    if (user.role === 'Educator' && syllabus.instructorId !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden: You may only submit your own syllabus.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && syllabus.instructorId !== currentUserId && syllabus.departmentId !== Number(user.departmentId)) {
      return NextResponse.json({ error: 'Forbidden: You cannot submit a syllabus for another department.' }, { status: 403 });
    }

    // Find the specific version
    const syllabusVersion = await prisma.syllabusVersion.findUnique({
      where: {
        syllabusId_versionNumber: {
          syllabusId: numericId,
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
      const updatedVersion = await tx.syllabusVersion.update({
        where: { id: syllabusVersion.id },
        data: {
          approvalStatus: 'PENDING_APPROVAL',
          statusAtSave: 'PENDING_APPROVAL',
          submittedById: currentUserId,
          submittedAt: now,
        },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          status: 'PENDING_APPROVAL',
          submittedAt: now,
        },
      });

      return { updatedVersion, updatedSyllabus };
    });

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body is optional
    }

    const remarksSummary = body?.remarks ? ` - Remarks: "${body.remarks}"` : '';

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabusVersion',
      resultStatus: 'Success',
      description: `Submitted syllabus [${syllabus.subject.code}] Version ${versionNum} for Department Head review${remarksSummary}`,
      entityType: 'SyllabusVersion',
      entityId: syllabusVersion.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    const deptHeads = await prisma.user.findMany({
      where: {
        role: 'DepartmentHead',
        departmentId: syllabus.departmentId,
        accountStatus: 'Active',
      },
    });

    for (const dh of deptHeads) {
      await createNotification(
        dh.id,
        `Syllabus Submitted: ${syllabus.subject.code}`,
        `${user.fullName} has submitted ${syllabus.subject.code} (${syllabus.subject.title}) Version ${versionNum} for approval.`,
        `/department/syllabus-approvals/${syllabusVersion.id}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Syllabus Version ${versionNum} for ${syllabus.subject.code} has been submitted for Department Head approval.`,
      version: result.updatedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error submitting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to submit syllabus version: ' + error.message }, { status: 500 });
  }
}
