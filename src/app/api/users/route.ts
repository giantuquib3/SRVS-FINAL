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
    const deptParam = (searchParams.get('departmentId') || searchParams.get('departmentCode'))?.toUpperCase();
    const idParam = (searchParams.get('idNumber') || searchParams.get('userId') || searchParams.get('id'))?.trim();

    const where: any = {};

    // Filter by specific user ID number (e.g. 2022012708, 10001, 0)
    if (idParam) {
      const parsedId = parseInt(idParam, 10);
      if (!isNaN(parsedId)) {
        where.id = parsedId;
      }
    }

    // Department Isolation: Dept Heads can only see their own department's users (Requirement 21)
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
          classSection: { select: { subject: { select: { code: true } } } },
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
      const code = enr.classSection?.subject?.code;
      if (code && !enrollmentMap.get(enr.studentId)!.includes(code)) {
        enrollmentMap.get(enr.studentId)!.push(code);
      }
    }

    const counts = {
      total: totalCount,
      deptHeads: deptHeadsCount,
      educators: educatorsCount,
      students: studentsCount,
      admins: isDeptHead ? 0 : adminsCount,
    };

    const formatted = users.map((u: any) => {
      const studentIntId = typeof u.id === 'number' ? u.id : parseInt(String(u.id), 10);
      const studentSubjects = !isNaN(studentIntId) ? enrollmentMap.get(studentIntId) || [] : [];

      return {
        id: u.id,
        idNumber: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        departmentId: u.departmentId,
        departmentName: getDepartmentName(u.departmentId),
        accountStatus: u.accountStatus,
        academicRank: u.academicRank,
        yearLevel: u.yearLevel,
        enrolledSubjects: studentSubjects,
        enrolledCourses: studentSubjects, // Alias
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
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
    if (!sessionUser || (sessionUser.role !== 'Admin' && sessionUser.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { idNumber, userId, email, fullName, role, departmentId, password, accountStatus, academicRank, yearLevel, program } = body;

    const cleanId = String(idNumber || userId || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanId || !cleanEmail || !fullName || !role || !password) {
      return NextResponse.json({ error: 'idNumber, email, fullName, role, and password are required.' }, { status: 400 });
    }

    // Role restrictions for Administrator
    if (sessionUser.role === 'Admin') {
      if (role !== 'Admin' && role !== 'DepartmentHead') {
        return NextResponse.json(
          {
            error: 'Forbidden: Admins can only create Admin and Department Head accounts. Students and Faculty must self-register.',
          },
          { status: 403 }
        );
      }
      if (role === 'DepartmentHead') {
        const cleanDept = departmentId ? String(departmentId).trim().toUpperCase() : '';
        if (!cleanDept || !isValidDepartmentCode(cleanDept)) {
          return NextResponse.json(
            { error: 'Department Head must be assigned to a valid engineering department (CPE, EE, CE, ECE, IE, ME).' },
            { status: 400 }
          );
        }
      }
    }

    // Role restrictions for Department Head
    if (sessionUser.role === 'DepartmentHead') {
      if (role === 'Admin' || role === 'DepartmentHead') {
        return NextResponse.json({ error: 'Forbidden: Department Heads cannot create Admin or Department Head accounts.' }, { status: 403 });
      }
      if (role !== 'Educator' && role !== 'Student') {
        return NextResponse.json({ error: 'Forbidden: Department Heads can only manage Faculty or Student accounts.' }, { status: 403 });
      }

      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }

      if (departmentId && String(departmentId).toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to manage accounts in department ${userDept}. Cross-department operations are prohibited.`,
        }, { status: 403 });
      }
    }

    const numericId = parseInt(cleanId, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'idNumber must be a valid integer.' }, { status: 400 });
    }

    // ID format validation
    if (role === 'Student') {
      if (!/^\d{10}$/.test(cleanId)) {
        return NextResponse.json({ error: 'Student ID number must be exactly 10 digits (e.g., 2022012708).' }, { status: 400 });
      }
    } else {
      if (!/^\d{5}$/.test(cleanId)) {
        return NextResponse.json({ error: `${role} ID number must be exactly 5 digits (e.g., 10001 or 00000).` }, { status: 400 });
      }
    }

    const deptCode = sessionUser.role === 'DepartmentHead'
      ? String(sessionUser.departmentId).toUpperCase()
      : (departmentId ? String(departmentId).trim().toUpperCase() : null);

    if (deptCode && !isValidDepartmentCode(deptCode)) {
      return NextResponse.json({ error: 'departmentId must be one of CPE, EE, CE, ECE, IE, ME.' }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: numericId }, { email: cleanEmail }] },
    });
    if (existing) {
      if (existing.id === numericId) {
        return NextResponse.json({ error: `User with ID Number ${cleanId} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const isDeptHead = sessionUser.role === 'DepartmentHead';

    const newUser = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        fullName: fullName.trim(),
        passwordHash,
        role,
        departmentId: deptCode,
        accountStatus: accountStatus || 'Active',
        academicRank: academicRank || (role === 'DepartmentHead' ? 'Department Chairperson' : role === 'Educator' ? 'Faculty Member' : null),
        yearLevel: yearLevel || (role === 'Student' ? '1st Year' : null),
        program: program ? String(program).trim() : null,
        mustChangePassword: isDeptHead ? true : false,
      },
    });

    const auditAction = role === 'Student' ? 'StudentCreated' : role === 'Educator' ? 'FacultyCreated' : 'CreateUser';
    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType: auditAction,
      resultStatus: 'Success',
      description: `Created [${role}] user ${fullName.trim()} (${numericId} - ${deptCode || 'System'})${isDeptHead ? ' with MustChangePassword set to true' : ''}`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          idNumber: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          departmentId: newUser.departmentId,
          departmentName: getDepartmentName(newUser.departmentId),
          accountStatus: newUser.accountStatus,
          academicRank: newUser.academicRank,
          yearLevel: newUser.yearLevel,
          program: newUser.program,
          mustChangePassword: !!newUser.mustChangePassword,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
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
    const { userId, idNumber, action, role, newRole, departmentId, accountStatus, fullName, academicRank, yearLevel, program, reason, rejectionReason } = body;

    const targetIdStr = String(userId || idNumber || '').trim();
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Valid integer userId or idNumber is required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Department Isolation for Dept Head (Requirement 21)
    if (sessionUser.role === 'DepartmentHead') {
      const deptCode = String(sessionUser.departmentId || '').toUpperCase();
      if (!deptCode || String(targetUser.departmentId || '').toUpperCase() !== deptCode) {
        return NextResponse.json({ error: 'Forbidden: You may only manage accounts in your department.' }, { status: 403 });
      }
      if (targetUser.role === 'Admin' || targetUser.role === 'DepartmentHead') {
        return NextResponse.json({ error: 'Forbidden: Cannot modify administrator or department head accounts.' }, { status: 403 });
      }
    }

    const updateData: any = {};
    let actionType = 'UpdateUser';
    let description = '';

    if (action === 'Approve') {
      updateData.accountStatus = 'Active';
      updateData.rejectionReason = null;
      actionType = targetUser.role === 'Student' ? 'StudentRegistrationApproved' : 'ApproveUser';
      description = `Approved registration for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'Reject') {
      updateData.accountStatus = 'Rejected';
      updateData.rejectionReason = (reason || rejectionReason || 'Registration rejected by administrator').trim();
      actionType = targetUser.role === 'Student' ? 'StudentRegistrationRejected' : 'RejectUser';
      description = `Rejected registration for [${targetUser.role}] ${targetUser.fullName} (${targetId}). Reason: ${updateData.rejectionReason}`;
    } else if (action === 'Deactivate') {
      updateData.accountStatus = 'Deactivated';
      actionType = targetUser.role === 'Student' ? 'StudentDeactivated' : targetUser.role === 'Educator' ? 'FacultyDeactivated' : 'DeactivateUser';
      description = `Deactivated account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else if (action === 'Activate') {
      updateData.accountStatus = 'Active';
      actionType = targetUser.role === 'Student' ? 'StudentActivated' : targetUser.role === 'Educator' ? 'FacultyActivated' : 'ActivateUser';
      description = `Reactivated account for [${targetUser.role}] ${targetUser.fullName} (${targetId})`;
    } else {
      if (role || newRole) updateData.role = newRole || role;
      if (departmentId) {
        const dCode = String(departmentId).toUpperCase();
        if (isValidDepartmentCode(dCode)) updateData.departmentId = dCode;
      }
      if (accountStatus) updateData.accountStatus = accountStatus;
      if (fullName) updateData.fullName = fullName.trim();
      if (academicRank !== undefined) updateData.academicRank = academicRank;
      if (yearLevel !== undefined) updateData.yearLevel = yearLevel;
      if (program !== undefined) updateData.program = program;
      description = `Updated profile for ${targetUser.fullName} (${targetId})`;
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
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        idNumber: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        departmentId: updated.departmentId,
        departmentName: getDepartmentName(updated.departmentId),
        accountStatus: updated.accountStatus,
        academicRank: updated.academicRank,
        yearLevel: updated.yearLevel,
        program: updated.program,
        rejectionReason: updated.rejectionReason,
      },
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'Admin' && sessionUser.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetIdStr = (searchParams.get('userId') || searchParams.get('idNumber') || searchParams.get('id') || '').trim();
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Valid integer userId or idNumber is required.' }, { status: 400 });
    }

    if (String(targetId) === String(sessionUser.id)) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Department Isolation for Dept Head
    if (sessionUser.role === 'DepartmentHead') {
      const deptCode = String(sessionUser.departmentId || '').toUpperCase();
      if (!deptCode || String(targetUser.departmentId || '').toUpperCase() !== deptCode) {
        return NextResponse.json({ error: 'Forbidden: You may only manage accounts in your department.' }, { status: 403 });
      }
      if (targetUser.role === 'Admin' || targetUser.role === 'DepartmentHead') {
        return NextResponse.json({ error: 'Forbidden: Cannot deactivate administrators or department heads.' }, { status: 403 });
      }
    }

    // Prefer deactivation to preserve audit trail, syllabus authoring, and revision history
    await prisma.user.update({
      where: { id: targetId },
      data: { accountStatus: 'Deactivated' },
    });

    const auditAction = targetUser.role === 'Student' ? 'StudentDeactivated' : targetUser.role === 'Educator' ? 'FacultyDeactivated' : 'DeactivateUser';
    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType: auditAction,
      resultStatus: 'Success',
      description: `Deactivated [${targetUser.role}] account: ${targetUser.fullName} (ID: ${targetId}) – Preserved all institutional audit and versioning records.`,
      entityType: 'User',
      entityId: String(targetId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `User account ${targetId} deactivated successfully. Institutional audit records and author history preserved.`,
    });
  } catch (error: any) {
    console.error('Error deleting/deactivating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to process user deactivation.' }, { status: 500 });
  }
}

