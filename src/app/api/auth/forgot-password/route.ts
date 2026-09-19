import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { idNumber, email, newPassword, confirmPassword } = await req.json();

    const cleanIdStr = (idNumber || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanIdStr || !cleanEmail || !newPassword) {
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

    const parsedId = parseInt(cleanIdStr, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json(
        { error: 'Valid integer ID number is required.' },
        { status: 400 }
      );
    }

    // Locate the user matching both ID number and institutional email
    const targetUser = await prisma.user.findFirst({
      where: { id: parsedId, email: cleanEmail },
    });

    if (!targetUser) {
      await logAuditEvent({
        userDisplayName: cleanIdStr,
        actionType: 'PasswordReset',
        resultStatus: 'Failed',
        description: `Failed password reset request: No matching account found for ID ${cleanIdStr} and email ${cleanEmail}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json(
        { error: 'No account found matching this ID number and registered email.' },
        { status: 404 }
      );
    }

    if (targetUser.accountStatus === 'Rejected' || targetUser.accountStatus === 'Deactivated') {
      return NextResponse.json(
        { error: `This account is ${targetUser.accountStatus.toLowerCase()}. Please contact the administrator.` },
        { status: 403 }
      );
    }

    // Hash the new password using bcrypt
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { passwordHash },
    });

    await logAuditEvent({
      userId: targetUser.id,
      userDisplayName: targetUser.fullName,
      actionType: 'PasswordReset',
      resultStatus: 'Success',
      description: `Password was successfully reset for [${targetUser.role}] ${targetUser.fullName} (${targetUser.id})`,
      entityType: 'User',
      entityId: String(targetUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset password.' }, { status: 500 });
  }
}
