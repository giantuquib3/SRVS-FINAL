import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

// POST /api/department-head/student-registrations/[id]/approve - Approve student registration
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const targetId = parseInt(params.id, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid registration ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser || targetUser.role !== 'Student') {
      return NextResponse.json({ error: 'Student registration record not found.' }, { status: 404 });
    }

    // Strict Department-Level Access Control (Requirement 6 & 7)
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to approve student registrations for your assigned department (${userDept || 'None'}). Cross-department approval is strictly prohibited.`,
        }, { status: 403 });
      }
    }

    const updatedStudent = await prisma.user.update({
      where: { id: targetId },
      data: {
        accountStatus: 'Active',
        rejectionReason: null,
      },
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType: 'StudentRegistrationApproved',
      resultStatus: 'Success',
      description: `Approved student registration for [Student] ${updatedStudent.fullName} (ID: ${targetId}, Dept: ${updatedStudent.departmentId}) by ${sessionUser.role} ${sessionUser.fullName || sessionUser.id}`,
      entityType: 'User',
      entityId: String(targetId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `Student registration for ${updatedStudent.fullName} has been approved. The student may now log in.`,
      student: {
        id: updatedStudent.id,
        idNumber: updatedStudent.id,
        email: updatedStudent.email,
        fullName: updatedStudent.fullName,
        role: updatedStudent.role,
        departmentId: updatedStudent.departmentId,
        departmentName: getDepartmentName(updatedStudent.departmentId),
        accountStatus: updatedStudent.accountStatus,
        yearLevel: updatedStudent.yearLevel,
        program: updatedStudent.program,
        updatedAt: updatedStudent.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error approving student registration:', error);
    return NextResponse.json({ error: 'Failed to approve registration: ' + error.message }, { status: 500 });
  }
}
