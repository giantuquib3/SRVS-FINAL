import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { roleLabel } from '@/lib/status';
import {
  verifyPasswordResetToken,
  consumePasswordResetTokenAndUpdatePassword,
} from '@/lib/password-reset';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    const result = await verifyPasswordResetToken(token);

    if (result.status === 'valid') {
      return NextResponse.json({
        valid: true,
        email: result.user.email,
        fullName: result.user.fullName,
        expiresAt: result.expiresAt.toISOString(),
      });
    }

    const messages: Record<string, string> = {
      expired: 'This password reset link has expired. Please request a new reset link from the sign-in page.',
      used: 'This password reset link has already been used. Please request a new link if you still need to reset your password.',
      inactive: 'This account is no longer active. Please contact the System Administrator.',
      invalid: 'This password reset link is invalid. Please request a new reset link from the sign-in page.',
    };

    return NextResponse.json(
      { valid: false, reason: result.status, error: messages[result.status] || messages.invalid },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Verify reset token error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to verify reset link.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    const confirmPassword = body.confirmPassword !== undefined ? String(body.confirmPassword) : password;

    if (!token) {
      return NextResponse.json({ error: 'Reset token is missing.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match. Please re-enter both fields.' },
        { status: 400 }
      );
    }

    const check = await verifyPasswordResetToken(token);
    if (check.status !== 'valid') {
      const messages: Record<string, string> = {
        expired: 'This password reset link has expired. Please request a new reset link.',
        used: 'This password reset link has already been used.',
        inactive: 'This account is deactivated or rejected. Please contact the System Administrator.',
        invalid: 'This password reset link is invalid.',
      };
      return NextResponse.json(
        { error: messages[check.status] || messages.invalid },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const updatedUser = await consumePasswordResetTokenAndUpdatePassword(token, passwordHash);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'This password reset link is no longer valid. Please request a new one.' },
        { status: 400 }
      );
    }

    await logAuditEvent({
      userId: updatedUser.id,
      userDisplayName: updatedUser.fullName,
      actionType: 'PasswordResetCompleted',
      resultStatus: 'Success',
      description: `Password successfully reset via email link for [${roleLabel(updatedUser.role)}] ${updatedUser.fullName} (${updatedUser.email}).`,
      entityType: 'User',
      entityId: String(updatedUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password.' },
      { status: 500 }
    );
  }
}
