import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { SYLLABUS_STATUS } from '@/lib/status';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only the Department Head, Dean, or Administrator may approve or reject syllabi.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const { action, remarks } = await req.json();

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true, instructor: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    if (user.role === 'DepartmentHead' && (!user.departmentId || String(user.departmentId).toUpperCase() !== syllabus.departmentId.toUpperCase())) {
      return NextResponse.json({ error: 'Forbidden: You may only review syllabi for your designated department.' }, { status: 403 });
    }
    if (user.role === 'Dean' && user.departmentId && String(user.departmentId).toUpperCase() !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json({ error: 'Forbidden: You may only review syllabi for your designated department.' }, { status: 403 });
    }

    // Two-step approval chain:
    // 1. Faculty submits -> SUBMITTED -> Department Head approves -> UNDER_REVIEW (Endorsed by Dept. Head, Pending Dean)
    // 2. UNDER_REVIEW -> Dean approves -> APPROVED (Final Approved)
    if (user.role === 'Dean' && action === 'Approve' && syllabus.status === SYLLABUS_STATUS.SUBMITTED) {
      return NextResponse.json({
        error: 'This syllabus must first be approved by the Department Head before the Dean can give final approval.',
      }, { status: 400 });
    }

    const targetStatus =
      action === 'Reject'
        ? SYLLABUS_STATUS.REJECTED
        : user.role === 'DepartmentHead'
        ? SYLLABUS_STATUS.UNDER_REVIEW
        : SYLLABUS_STATUS.APPROVED;

    const versionStatus = targetStatus;
    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const now = new Date();
    const defaultRemarks =
      action === 'Reject'
        ? remarks?.trim() || `Returned for revision by ${user.role === 'Dean' ? 'Dean' : 'Department Head'}`
        : user.role === 'DepartmentHead'
        ? remarks?.trim() || `Approved by Department Head (${user.fullName}) — Pending Dean Final Approval`
        : remarks?.trim() || `Final Approved by ${user.role === 'Dean' ? 'Dean' : 'Administrator'} (${user.fullName})`;

    const updated = await prisma.$transaction(async (tx) => {
      if (targetStatus === SYLLABUS_STATUS.APPROVED) {
        await tx.syllabus.updateMany({
          where: { subjectId: syllabus.subjectId, id: { not: syllabus.id }, status: SYLLABUS_STATUS.APPROVED },
          data: { status: 'ARCHIVED' },
        });
      }

      const latestVersion = await tx.syllabusVersion.findFirst({
        where: { syllabusId: syllabus.id },
        orderBy: { versionNumber: 'desc' },
      });

      if (latestVersion) {
        await tx.syllabusVersion.update({
          where: { id: latestVersion.id },
          data: {
            approvalStatus: versionStatus,
            statusAtSave: versionStatus,
            reviewedById: currentUserIdInt,
            reviewedAt: now,
            rejectionReason: action === 'Reject' ? defaultRemarks : null,
          },
        });
      }

      return tx.syllabus.update({
        where: { id: syllabusId },
        data: {
          status: targetStatus,
          reviewerRemarks: defaultRemarks,
          reviewedAt: now,
          reviewedByUserId: currentUserIdInt,
        },
      });
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType:
        action === 'Reject'
          ? 'RejectSyllabus'
          : user.role === 'DepartmentHead'
          ? 'DeptHeadApproveSyllabus'
          : 'DeanApproveSyllabus',
      resultStatus: 'Success',
      description: `${
        action === 'Reject'
          ? 'Rejected'
          : user.role === 'DepartmentHead'
          ? 'Department Head approved (forwarded to Dean)'
          : 'Dean final approved'
      } syllabus for [${syllabus.subject.code}] ${syllabus.subject.title}${remarks ? ` – "${remarks}"` : ''}`,
      entityType: 'Syllabus',
      entityId: String(syllabus.id),
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'Reject'
          ? 'Syllabus returned for revision.'
          : user.role === 'DepartmentHead'
          ? 'Syllabus approved by Department Head and forwarded to the Dean for final approval.'
          : 'Syllabus final approved by the Dean.',
      syllabus: updated,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to process syllabus review.' }, { status: 500 });
  }
}
