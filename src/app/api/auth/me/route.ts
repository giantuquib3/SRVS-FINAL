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
    where: { id: Number(session.id) },
    select: {
      id: true,
      idNumber: true,
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
      studentProfile: {
        select: {
          department: true,
          departmentRel: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      deptHeadProfile: {
        select: {
          department: true,
          departmentRel: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      facultyProfile: {
        select: {
          department: true,
          departmentRel: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.accountStatus !== 'Active') {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const isAdmin = user.role === 'Admin';

  const deptId = isAdmin
    ? null
    : user.departmentId ||
      user.studentProfile?.departmentRel?.id ||
      user.deptHeadProfile?.departmentRel?.id ||
      user.facultyProfile?.departmentRel?.id ||
      null;

  const deptCode = isAdmin
    ? null
    : user.department?.code ||
      user.studentProfile?.departmentRel?.code ||
      user.studentProfile?.department ||
      user.deptHeadProfile?.departmentRel?.code ||
      user.deptHeadProfile?.department ||
      user.facultyProfile?.departmentRel?.code ||
      user.facultyProfile?.department ||
      null;

  const deptName = isAdmin
    ? 'All Departments (Administration)'
    : user.department?.name ||
      user.studentProfile?.departmentRel?.name ||
      user.deptHeadProfile?.departmentRel?.name ||
      user.facultyProfile?.departmentRel?.name ||
      (deptCode ? `${deptCode} Department` : null);

  return NextResponse.json({
    user: {
      id: user.id,
      idNumber: user.idNumber,
      email: user.email,
      username: user.idNumber,
      fullName: user.fullName,
      role: user.role,
      departmentId: deptId,
      departmentCode: deptCode,
      departmentName: deptName,
    },
  });
}
