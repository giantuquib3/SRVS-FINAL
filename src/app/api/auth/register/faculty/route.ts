import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { isValidDepartmentCode } from '@/lib/departments';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idNumber, employeeId, username, fullName, firstName, lastName, email, password, departmentId, academicRank } = body;

    const cleanIdStr = String(idNumber || employeeId || username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawName = fullName || (firstName && lastName ? `${String(firstName).trim()} ${String(lastName).trim()}` : '');
    const cleanFullName = String(rawName).trim();
    const deptCode = String(departmentId || '').trim().toUpperCase();

    if (!cleanIdStr || !cleanEmail || !password || !cleanFullName || !deptCode) {
      return NextResponse.json(
        { error: 'Please provide all required fields: Faculty ID (5 digits), Full Name, Institutional Email, Password, and Department.' },
        { status: 400 }
      );
    }

    // Faculty ID must be exactly 5 digits
    if (!/^\d{5}$/.test(cleanIdStr)) {
      return NextResponse.json(
        { error: 'Faculty ID number must be exactly 5 digits (e.g., 12345).' },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      return NextResponse.json(
        { error: 'Institutional email is required and must end with @usjr.edu.ph (e.g., yourname@usjr.edu.ph).' },
        { status: 400 }
      );
    }

    if (!isValidDepartmentCode(deptCode)) {
      return NextResponse.json(
        { error: 'Selected department is invalid. Must be one of CPE, EE, CE, ECE, IE, ME.' },
        { status: 400 }
      );
    }

    const numericId = parseInt(cleanIdStr, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Faculty ID must be a valid number.' }, { status: 400 });
    }

    // Check unique email or ID number in unified users table
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ id: numericId }, { email: cleanEmail }],
      },
    });

    if (existing) {
      if (existing.id === numericId) {
        return NextResponse.json({ error: `An account with Faculty ID ${cleanIdStr} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'An account with this institutional email already exists.' }, { status: 409 });
    }

    const initialStatus = 'PendingApproval';
    const passwordHash = await hashPassword(password);

    const createdFaculty = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        passwordHash,
        fullName: cleanFullName,
        role: 'Educator',
        departmentId: deptCode,
        accountStatus: initialStatus,
        academicRank: academicRank ? String(academicRank).trim() : 'Faculty',
        yearLevel: null,
        program: null,
        mustChangePassword: false,
      },
    });

    // Record audit event: FacultyRegistered
    await logAuditEvent({
      userId: createdFaculty.id,
      userDisplayName: cleanFullName,
      actionType: 'FacultyRegistered',
      resultStatus: 'Success',
      description: `Faculty self-registered with ID: ${cleanIdStr} in Department: ${deptCode} (Status: ${initialStatus})`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        message: 'Registration Successful. Your account has been created successfully. Your account is currently pending approval from your Department Head. You will be able to log in after your account has been approved.',
        user: {
          id: createdFaculty.id,
          idNumber: createdFaculty.id,
          email: createdFaculty.email,
          fullName: createdFaculty.fullName,
          role: 'Faculty',
          departmentId: deptCode,
          academicRank: createdFaculty.academicRank,
          accountStatus: initialStatus,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Faculty registration error:', error);
    return NextResponse.json({ error: error.message || 'Faculty registration failed.' }, { status: 500 });
  }
}
