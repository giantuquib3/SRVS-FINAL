import { prisma } from './prisma';

interface LogActionParams {
  userId?: string | null;
  userDisplayName?: string | null;
  actionType: string;
  resultStatus?: 'Success' | 'Failed' | 'Warning';
  description: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
}

export async function logAuditEvent({
  userId,
  userDisplayName,
  actionType,
  resultStatus = 'Success',
  description,
  entityType,
  entityId,
  ipAddress,
}: LogActionParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userDisplayName: userDisplayName || 'System / Anonymous',
        actionType,
        resultStatus,
        description,
        entityType,
        entityId: entityId ? String(entityId) : null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
    return null;
  }
}
