import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    // Body is optional
  }

  const user = await getSessionFromRequest(req);
  if (user) {
    const reason = body?.reason ? ` (${body.reason})` : '';
    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'Logout',
      resultStatus: 'Success',
      description: `User logged out${reason}`,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip || '127.0.0.1',
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set('srvs_token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
