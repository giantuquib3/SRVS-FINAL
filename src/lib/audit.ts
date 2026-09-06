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
  // Graceful audit event logger (without dedicated database table requirement)
  console.log(`[AUDIT] [${actionType}] (${resultStatus}) User: ${userDisplayName || userId || 'System'} | ${description}`);
  return {
    success: true,
    actionType,
    resultStatus,
    description,
    timestamp: new Date(),
  };
}
