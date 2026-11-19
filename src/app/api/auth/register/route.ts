import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { isValidDepartmentCode } from '@/lib/departments';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, idNumber, username, employeeId, studentId, password, firstName, lastName, fullName, role, departmentId, program, yearLevel, academicRank } = body;

    const cleanIdStr = idNumber !== undefined && idNumber !== null
      ? String(idNumber).trim()
      : (username !== undefined && username !== null
        ? String(username).trim()
        : (studentId !== undefined && studentId !== null
          ? String(studentId).trim()
          : (employeeId !== undefined && employeeId !== null ? String(employeeId).trim() : '')));

    const cleanEmail = (email || '').trim().toLowerCase();
    const rawName = fullName || (firstName && lastName ? `${String(firstName).trim()} ${String(lastName).trim()}` : '');
    const cleanFullName = String(rawName).trim();

    if (!cleanEmail || !cleanIdStr || !password || !cleanFullName || !departmentId) {
      return NextResponse.json({ error: 'Please fill in all required fields including a valid University ID Number.' }, { status: 400 });
    }

    // Role validation: Only Faculty can self-register
    if (role && role !== 'Educator' && role !== 'Faculty') {
      return NextResponse.json(
        {
          error: 'Only Faculty accounts can self-register. Administrative roles are provisioned by the System Administrator.',
        },
        { status: 403 }
      );
    }

    const targetRole = 'Educator';
    const isFaculty = true;

    // ID Format validation
    if (!/^\d{5}$/.test(cleanIdStr)) {
      return NextResponse.json({
        error: 'Faculty ID number must be exactly 5 digits (e.g., 10001).',
      }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

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

    const initialStatus = 'PendingApproval';
    const passwordHash = await hashPassword(password);

    const createdRecord = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        passwordHash,
        fullName: cleanFullName,
        role: targetRole,
        departmentId: deptCode,
        accountStatus: initialStatus,
        academicRank: isFaculty ? (academicRank ? String(academicRank).trim() : 'Faculty') : null,
        yearLevel: !isFaculty ? (yearLevel || '1st Year') : null,
        program: !isFaculty && program ? String(program).trim() : null,
        mustChangePassword: false,
      },
    });

    const auditAction = 'FacultyRegistered';

    await logAuditEvent({
      userId: createdRecord.id,
      userDisplayName: cleanFullName,
      actionType: auditAction,
      resultStatus: 'Success',
      description: `New [Faculty] self-registered with ID: ${cleanIdStr} in Department: ${deptCode} (Status: ${initialStatus})`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        message: 'Registration Successful. Your account has been created successfully. Your account is currently pending approval from your Department Head. You will be able to log in after your account has been approved.',
        user: {
          id: createdRecord.id,
          idNumber: createdRecord.id,
          email: createdRecord.email,
          fullName: createdRecord.fullName,
          role: 'Faculty',
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
