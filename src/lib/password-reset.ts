import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const RESET_TOKEN_EXPIRY_MINUTES = 30;

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createPasswordResetToken(userId: number): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx: any) => {
    // Invalidate any previously issued unused tokens for this user
    await tx.$executeRaw`
      UPDATE password_reset_tokens
      SET "usedAt" = NOW()
      WHERE "userId" = ${userId} AND "usedAt" IS NULL
    `;

    await tx.$executeRaw`
      INSERT INTO password_reset_tokens ("userId", "tokenHash", "expiresAt")
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
    `;
  });

  return { rawToken, expiresAt };
}

export type ResetTokenLookupResult =
  | {
      status: 'valid';
      tokenId: number;
      expiresAt: Date;
      user: {
        id: number;
        email: string;
        fullName: string;
        role: string;
        accountStatus: string;
      };
    }
  | { status: 'invalid' | 'expired' | 'used' | 'inactive' };

interface RawTokenRow {
  id: number;
  userId: number;
  expiresAt: Date;
  usedAt: Date | null;
  email: string;
  fullName: string;
  role: string;
  accountStatus: string;
}

export async function verifyPasswordResetToken(rawToken: string): Promise<ResetTokenLookupResult> {
  const clean = (rawToken || '').trim();
  if (!clean || clean.length < 32) {
    return { status: 'invalid' };
  }

  const tokenHash = hashResetToken(clean);
  const rows: RawTokenRow[] = await prisma.$queryRaw`
    SELECT
      t.id,
      t."userId",
      t."expiresAt",
      t."usedAt",
      u.email,
      u."fullName",
      u.role,
      u."accountStatus"
    FROM password_reset_tokens t
    JOIN users u ON u.id = t."userId"
    WHERE t."tokenHash" = ${tokenHash}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return { status: 'invalid' };
  if (row.usedAt) return { status: 'used' };

  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  if (expiresAt.getTime() <= Date.now()) {
    return { status: 'expired' };
  }

  if (row.accountStatus === 'Rejected' || row.accountStatus === 'Deactivated') {
    return { status: 'inactive' };
  }

  return {
    status: 'valid',
    tokenId: Number(row.id),
    expiresAt,
    user: {
      id: Number(row.userId),
      email: String(row.email),
      fullName: String(row.fullName),
      role: String(row.role),
      accountStatus: String(row.accountStatus),
    },
  };
}

export async function consumePasswordResetTokenAndUpdatePassword(
  rawToken: string,
  newPasswordHash: string
): Promise<{
  id: number;
  email: string;
  fullName: string;
  role: string;
} | null> {
  const clean = (rawToken || '').trim();
  if (!clean) return null;

  const tokenHash = hashResetToken(clean);

  return await prisma.$transaction(async (tx: any) => {
    const consumed: Array<{ id: number; userId: number }> = await tx.$queryRaw`
      UPDATE password_reset_tokens
      SET "usedAt" = NOW()
      WHERE "tokenHash" = ${tokenHash}
        AND "usedAt" IS NULL
        AND "expiresAt" > NOW()
      RETURNING id, "userId"
    `;

    const match = consumed[0];
    if (!match) return null;

    const userId = Number(match.userId);

    // Invalidate any other outstanding tokens for this user
    await tx.$executeRaw`
      UPDATE password_reset_tokens
      SET "usedAt" = NOW()
      WHERE "userId" = ${userId} AND "usedAt" IS NULL
    `;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    return updatedUser;
  });
}
