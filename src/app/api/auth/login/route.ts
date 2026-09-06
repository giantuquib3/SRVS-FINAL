import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idInput = (body.idNumber || body.username || body.email || '').trim();
    const password = body.password;

    if (!idInput || !password) {
      return NextResponse.json({ error: 'ID number and password are required.' }, { status: 400 });
    }

    // Check if input is an ID number (numeric)
    const isDigits = /^\d+$/.test(idInput);
    if (isDigits) {
      if (idInput.length !== 5 && idInput.length !== 10) {
        return NextResponse.json({
          error: 'Invalid ID number format. Student ID must be 10 digits (e.g. 2022012708), and Admin/Faculty/Department Head ID must be 5 digits (e.g. 00000).',
        }, { status: 400 });
      }
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { idNumber: idInput },
          { email: idInput.toLowerCase() },
        ],
      },
      include: {
        department: true,
      },
    });

    if (!user) {
      await logAuditEvent({
        userDisplayName: idInput,
        actionType: 'LoginAttempt',
        resultStatus: 'Failed',
        description: `Failed login attempt for non-existent ID number / user: ${idInput}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json({ error: 'Invalid ID number or password.' }, { status: 401 });
    }

    if (user.accountStatus === 'PendingApproval') {
      return NextResponse.json({
        error: 'Your account registration is currently pending approval by the Department Head or Administrator.',
      }, { status: 403 });
    }

    if (user.accountStatus === 'Rejected' || user.accountStatus === 'Deactivated') {
      return NextResponse.json({
        error: `Your account is ${user.accountStatus.toLowerCase()}. Please contact the administrator.`,
      }, { status: 403 });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await logAuditEvent({
        userId: user.id,
        userDisplayName: user.fullName,
        actionType: 'LoginAttempt',
        resultStatus: 'Failed',
        description: `Failed login attempt: incorrect password for ${user.email}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session token
    const token = await signToken({
      id: user.id,
      idNumber: user.idNumber,
      email: user.email,
      username: user.idNumber,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department?.code,
      departmentName: user.department?.name,
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'Login',
      resultStatus: 'Success',
      description: `User successfully logged in as [${user.role}]`,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        idNumber: user.idNumber,
        username: user.idNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departmentName: user.department?.name,
      },
    });

    response.cookies.set('srvs_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during login.' }, { status: 500 });
  }
}
