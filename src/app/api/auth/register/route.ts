import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const { email, idNumber, username, password, firstName, lastName, role, departmentId } = await req.json();

    const cleanId = (idNumber || username || '').trim();

    if (!email || !cleanId || !password || !firstName || !lastName || !departmentId) {
      return NextResponse.json({ error: 'Please fill in all required fields including your University ID Number.' }, { status: 400 });
    }

    const selectedRole = role === 'Educator' ? 'Educator' : 'Student';

    // Validate ID number length and format based on role
    if (selectedRole === 'Student') {
      if (!/^\d{10}$/.test(cleanId)) {
        return NextResponse.json({
          error: 'Student ID number must be exactly 10 digits (e.g., 2022012708).',
        }, { status: 400 });
      }
    } else {
      if (!/^\d{5}$/.test(cleanId)) {
        return NextResponse.json({
          error: 'Faculty ID number must be exactly 5 digits (e.g., 10001 or 00000).',
        }, { status: 400 });
      }
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check unique email or ID number
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { id: cleanId },
        ],
      },
    });

    if (existing) {
      if (existing.id === cleanId) {
        return NextResponse.json({ error: `An account with ID Number ${cleanId} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'An account with this institutional email already exists.' }, { status: 409 });
    }

    // Check department exists
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      return NextResponse.json({ error: 'Selected department is invalid.' }, { status: 400 });
    }

    // Both need approval if Educator or Student per workflow.
    const initialStatus = 'PendingApproval';

    const passwordHash = await hashPassword(password);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const user = await prisma.user.create({
      data: {
        id: cleanId, // Primary key is ID Number (00000, 10001, 2022012708)
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        role: selectedRole,
        departmentId: dept.id,
        accountStatus: initialStatus,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'Register',
      resultStatus: 'Success',
      description: `New ${selectedRole} registration submitted (Status: PendingApproval) for department ${dept.code}`,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    // Notify Department Head & Admin of new registration
    const approvers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin' },
          { role: 'DepartmentHead', departmentId: dept.id },
        ],
      },
    });

    for (const approver of approvers) {
      await createNotification(
        approver.id,
        'New Registration Pending Review',
        `${fullName} registered as ${selectedRole} in ${dept.name}.`,
        '/admin/users'
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Registration submitted successfully! Your account is pending approval by the Department Head or Administrator.',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during registration.' }, { status: 500 });
  }
}
