import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { idNumber, email, newPassword, confirmPassword } = await req.json();

    const cleanId = (idNumber || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanId || !cleanEmail || !newPassword) {
      return NextResponse.json(
        { error: 'ID number, institutional email, and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    // Locate the user matching both ID number and institutional email
    const user = await prisma.user.findFirst({
      where: {
        idNumber: cleanId,
        email: cleanEmail,
      },
    });

    if (!user) {
      await logAuditEvent({
        userDisplayName: cleanId,
        actionType: 'PasswordReset',
        resultStatus: 'Failed',
        description: `Failed password reset request: No matching user found for ID ${cleanId} and email ${cleanEmail}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json(
        { error: 'No account found matching this ID number and registered email.' },
        { status: 404 }
      );
    }

    if (user.accountStatus === 'Rejected' || user.accountStatus === 'Deactivated') {
      return NextResponse.json(
        { error: `This account is ${user.accountStatus.toLowerCase()}. Please contact the administrator.` },
        { status: 403 }
      );
    }

    // Hash the new password using bcrypt
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'PasswordReset',
      resultStatus: 'Success',
      description: `Password was successfully reset for user ${user.fullName} (${user.id})`,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while resetting the password.' },
      { status: 500 }
    );
  }
}
