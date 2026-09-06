import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where: any = {};
    if (status) where.accountStatus = status;
    if (role) where.role = role;
    if (search && search.trim()) {
      where.OR = [
        { fullName: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { id: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Dept Head only sees their department users
    if (user.role === 'DepartmentHead' && user.departmentId) {
      where.departmentId = user.departmentId;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        department: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, email, username, idNumber, password, role, departmentId, accountStatus } = body;

    if (!fullName || !email || !password || !role) {
      return NextResponse.json({ error: 'Full name, email, password, and role are required.' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedId = (idNumber || username || '').trim();

    if (!trimmedId) {
      return NextResponse.json({ error: 'University ID Number is required.' }, { status: 400 });
    }

    if (role === 'Student') {
      if (!/^\d{10}$/.test(trimmedId)) {
        return NextResponse.json({
          error: 'Student ID number must be exactly 10 digits (e.g. 2022012708).',
        }, { status: 400 });
      }
    } else {
      if (!/^\d{5}$/.test(trimmedId)) {
        return NextResponse.json({
          error: 'Admin, Faculty, and Department Head ID numbers must be exactly 5 digits (e.g. 00000 or 10001).',
        }, { status: 400 });
      }
    }

    // Check duplicate
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedEmail },
          { id: trimmedId },
        ],
      },
    });

    if (existing) {
      if (existing.id === trimmedId) {
        return NextResponse.json({ error: `An account with ID Number ${trimmedId} already exists.` }, { status: 400 });
      }
      return NextResponse.json({ error: 'A user with this email address already exists.' }, { status: 400 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newUser = await prisma.user.create({
      data: {
        id: trimmedId, // Primary key is ID Number
        fullName: fullName.trim(),
        firstName,
        lastName,
        email: trimmedEmail,
        passwordHash,
        role,
        departmentId: departmentId || null,
        accountStatus: accountStatus || 'Active',
      },
      include: {
        department: true,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateUser',
      resultStatus: 'Success',
      description: `Created user account for ${newUser.fullName} (${newUser.email}) with role ${newUser.role}`,
      entityType: 'User',
      entityId: newUser.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user account.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { userId, action, newRole } = await req.json(); // action: "Approve" | "Reject" | "Deactivate" | "Activate" | "ChangeRole"

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && targetUser.departmentId !== user.departmentId) {
      return NextResponse.json({ error: 'Department Heads may only manage users in their assigned department.' }, { status: 403 });
    }

    let updatedStatus = targetUser.accountStatus;
    let updatedRole = targetUser.role;

    if (action === 'Approve') {
      updatedStatus = 'Active';
    } else if (action === 'Reject') {
      updatedStatus = 'Rejected';
    } else if (action === 'Deactivate') {
      updatedStatus = 'Deactivated';
    } else if (action === 'Activate') {
      updatedStatus = 'Active';
    } else if (action === 'ChangeRole' && newRole) {
      if (user.role !== 'Admin') {
        return NextResponse.json({ error: 'Only administrators may alter user roles.' }, { status: 403 });
      }
      updatedRole = newRole;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: updatedStatus,
        role: updatedRole,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: `User${action}`,
      resultStatus: 'Success',
      description: `${action}d account for ${targetUser.fullName} (${targetUser.email}). Status: ${updatedStatus}, Role: ${updatedRole}`,
      entityType: 'User',
      entityId: targetUser.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    if (action === 'Approve') {
      await createNotification(
        targetUser.id,
        'Account Approved',
        'Your registration has been approved. You now have full access to SRVS.',
        '/'
      );
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only administrators may delete user accounts.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own administrator account.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Check if user has authored syllabus versions
    const versionsCount = await prisma.syllabusVersion.count({
      where: { editorId: userId },
    });

    if (versionsCount > 0) {
      // Deactivate instead to preserve version audit trail integrity
      await prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'Deactivated' },
      });

      await logAuditEvent({
        userId: user.id,
        userDisplayName: user.fullName,
        actionType: 'DeactivateUser',
        resultStatus: 'Success',
        description: `Account for ${targetUser.fullName} (${targetUser.email}) deactivated (preserved audit integrity for ${versionsCount} version records).`,
        entityType: 'User',
        entityId: targetUser.id,
        ipAddress: req.ip || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Account has historical syllabus records and was deactivated to maintain audit integrity.`,
      });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'DeleteUser',
      resultStatus: 'Success',
      description: `Permanently deleted user account for ${targetUser.fullName} (${targetUser.email})`,
      entityType: 'User',
      entityId: targetUser.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({ success: true, message: 'User permanently deleted.' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user.' }, { status: 500 });
  }
}

