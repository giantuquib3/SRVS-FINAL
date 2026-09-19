import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idInput = (body.idNumber || body.username || body.email || '').trim();
    const password = body.password;

    if (!idInput || !password) {
      return NextResponse.json({ error: 'ID number and password are required.' }, { status: 400 });
    }

    const cleanInput = idInput.trim();
    const cleanLower = cleanInput.toLowerCase();

    // Search unified User table
    const parsedId = !isNaN(parseInt(cleanInput, 10)) ? parseInt(cleanInput, 10) : null;
    const isSpecialAdmin = cleanLower === 'admin' || cleanLower === 'administrator' || cleanInput === '00000';

    const orConditions: any[] = [
      { email: cleanLower },
    ];
    if (parsedId !== null) {
      orConditions.push({ id: parsedId });
    }
    if (isSpecialAdmin) {
      orConditions.push({ id: 0 });
      orConditions.push({ role: 'Admin' });
    }

    let matchedUser = await prisma.user.findFirst({
      where: {
        OR: orConditions,
      },
    });

    if (!matchedUser) {
      await logAuditEvent({
        userDisplayName: idInput,
        actionType: 'LoginAttempt',
        resultStatus: 'Failed',
        description: `Failed login attempt for non-existent ID number / user: ${idInput}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json({ error: 'Invalid ID number or password.' }, { status: 401 });
    }

    const role = matchedUser.role;

    if (matchedUser.accountStatus === 'PendingApproval') {
      return NextResponse.json({
        error: 'Your account registration is currently pending approval by the Department Head or Administrator.',
      }, { status: 403 });
    }

    if (matchedUser.accountStatus === 'Rejected' || matchedUser.accountStatus === 'Deactivated') {
      return NextResponse.json({
        error: `Your account is ${matchedUser.accountStatus.toLowerCase()}. Please contact the administrator.`,
      }, { status: 403 });
    }

    const isValid = verifyPassword(password, matchedUser.passwordHash);
    if (!isValid) {
      await logAuditEvent({
        userId: matchedUser.id,
        userDisplayName: matchedUser.fullName,
        actionType: 'LoginAttempt',
        resultStatus: 'Failed',
        description: `Failed login attempt: incorrect password for ${matchedUser.email}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const deptCode = matchedUser.departmentId || null;
    const deptName = getDepartmentName(deptCode);

    // Create session token
    const token = await signToken({
      id: String(matchedUser.id),
      idNumber: String(matchedUser.id),
      email: matchedUser.email,
      username: String(matchedUser.id),
      fullName: matchedUser.fullName,
      role,
      departmentId: deptCode,
      departmentCode: deptCode,
      departmentName: deptName,
    });

    await logAuditEvent({
      userId: matchedUser.id,
      userDisplayName: matchedUser.fullName,
      actionType: 'Login',
      resultStatus: 'Success',
      description: `User successfully logged in as [${role}]`,
      entityType: 'User',
      entityId: String(matchedUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: matchedUser.id,
        idNumber: matchedUser.id,
        username: matchedUser.id,
        email: matchedUser.email,
        fullName: matchedUser.fullName,
        role,
        departmentName: deptName,
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
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during login.' }, { status: 500 });
  }
}
