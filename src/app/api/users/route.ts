import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

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
        { idNumber: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Dept Head only sees their department users
    if (user.role === 'DepartmentHead' && user.departmentId) {
      where.departmentId = Number(user.departmentId);
    }

    const rawUsers = await prisma.user.findMany({
      where,
      include: {
        department: true,
        adminProfile: true,
        deptHeadProfile: true,
        facultyProfile: true,
        studentProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format output providing backward-compatible string username/id for UI
    const users = rawUsers.map((u) => ({
      ...u,
      username: u.idNumber,
      enrolledSubjects: u.studentProfile?.enrolledSubjects || '',
    }));

    const baseWhere: any = {};
    if (user.role === 'DepartmentHead' && user.departmentId) {
      baseWhere.departmentId = Number(user.departmentId);
    }
    if (status) baseWhere.accountStatus = status;

    const [total, deptHeads, educators, students, admins] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.user.count({ where: { ...baseWhere, role: 'DepartmentHead' } }),
      prisma.user.count({ where: { ...baseWhere, role: 'Educator' } }),
      prisma.user.count({ where: { ...baseWhere, role: 'Student' } }),
      prisma.user.count({ where: { ...baseWhere, role: 'Admin' } }),
    ]);

    return NextResponse.json({
      users,
      counts: {
        total,
        deptHeads,
        educators,
        students,
        admins,
      },
    });
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
          { idNumber: trimmedId },
        ],
      },
    });

    if (existing) {
      if (existing.idNumber === trimmedId) {
        return NextResponse.json({ error: `An account with ID Number ${trimmedId} already exists.` }, { status: 400 });
      }
      return NextResponse.json({ error: 'A user with this email address already exists.' }, { status: 400 });
    }

    // Resolve Department ID and Code if specified
    let targetDeptId: number | null = null;
    let targetDeptCode: string = 'CPE';
    if (departmentId) {
      const parsed = Number(departmentId);
      if (!isNaN(parsed)) {
        targetDeptId = parsed;
        const d = await prisma.department.findUnique({ where: { id: parsed } });
        if (d) targetDeptCode = d.code;
      } else {
        const d = await prisma.department.findUnique({ where: { code: String(departmentId).toUpperCase() } });
        if (d) {
          targetDeptId = d.id;
          targetDeptCode = d.code;
        }
      }
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user and segregated role profile in atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          idNumber: trimmedId,
          fullName: fullName.trim(),
          firstName,
          lastName,
          email: trimmedEmail,
          passwordHash,
          role,
          departmentId: targetDeptId,
          accountStatus: accountStatus || 'Active',
        },
        include: {
          department: true,
        },
      });

      if (role === 'Admin') {
        await tx.admin.create({
          data: {
            userId: createdUser.id,
            adminNumber: trimmedId,
            fullName: createdUser.fullName,
            email: createdUser.email,
          },
        });
      } else if (role === 'DepartmentHead') {
        await tx.departmentHead.create({
          data: {
            userId: createdUser.id,
            employeeId: trimmedId,
            fullName: createdUser.fullName,
            email: createdUser.email,
            department: targetDeptCode,
          },
        });
      } else if (role === 'Educator') {
        await tx.faculty.create({
          data: {
            userId: createdUser.id,
            employeeId: trimmedId,
            fullName: createdUser.fullName,
            email: createdUser.email,
            department: targetDeptCode,
          },
        });
      } else if (role === 'Student') {
        await tx.student.create({
          data: {
            userId: createdUser.id,
            studentIdNumber: trimmedId,
            fullName: createdUser.fullName,
            email: createdUser.email,
            department: targetDeptCode,
            enrolledSubjects: '',
          },
        });
      }

      return createdUser;
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateUser',
      resultStatus: 'Success',
      description: `Created user account for ${newUser.fullName} (${newUser.email}) with role ${newUser.role} [ID Number: ${trimmedId}]`,
      entityType: 'User',
      entityId: newUser.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      user: {
        ...newUser,
        username: newUser.idNumber,
      },
    }, { status: 201 });
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

    const { userId, action, newRole } = await req.json();

    const numericUserId = Number(userId);
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { idNumber: String(userId) },
          { id: isNaN(numericUserId) ? -1 : numericUserId },
        ],
      },
      include: { department: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && targetUser.departmentId !== Number(user.departmentId)) {
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
    } else if (action === 'ChangeRole') {
      if (user.role !== 'Admin') {
        return NextResponse.json({ error: 'Only administrators may change user roles.' }, { status: 403 });
      }
      if (newRole) {
        updatedRole = newRole;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        accountStatus: updatedStatus,
        role: updatedRole,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: `User_${action}`,
      resultStatus: 'Success',
      description: `Performed [${action}] on user ${targetUser.fullName} (Status: ${updatedStatus}, Role: ${updatedRole})`,
      entityType: 'User',
      entityId: targetUser.id,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user.' }, { status: 500 });
  }
}
