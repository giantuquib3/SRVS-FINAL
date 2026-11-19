import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';
import { roleLabel } from '@/lib/status';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cleanEmail = String(body.email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json(
        { error: 'Please provide your registered institutional email address.' },
        { status: 400 }
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

    // Flag the user account as requesting an Admin password reset
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { mustChangePassword: true },
    });

    await logAuditEvent({
      userId: targetUser.id,
      userDisplayName: targetUser.fullName,
      actionType: 'PasswordResetRequest',
      resultStatus: 'Warning',
      description: `Password reset requested by [${roleLabel(targetUser.role)}] ${targetUser.fullName} (${targetUser.email}). System Administrator notified.`,
      entityType: 'User',
      entityId: String(targetUser.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Your password reset request has been sent! The System Administrator has been notified and will reset the password for your registered email.',
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit password reset request.' }, { status: 500 });
  }
}
