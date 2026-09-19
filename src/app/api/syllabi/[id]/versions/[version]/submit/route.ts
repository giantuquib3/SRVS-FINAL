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
      return NextResponse.json({ error: 'Unauthorized: Only educators and department heads may submit a syllabus version.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    const versionNum = parseInt(params.version, 10);

    if (isNaN(syllabusId) || isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid syllabus ID or version number.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { course: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (user.role === 'Educator' && syllabus.instructorId !== currentUserIdInt) {
      return NextResponse.json({ error: 'Forbidden: You may only submit your own syllabus.' }, { status: 403 });
    }

    if (user.role === 'DepartmentHead' && syllabus.departmentId !== userDeptCode) {
      return NextResponse.json({ error: 'Forbidden: You cannot submit a syllabus for another department.' }, { status: 403 });
    }

    const syllabusVersion = await prisma.syllabusVersion.findUnique({
      where: { syllabusId_versionNumber: { syllabusId, versionNumber: versionNum } },
    });

    if (!syllabusVersion) {
      return NextResponse.json({ error: `Syllabus Version ${versionNum} does not exist.` }, { status: 404 });
    }
    if (syllabusVersion.approvalStatus === 'APPROVED') {
      return NextResponse.json({ error: `Version ${versionNum} is already approved.` }, { status: 400 });
    }
    if (syllabusVersion.approvalStatus === 'PENDING_APPROVAL') {
      return NextResponse.json({ error: `Version ${versionNum} is already pending review.` }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedVersion = await tx.syllabusVersion.update({
        where: { id: syllabusVersion.id },
        data: { approvalStatus: 'PENDING_APPROVAL', statusAtSave: 'PENDING_APPROVAL', submittedById: currentUserIdInt, submittedAt: now },
      });
      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabusId },
        data: { status: 'PENDING_APPROVAL', submittedAt: now },
      });
      return { updatedVersion, updatedSyllabus };
    });

    let body: any = {};
    try { body = await req.json(); } catch (e) { /* optional body */ }
    const remarksSummary = body?.remarks ? ` – Remarks: "${body.remarks}"` : '';

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabusVersion',
      resultStatus: 'Success',
      description: `Submitted syllabus [${syllabus.course.code}] Version ${versionNum} for review${remarksSummary}`,
      entityType: 'SyllabusVersion',
      entityId: String(syllabusVersion.id),
    });

    // Notify dept heads in this department
    const deptHeads = await prisma.user.findMany({
      where: { role: 'DepartmentHead', departmentId: syllabus.departmentId, accountStatus: 'Active' },
      select: { id: true },
    });

    for (const dh of deptHeads) {
      await createNotification(
        String(dh.id),
        `Syllabus Submitted: ${syllabus.course.code}`,
        `${user.fullName} submitted ${syllabus.course.code} (${syllabus.course.title}) v${versionNum} for approval.`,
        `/department/syllabus-approvals/${syllabusVersion.id}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Version ${versionNum} for ${syllabus.course.code} submitted for Department Head approval.`,
      version: result.updatedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error submitting syllabus version:', error);
    return NextResponse.json({ error: 'Failed to submit syllabus version: ' + error.message }, { status: 500 });
  }
}
