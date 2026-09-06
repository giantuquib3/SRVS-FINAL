import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      accountStatus: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!user || user.accountStatus !== 'Active') {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.id,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department?.code,
      departmentName: user.department?.name,
    },
  });
}
