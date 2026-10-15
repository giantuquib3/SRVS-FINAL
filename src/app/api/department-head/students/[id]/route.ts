import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const targetId = parseInt(params.id, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid student ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser || targetUser.role !== 'Student') {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to view students within your assigned department (${userDept || 'None'}).`,
        }, { status: 403 });
      }
    }

    return NextResponse.json({
      user: {
        id: targetUser.id,
        idNumber: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        departmentId: targetUser.departmentId,
        departmentName: getDepartmentName(targetUser.departmentId),
        yearLevel: targetUser.yearLevel,
        program: targetUser.program,
        accountStatus: targetUser.accountStatus,
        mustChangePassword: !!targetUser.mustChangePassword,
        rejectionReason: targetUser.rejectionReason,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve student: ' + error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const targetId = parseInt(params.id, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid student ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (targetUser.role !== 'Student') {
      return NextResponse.json({ error: 'Target user is not a student.' }, { status: 400 });
    }

    // Strict Department-Level Access Control
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to manage students within your assigned department (${userDept || 'None'}). Cross-department modifications are strictly prohibited.`,
        }, { status: 403 });
      }
    }

    const body = await req.json();
    const { fullName, email, yearLevel, program, accountStatus, password, mustChangePassword } = body;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith('@usjr.edu.ph')) {
        return NextResponse.json({ error: 'Institutional email must end with @usjr.edu.ph.' }, { status: 400 });
      }
      updateData.email = cleanEmail;
    }
    if (yearLevel !== undefined) updateData.yearLevel = yearLevel?.trim() || '1st Year';
    if (program !== undefined) updateData.program = program?.trim() || null;
    if (accountStatus) {
      if (!['Active', 'Deactivated', 'PendingApproval', 'Rejected'].includes(accountStatus)) {
        return NextResponse.json({ error: 'Invalid accountStatus.' }, { status: 400 });
      }
      updateData.accountStatus = accountStatus;
    }
    if (mustChangePassword !== undefined) {
      updateData.mustChangePassword = Boolean(mustChangePassword);
    }
    if (password) {
      updateData.passwordHash = await hashPassword(password);
      updateData.mustChangePassword = true;
    }

    const updatedStudent = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
    });

    let actionType = 'StudentUpdated';
    let description = `Updated student profile for ${updatedStudent.fullName} (${targetId})`;

    if (accountStatus && accountStatus !== targetUser.accountStatus) {
      if (accountStatus === 'Active') {
        actionType = 'StudentActivated';
        description = `Reactivated student account: ${updatedStudent.fullName} (${targetId})`;
      } else if (accountStatus === 'Deactivated') {
        actionType = 'StudentDeactivated';
        description = `Deactivated student account: ${updatedStudent.fullName} (${targetId})`;
      }
    }

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType,
      resultStatus: 'Success',
      description,
      entityType: 'User',
      entityId: String(targetId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedStudent.id,
        idNumber: updatedStudent.id,
        email: updatedStudent.email,
        fullName: updatedStudent.fullName,
        role: updatedStudent.role,
        departmentId: updatedStudent.departmentId,
        departmentName: getDepartmentName(updatedStudent.departmentId),
        yearLevel: updatedStudent.yearLevel,
        program: updatedStudent.program,
        accountStatus: updatedStudent.accountStatus,
        mustChangePassword: !!updatedStudent.mustChangePassword,
        createdAt: updatedStudent.createdAt,
        updatedAt: updatedStudent.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return PUT(req, { params });
}
