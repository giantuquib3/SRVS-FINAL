import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads, Deans, and Administrators may approve syllabi.' }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    let comments = '';
    try { const body = await req.json(); comments = body?.comments || ''; } catch { /* optional */ }

    // Try to find as SyllabusVersion id first, then as Syllabus id
    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include: { syllabus: { include: { subject: true, instructor: true } } },
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include: { syllabus: { include: { subject: true, instructor: true } } },
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus version not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode || deptCode !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({ error: 'Forbidden: You may only approve syllabi in your designated department.' }, { status: 403 });
      }
    } else if (user.role === 'Dean' && user.departmentId) {
      const deptCode = String(user.departmentId).trim().toUpperCase();
      if (deptCode !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({ error: 'Forbidden: You may only approve syllabi in your designated department.' }, { status: 403 });
      }
    }

    if (version.approvalStatus !== SYLLABUS_STATUS.SUBMITTED && version.approvalStatus !== SYLLABUS_STATUS.UNDER_REVIEW) {
      return NextResponse.json({ error: `Cannot approve: Version is in '${version.approvalStatus}' status.` }, { status: 400 });
    }

    if (user.role === 'Dean' && version.approvalStatus === SYLLABUS_STATUS.SUBMITTED) {
      return NextResponse.json({
        error: 'This syllabus must first be approved by the Department Head before the Dean can give final approval.',
      }, { status: 400 });
    }

    const now = new Date();
    const syllabus = version.syllabus;
    const currentUserIdInt = parseInt(user.id, 10) || 0;

    // Department Head approval moves SUBMITTED -> UNDER_REVIEW (Pending Dean Approval)
    // Dean (or Admin) approval moves UNDER_REVIEW -> APPROVED (Final Approved)
    const targetStatus = user.role === 'DepartmentHead' ? SYLLABUS_STATUS.UNDER_REVIEW : SYLLABUS_STATUS.APPROVED;
    const defaultRemarks =
      user.role === 'DepartmentHead'
        ? comments.trim() || `Approved by Department Head (${user.fullName}) — Pending Dean Final Approval`
        : comments.trim() || `Final Approved by ${user.role === 'Dean' ? 'Dean' : 'Administrator'} (${user.fullName})`;

    const result = await prisma.$transaction(async (tx) => {
      if (targetStatus === SYLLABUS_STATUS.APPROVED) {
        await tx.syllabus.updateMany({
          where: { subjectId: syllabus.subjectId, id: { not: syllabus.id }, status: SYLLABUS_STATUS.APPROVED },
          data: { status: 'ARCHIVED' },
        });
      }

      const approvedVersion = await tx.syllabusVersion.update({
        where: { id: version.id },
        data: { approvalStatus: targetStatus, statusAtSave: targetStatus, reviewedById: currentUserIdInt, reviewedAt: now, rejectionReason: null },
      });

      const updatedSyllabus = await tx.syllabus.update({
        where: { id: syllabus.id },
        data: { currentVersionNumber: version.versionNumber, status: targetStatus, reviewedAt: now, reviewedByUserId: currentUserIdInt, reviewerRemarks: defaultRemarks },
      });

      return { approvedVersion, updatedSyllabus };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: user.role === 'DepartmentHead' ? 'DeptHeadApproveSyllabusVersion' : 'DeanApproveSyllabusVersion',
      resultStatus: 'Success',
      description:
        user.role === 'DepartmentHead'
          ? `Department Head approved [${syllabus.subject.code}] v${version.versionNumber} — forwarded to Dean`
          : `Dean final approved [${syllabus.subject.code}] v${version.versionNumber} for ${syllabus.semester}, AY ${syllabus.academicYear}`,
      entityType: 'SyllabusVersion',
      entityId: String(version.id),
    });

    return NextResponse.json({
      success: true,
      message:
        user.role === 'DepartmentHead'
          ? `Syllabus for ${syllabus.subject.code} v${version.versionNumber} approved by Department Head and forwarded to the Dean for final approval.`
          : `Syllabus for ${syllabus.subject.code} v${version.versionNumber} final approved by the Dean and is now the official active version.`,
      version: result.approvedVersion,
      syllabus: result.updatedSyllabus,
    });
  } catch (error: any) {
    console.error('Error approving syllabus:', error);
    return NextResponse.json({ error: 'Failed to approve syllabus: ' + error.message }, { status: 500 });
  }
}
