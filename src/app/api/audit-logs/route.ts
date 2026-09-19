import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const take = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 500) : 100;
    const actionType = searchParams.get('actionType') || undefined;
    const search = searchParams.get('search')?.toLowerCase();

    const where: any = {};
    if (actionType) where.actionType = actionType;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { userDisplayName: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit logs.' }, { status: 500 });
  }
}
