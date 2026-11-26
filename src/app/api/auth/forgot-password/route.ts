import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';
import { roleLabel } from '@/lib/status';
import { isMailerConfigured, sendPasswordResetEmail } from '@/lib/mailer';
import { createPasswordResetToken, RESET_TOKEN_EXPIRY_MINUTES } from '@/lib/password-reset';

function resolveAppBaseUrl(req: NextRequest): string {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) {
    const proto = forwardedProto || (forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  return req.nextUrl.origin.replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cleanEmail = String(body.email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json(
        { error: 'Please provide your registered email address.' },
        { status: 400 }
      );
    }

    if (!isMailerConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email delivery is not configured yet. Please set SMTP_USER and SMTP_PASS (Gmail App Password) in the server environment.',
        },
        { status: 503 }
      );
    }

    // Locate the user matching the registered email
    const targetUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!targetUser) {
      await logAuditEvent({
        userDisplayName: cleanEmail,
        actionType: 'PasswordResetRequest',
        resultStatus: 'Failed',
        description: `Failed password reset request: No registered account found for email ${cleanEmail}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return NextResponse.json(
        { error: 'No account found matching this registered email address.' },
        { status: 404 }
      );
    }

    if (targetUser.accountStatus === 'Rejected' || targetUser.accountStatus === 'Deactivated') {
      return NextResponse.json(
        { error: `This account is ${targetUser.accountStatus.toLowerCase()}. Please contact the System Administrator.` },
        { status: 403 }
      );
    }

    const { rawToken } = await createPasswordResetToken(targetUser.id);
    const baseUrl = resolveAppBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendPasswordResetEmail({
        to: targetUser.email,
        fullName: targetUser.fullName,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      });
    } catch (mailError: any) {
      console.error('Failed to send password reset email:', mailError);
      await logAuditEvent({
        userId: targetUser.id,
        userDisplayName: targetUser.fullName,
        actionType: 'PasswordResetEmail',
        resultStatus: 'Failed',
        description: `Failed to send password reset email to ${targetUser.email}: ${mailError?.message || 'SMTP error'}`,
        entityType: 'User',
        entityId: String(targetUser.id),
        ipAddress: req.ip || '127.0.0.1',
      });
      const rawMsg = String(mailError?.message || '');
      const isAuthErr = mailError?.code === 'EAUTH' || mailError?.responseCode === 535;
      return NextResponse.json(
        {
          error: isAuthErr
            ? 'Gmail rejected the SMTP login. Please verify SMTP_USER and your 16-character Google App Password (SMTP_PASS).'
            : `Could not send the password reset email (${rawMsg || 'SMTP connection error'}). Please try again.`,
        },
        { status: 502 }
      );
    }

    await logAuditEvent({
      userId: targetUser.id,
      userDisplayName: targetUser.fullName,
      actionType: 'PasswordResetEmail',
      resultStatus: 'Success',
      description: `Password reset link emailed to [${roleLabel(targetUser.role)}] ${targetUser.fullName} (${targetUser.email}).`,
      entityType: 'User',
      entityId: String(targetUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `A password reset link has been sent to ${targetUser.email}. Please check your inbox (and spam folder) — the link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.`,
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset request.' },
      { status: 500 }
    );
  }
}
