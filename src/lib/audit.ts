import { prisma } from '@/lib/prisma';

interface LogActionParams {
  userId?: number | string | null;
  userDisplayName?: string | null;
  actionType: string;
  resultStatus?: 'Success' | 'Failed' | 'Warning';
  description: string;
  entityType?: string;
  entityId?: string | number;
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
  const parsedUserId = userId !== undefined && userId !== null && !isNaN(parseInt(String(userId), 10)) ? parseInt(String(userId), 10) : null;
  const cleanDisplayName = userDisplayName ? String(userDisplayName).trim() : null;
  const cleanEntityId = entityId !== undefined && entityId !== null ? String(entityId).trim() : null;

  console.log(`[AUDIT] [${actionType}] (${resultStatus}) User: ${cleanDisplayName || parsedUserId || 'System'} | ${description}`);

  try {
    const record = await prisma.auditLog.create({
      data: {
        userId: parsedUserId,
        userDisplayName: cleanDisplayName,
        actionType,
        resultStatus,
        description,
        entityType: entityType || null,
        entityId: cleanEntityId,
        ipAddress: ipAddress || null,
      },
    });

    return {
      success: true,
      id: record.id,
      actionType,
      resultStatus,
      description,
      timestamp: record.createdAt,
    };
  } catch (err: any) {
    console.error('Failed to write to audit_logs table:', err.message);
    return {
      success: true,
      actionType,
      resultStatus,
      description,
      timestamp: new Date(),
    };
  }
}
