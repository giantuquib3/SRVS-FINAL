import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

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
    const search = searchParams.get('search')?.trim().toLowerCase();
    const deptParam = searchParams.get('departmentId')?.toUpperCase();

    const where: any = {};

    // Dept Heads can only see their own department's users
    if (user.role === 'DepartmentHead') {
      const deptCode = String(user.departmentId || '').toUpperCase();
      if (!deptCode) return NextResponse.json({ users: [], total: 0 });
      where.departmentId = deptCode;
      // DeptHeads can only see Educators and Students, not Admins
      where.role = { in: ['Educator', 'Student'] };
    }

    if (role) where.role = role;
    if (status) where.accountStatus = status;
    if (deptParam && user.role === 'Admin') where.departmentId = deptParam;

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(!isNaN(searchNum) ? [{ id: searchNum }] : []),
      ];
    }

    const isDeptHead = user.role === 'DepartmentHead';
    const deptHeadDept = isDeptHead && user.departmentId ? String(user.departmentId).toUpperCase() : null;

    const [users, allEnrollments, totalCount, deptHeadsCount, educatorsCount, studentsCount, adminsCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          departmentId: true,
          accountStatus: true,
          academicRank: true,
          yearLevel: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.enrollment.findMany({
        where: { status: 'ENROLLED' },
        select: {
          studentId: true,
          course: { select: { code: true } },
        },
      }),
      prisma.user.count({
        where: isDeptHead ? { departmentId: deptHeadDept, role: { in: ['Educator', 'Student'] } } : undefined,
      }),
      prisma.user.count({
        where: { role: 'DepartmentHead', ...(isDeptHead ? { departmentId: deptHeadDept } : {}) },
      }),
      prisma.user.count({
        where: { role: 'Educator', ...(isDeptHead ? { departmentId: deptHeadDept } : {}) },
      }),
      prisma.user.count({
        where: { role: 'Student', ...(isDeptHead ? { departmentId: deptHeadDept } : {}) },
      }),
      prisma.user.count({
        where: { role: 'Admin' },
      }),
    ]);

    const enrollmentMap = new Map<number, string[]>();
    for (const enr of allEnrollments) {
      if (!enrollmentMap.has(enr.studentId)) {
        enrollmentMap.set(enr.studentId, []);
      }
      if (enr.course?.code) {
        enrollmentMap.get(enr.studentId)!.push(enr.course.code);
      }
    }

    const counts = {
      total: totalCount,
      deptHeads: deptHeadsCount,
      educators: educatorsCount,
      students: studentsCount,
      admins: isDeptHead ? 0 : adminsCount,
    };

    const formatted = users.map((u) => {
      const studentIntId = typeof u.id === 'number' ? u.id : parseInt(String(u.id), 10);
      const studentCourses = !isNaN(studentIntId) ? enrollmentMap.get(studentIntId) || [] : [];

      return {
        ...u,
        idNumber: String(u.id),
        username: String(u.id),
        departmentCode: u.departmentId,
        departmentName: getDepartmentName(u.departmentId),
        enrolledSubjects: studentCourses.join(', '),
      };
    });

    return NextResponse.json({ users: formatted, total: formatted.length, counts });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || sessionUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { idNumber, email, fullName, role, departmentId, password, accountStatus, academicRank, yearLevel } = await req.json();

    const cleanId = (idNumber || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanId || !cleanEmail || !fullName || !role || !password) {
      return NextResponse.json({ error: 'ID, email, full name, role, and password are required.' }, { status: 400 });
    }

    const numericId = parseInt(cleanId, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'User ID must be a numeric integer.' }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: numericId }, { email: cleanEmail }] },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this ID or email already exists.' }, { status: 409 });
    }

    const deptCode = departmentId ? String(departmentId).toUpperCase() : null;
    if (deptCode && !isValidDepartmentCode(deptCode)) {
      return NextResponse.json({ error: 'Invalid department code.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        fullName: fullName.trim(),
        role,
        departmentId: deptCode,
        passwordHash,
        accountStatus: accountStatus || 'Active',
        academicRank: academicRank || null,
        yearLevel: yearLevel || null,
      },
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || 'Admin',
      actionType: 'CreateUser',
      resultStatus: 'Success',
      description: `Admin created new [${role}] account: ${fullName} (ID: ${cleanId})`,
      entityType: 'User',
      entityId: String(numericId),
    });

    return NextResponse.json({ success: true, user: { ...newUser, idNumber: String(newUser.id) } }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'Admin' && sessionUser.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, role, newRole, departmentId, accountStatus, fullName, academicRank, yearLevel } = body;

    const targetIdStr = String(userId || '').trim();
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Valid integer userId is required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    let updateData: any = {};
    let actionType = 'UpdateUser';
    let description = '';

    if (action === 'Approve') {
      updateData.accountStatus = 'Active';
      actionType = 'ApproveUser';
      description = `Approved account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'Reject') {
      updateData.accountStatus = 'Rejected';
      actionType = 'RejectUser';
      description = `Rejected account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'Deactivate') {
      updateData.accountStatus = 'Deactivated';
      actionType = 'DeactivateUser';
      description = `Deactivated account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'Activate') {
      updateData.accountStatus = 'Active';
      actionType = 'ActivateUser';
      description = `Reactivated account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'ChangeRole') {
      const assignedRole = newRole || role;
      if (assignedRole) updateData.role = assignedRole;
      actionType = 'ChangeUserRole';
      description = `Changed role of ${targetUser.fullName} (${targetId}) from ${targetUser.role} to ${assignedRole}`;
    } else {
      // General update
      if (role || newRole) updateData.role = newRole || role;
      if (departmentId) updateData.departmentId = String(departmentId).toUpperCase();
      if (accountStatus) updateData.accountStatus = accountStatus;
      if (fullName) updateData.fullName = fullName.trim();
      if (academicRank !== undefined) updateData.academicRank = academicRank;
      if (yearLevel !== undefined) updateData.yearLevel = yearLevel;
      description = `Updated user profile for ${targetUser.fullName} (${targetId})`;
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType,
      resultStatus: 'Success',
      description,
      entityType: 'User',
      entityId: String(targetId),
    });

    return NextResponse.json({ success: true, user: { ...updated, idNumber: String(updated.id) } });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || sessionUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetIdStr = (searchParams.get('userId') || searchParams.get('id') || '').trim();
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Valid integer userId is required.' }, { status: 400 });
    }

    if (String(targetId) === String(sessionUser.id)) {
      return NextResponse.json({ error: 'Administrators cannot delete their own account.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    let isHardDeleted = false;
    try {
      // First clean up cascade-safe child records
      await prisma.enrollment.deleteMany({ where: { studentId: targetId } });
      await prisma.user.delete({ where: { id: targetId } });
      isHardDeleted = true;
    } catch (delError: any) {
      // If tied to audit trail or critical records, soft-delete by deactivating
      await prisma.user.update({
        where: { id: targetId },
        data: { accountStatus: 'Deactivated' },
      });
    }

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || 'Admin',
      actionType: isHardDeleted ? 'DeleteUser' : 'DeactivateUser',
      resultStatus: 'Success',
      description: isHardDeleted
        ? `Permanently deleted [${targetUser.role}] user account: ${targetUser.fullName} (ID: ${targetId})`
        : `Deactivated [${targetUser.role}] user account: ${targetUser.fullName} (ID: ${targetId}) due to existing audit references`,
      entityType: 'User',
      entityId: String(targetId),
    });

    return NextResponse.json({
      success: true,
      message: isHardDeleted
        ? `User account ${targetId} permanently deleted.`
        : `User account ${targetId} has audit references, deactivated successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user.' }, { status: 500 });
  }
}
