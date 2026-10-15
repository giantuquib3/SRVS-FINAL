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
      return NextResponse.json({ error: 'Invalid faculty ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser || targetUser.role !== 'Educator') {
      return NextResponse.json({ error: 'Faculty member not found.' }, { status: 404 });
    }

    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to view faculty within your assigned department (${userDept || 'None'}).`,
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
        academicRank: targetUser.academicRank,
        accountStatus: targetUser.accountStatus,
        mustChangePassword: !!targetUser.mustChangePassword,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve faculty: ' + error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid faculty ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Faculty member not found.' }, { status: 404 });
    }

    if (targetUser.role !== 'Educator') {
      return NextResponse.json({ error: 'Target user is not a faculty member.' }, { status: 400 });
    }

    // Strict Department-Level Access Control
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to manage faculty within your assigned department (${userDept || 'None'}). Cross-department modifications are strictly prohibited.`,
        }, { status: 403 });
      }
    }

    const body = await req.json();
    const { fullName, email, academicRank, accountStatus, password, mustChangePassword } = body;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith('@usjr.edu.ph')) {
        return NextResponse.json({ error: 'Institutional email must end with @usjr.edu.ph.' }, { status: 400 });
      }
      updateData.email = cleanEmail;
    }
    if (academicRank !== undefined) updateData.academicRank = academicRank?.trim() || 'Faculty Member';
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

    const updatedFaculty = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
    });

    let actionType = 'FacultyUpdated';
    let description = `Updated faculty member profile for ${updatedFaculty.fullName} (${targetId})`;

    if (accountStatus && accountStatus !== targetUser.accountStatus) {
      if (accountStatus === 'Active') {
        actionType = 'FacultyActivated';
        description = `Reactivated faculty member account: ${updatedFaculty.fullName} (${targetId})`;
      } else if (accountStatus === 'Deactivated') {
        actionType = 'FacultyDeactivated';
        description = `Deactivated faculty member account: ${updatedFaculty.fullName} (${targetId})`;
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
        id: updatedFaculty.id,
        idNumber: updatedFaculty.id,
        email: updatedFaculty.email,
        fullName: updatedFaculty.fullName,
        role: updatedFaculty.role,
        departmentId: updatedFaculty.departmentId,
        departmentName: getDepartmentName(updatedFaculty.departmentId),
        academicRank: updatedFaculty.academicRank,
        accountStatus: updatedFaculty.accountStatus,
        mustChangePassword: !!updatedFaculty.mustChangePassword,
        createdAt: updatedFaculty.createdAt,
        updatedAt: updatedFaculty.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating faculty:', error);
    return NextResponse.json({ error: 'Failed to update faculty: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return PUT(req, { params });
}
