import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import {
  getEditRequestById,
  updateEditPermissionRequestStatus,
} from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the assigned Department Head may grant, deny, or revoke Faculty syllabus edit permissions.',
        },
        { status: 403 }
      );
    }

    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return NextResponse.json({ error: 'Invalid edit permission request ID.' }, { status: 400 });
    }

    const existing = await getEditRequestById(requestId);
    if (!existing) {
      return NextResponse.json({ error: 'Edit permission request not found.' }, { status: 404 });
    }

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (!userDeptCode || userDeptCode !== existing.departmentId.toUpperCase()) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Department Heads may only manage edit permission requests within their assigned department.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = String(body?.action || '').trim().toUpperCase();
    const remarks = String(body?.remarks || '').trim();

    if (action !== 'APPROVE' && action !== 'REJECT' && action !== 'REVOKE') {
      return NextResponse.json(
        { error: 'Invalid action. Expected APPROVE, REJECT, or REVOKE.' },
        { status: 400 }
      );
    }

    if (action === 'APPROVE' && existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Only PENDING requests can be granted (current status: ${existing.status}).` },
        { status: 400 }
      );
    }

    if (action === 'REJECT' && existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Only PENDING requests can be denied (current status: ${existing.status}).` },
        { status: 400 }
      );
    }

    if (action === 'REVOKE' && existing.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Only active APPROVED permissions can be revoked (current status: ${existing.status}).` },
        { status: 400 }
      );
    }

    if ((action === 'REJECT' || action === 'REVOKE') && !remarks) {
      return NextResponse.json(
        { error: 'Please provide a brief reason/remarks when denying or revoking edit permission.' },
        { status: 400 }
      );
    }

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const finalRemarks =
      remarks ||
      (action === 'APPROVE'
        ? `Edit permission granted by Department Head (${user.fullName}).`
        : 'Edit permission denied by Department Head.');

    const updated = await updateEditPermissionRequestStatus({
      requestId: existing.id,
      status: newStatus,
      reviewedById: currentUserIdInt,
      reviewRemarks: finalRemarks,
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType:
        action === 'APPROVE'
          ? 'GrantSyllabusEditPermission'
          : action === 'REVOKE'
          ? 'RevokeSyllabusEditPermission'
          : 'DenySyllabusEditPermission',
      resultStatus: 'Success',
      description: `${
        action === 'APPROVE' ? 'Granted' : action === 'REVOKE' ? 'Revoked' : 'Denied'
      } syllabus edit permission for ${existing.faculty.fullName} on [${existing.syllabus.subject.code}] ${existing.syllabus.subject.title}${
        remarks ? ` — Remarks: ${remarks}` : ''
      }`,
      entityType: 'SyllabusEditRequest',
      entityId: String(existing.id),
    });

    await createNotification(
      String(existing.facultyId),
      action === 'APPROVE'
        ? `Edit Permission Granted: ${existing.syllabus.subject.code}`
        : action === 'REVOKE'
        ? `Edit Permission Revoked: ${existing.syllabus.subject.code}`
        : `Edit Permission Denied: ${existing.syllabus.subject.code}`,
      action === 'APPROVE'
        ? `Department Head ${user.fullName} granted your request to edit [${existing.syllabus.subject.code}] ${existing.syllabus.subject.title}. You may now edit the syllabus and submit your proposed changes for Department Head approval.`
        : `Department Head ${user.fullName} ${action === 'REVOKE' ? 'revoked' : 'denied'} your edit permission for [${existing.syllabus.subject.code}] ${existing.syllabus.subject.title}. Reason: ${finalRemarks}`,
      action === 'APPROVE' ? `/syllabi/${existing.syllabusId}/edit` : `/syllabi/${existing.syllabusId}`
    );

    return NextResponse.json({
      success: true,
      request: updated,
      message:
        action === 'APPROVE'
          ? `Edit permission granted to ${existing.faculty.fullName} for [${existing.syllabus.subject.code}].`
          : action === 'REVOKE'
          ? `Edit permission revoked from ${existing.faculty.fullName} for [${existing.syllabus.subject.code}].`
          : `Edit permission request from ${existing.faculty.fullName} denied.`,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus edit permission request:', error);
    return NextResponse.json({ error: 'Failed to update edit permission request.' }, { status: 500 });
  }
}

