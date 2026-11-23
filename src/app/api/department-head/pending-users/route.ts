import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized: Session missing or expired.' }, { status: 401 });
    }

    if (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Dean' && sessionUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Requires Department Head, Dean, or Administrator access.' }, { status: 403 });
    }

    const isDeptScoped = sessionUser.role === 'DepartmentHead' || sessionUser.role === 'Dean';
    let targetDeptId: string | null = null;

    if (isDeptScoped) {
      if (!sessionUser.departmentId) {
        return NextResponse.json({ error: 'Forbidden: Account is not assigned to an academic department.' }, { status: 403 });
      }
      targetDeptId = String(sessionUser.departmentId).toUpperCase();
    } else {
      const qDept = req.nextUrl.searchParams.get('departmentId');
      if (qDept && isValidDepartmentCode(qDept.toUpperCase())) {
        targetDeptId = qDept.toUpperCase();
      }
    }

    const whereClause: any = {
      accountStatus: 'PendingApproval',
      role: { in: ['Educator', 'Faculty'] },
    };

    if (targetDeptId) {
      whereClause.departmentId = targetDeptId;
    }

    const search = req.nextUrl.searchParams.get('search')?.trim();
    if (search) {
      const searchNum = parseInt(search, 10);
      const orSearch: any[] = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      if (!isNaN(searchNum)) {
        orSearch.push({ id: searchNum });
      }
      whereClause.AND = [{ OR: orSearch }];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        departmentId: true,
        accountStatus: true,
        academicRank: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const formatted = users.map((u: any) => {
      return {
        id: u.id,
        idNumber: u.id,
        role: 'Faculty',
        type: 'Faculty',
        name: u.fullName,
        fullName: u.fullName,
        email: u.email,
        department: u.departmentId,
        departmentId: u.departmentId,
        departmentName: getDepartmentName(u.departmentId),
        status: u.accountStatus,
        accountStatus: u.accountStatus,
        academicRank: u.academicRank || null,
        rejectionReason: u.rejectionReason || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    const facultyCount = formatted.length;

    const formatParam = req.nextUrl.searchParams.get('format');
    if (formatParam === 'detailed' || formatParam === 'object') {
      return NextResponse.json({
        pendingUsers: formatted,
        total: formatted.length,
        counts: {
          faculty: facultyCount,
          total: formatted.length,
        },
        departmentId: targetDeptId,
      });
    }

    // Default response: Returns array of pending users matching User Requirement 13
    const response = NextResponse.json(formatted);
    response.headers.set('X-Total-Count', String(formatted.length));
    response.headers.set('X-Faculty-Count', String(facultyCount));
    return response;
  } catch (error: any) {
    console.error('Error fetching pending users for department:', error);
    return NextResponse.json({ error: 'Failed to retrieve pending user registrations.' }, { status: 500 });
  }
}
