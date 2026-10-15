import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized: Session missing or expired.' }, { status: 401 });
    }

    if (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Requires Department Head or Administrator access.' }, { status: 403 });
    }

    const { id } = await params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID provided.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User registration record not found.' }, { status: 404 });
    }

    // Strict Department Isolation check for Department Heads
    if (sessionUser.role === 'DepartmentHead') {
      const deptHeadDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      const targetDept = targetUser.departmentId ? String(targetUser.departmentId).toUpperCase() : null;

      if (!deptHeadDept || targetDept !== deptHeadDept) {
        return NextResponse.json(
          {
            error: `Forbidden: Department Head is assigned to ${deptHeadDept || 'None'} and cannot approve user from department ${targetDept || 'Unknown'}. Cross-department operations are prohibited.`,
          },
          { status: 403 }
        );
      }
    }

    // Verify account is pending approval
    if (targetUser.accountStatus !== 'PendingApproval') {
      return NextResponse.json(
        {
          error: `User account is not pending approval. Current status is ${targetUser.accountStatus}.`,
        },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        accountStatus: 'Active',
        rejectionReason: null,
      },
    });

    const isStudent = updatedUser.role === 'Student';
    const auditAction = isStudent ? 'StudentApproved' : 'FacultyApproved';
    const displayRole = isStudent ? 'Student' : 'Faculty';

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || `Dept Head (${sessionUser.id})`,
      actionType: auditAction,
      resultStatus: 'Success',
      description: `Department Head [${sessionUser.fullName || sessionUser.id}] approved [${displayRole}] registration for ${updatedUser.fullName} (ID: ${updatedUser.id})`,
      entityType: 'User',
      entityId: String(updatedUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `${displayRole} registration for ${updatedUser.fullName} has been approved. The user may now log in.`,
      user: {
        id: updatedUser.id,
        idNumber: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: displayRole,
        departmentId: updatedUser.departmentId,
        accountStatus: updatedUser.accountStatus,
      },
    });
  } catch (error: any) {
    console.error('Error approving user registration:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve user registration.' }, { status: 500 });
  }
}
