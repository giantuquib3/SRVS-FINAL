import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export async function POST(req: NextRequest) {
  try {
    const { email, idNumber, username, password, firstName, lastName, role, departmentId } = await req.json();

    const cleanIdStr = (idNumber || username || '').trim();

    if (!email || !cleanIdStr || !password || !firstName || !lastName || !departmentId) {
      return NextResponse.json({ error: 'Please fill in all required fields including a valid University ID Number.' }, { status: 400 });
    }

    const selectedRole =
      role === 'Admin'
        ? 'Admin'
        : role === 'DepartmentHead'
        ? 'DepartmentHead'
        : role === 'Educator'
        ? 'Educator'
        : 'Student';

    // Validate ID number length and format based on role
    if (selectedRole === 'Student') {
      if (!/^\d{10}$/.test(cleanIdStr)) {
        return NextResponse.json({
          error: 'Student ID number must be exactly 10 digits (e.g., 2022012708).',
        }, { status: 400 });
      }
    } else {
      if (!/^\d{5}$/.test(cleanIdStr)) {
        return NextResponse.json({
          error: `${selectedRole} ID number must be exactly 5 digits (e.g., 10001 or 00000).`,
        }, { status: 400 });
      }
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      return NextResponse.json({
        error: 'Institutional email is required. Email address must end with @usjr.edu.ph (e.g., yourname@usjr.edu.ph).',
      }, { status: 400 });
    }

    const numericId = parseInt(cleanIdStr, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'ID number must be a valid number.' }, { status: 400 });
    }

    // Check unique email or ID number across unified User table
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ id: numericId }, { email: cleanEmail }],
      },
    });

    if (existing) {
      if (existing.id === numericId) {
        return NextResponse.json({ error: `An account with ID Number ${cleanIdStr} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'An account with this institutional email already exists.' }, { status: 409 });
    }

    // Resolve department code
    const deptCode = String(departmentId).trim().toUpperCase();
    if (!isValidDepartmentCode(deptCode)) {
      return NextResponse.json({ error: 'Selected department is invalid. Must be one of CPE, EE, CE, ECE, IE, ME.' }, { status: 400 });
    }

    const initialStatus = selectedRole === 'Admin' || selectedRole === 'DepartmentHead' ? 'Active' : 'PendingApproval';
    const passwordHash = await hashPassword(password);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const createdRecord = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        passwordHash,
        fullName,
        role: selectedRole,
        departmentId: deptCode,
        accountStatus: initialStatus,
        academicRank: selectedRole === 'DepartmentHead' ? 'Department Chairperson' : selectedRole === 'Educator' ? 'Faculty Member' : null,
        yearLevel: selectedRole === 'Student' ? '1st Year' : null,
      },
    });

    // Notify administrators if pending approval
    if (initialStatus === 'PendingApproval') {
      const admins = await prisma.user.findMany({
        where: { role: 'Admin' },
        select: { id: true },
      });

      for (const adm of admins) {
        await createNotification(
          String(adm.id),
          'New Account Registration Pending Approval',
          `New ${selectedRole} account registration: ${fullName} (${cleanIdStr} - ${deptCode}) is awaiting review and approval.`,
          '/admin/users'
        );
      }
    }

    await logAuditEvent({
      userId: createdRecord.id,
      userDisplayName: fullName,
      actionType: 'Register',
      resultStatus: 'Success',
      description: `New [${selectedRole}] user registered with ID: ${cleanIdStr} (Status: ${initialStatus})`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        message:
          initialStatus === 'PendingApproval'
            ? 'Account registered successfully! Your account is pending administrator approval before you can log in.'
            : 'Account registered successfully! You may now sign in.',
        user: {
          id: createdRecord.id,
          idNumber: String(createdRecord.id),
          username: String(createdRecord.id),
          email: createdRecord.email,
          fullName: createdRecord.fullName,
          role: selectedRole,
          departmentId: deptCode,
          accountStatus: initialStatus,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status: 500 });
  }
}
