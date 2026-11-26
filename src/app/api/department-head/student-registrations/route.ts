import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// GET /api/department-head/student-registrations - List student registration requests
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const statusParam = searchParams.get('status') || 'PendingApproval';

    let deptCode: string | null = null;
    if (sessionUser.role === 'DepartmentHead') {
      deptCode = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!deptCode) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }
    } else {
      // Admin
      const reqDept = searchParams.get('departmentId')?.trim().toUpperCase();
      if (reqDept && isValidDepartmentCode(reqDept)) {
        deptCode = reqDept;
      }
    }

    const where: any = {
      role: 'Student',
    };

    if (deptCode) {
      where.departmentId = deptCode;
    }

    if (statusParam && statusParam.toLowerCase() !== 'all') {
      where.accountStatus = statusParam;
    }

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(!isNaN(searchNum) ? [{ id: searchNum }] : []),
      ];
    }

    const registrations = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        program: true,
        yearLevel: true,
        accountStatus: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Also fetch who approved/rejected the request from audit logs if available
    const userIds = registrations.map((r: any) => String(r.id));
    const auditEvents = userIds.length > 0 ? await prisma.auditLog.findMany({
      where: {
        actionType: { in: ['StudentRegistrationApproved', 'StudentRegistrationRejected', 'ApproveUser', 'RejectUser'] },
        entityType: 'User',
        entityId: { in: userIds },
      },
      orderBy: { createdAt: 'desc' },
    }) : [];

    const reviewerMap = new Map<string, { reviewerName: string; actionType: string; timestamp: Date }>();
    for (const log of auditEvents) {
      if (log.entityId && !reviewerMap.has(log.entityId)) {
        reviewerMap.set(log.entityId, {
          reviewerName: log.userDisplayName || 'Department Head / Admin',
          actionType: log.actionType,
          timestamp: log.createdAt,
        });
      }
    }

    const formatted = registrations.map((r: any) => {
      const audit = reviewerMap.get(String(r.id));
      return {
        id: r.id,
        idNumber: r.id,
        studentId: String(r.id),
        email: r.email,
        fullName: r.fullName,
        role: r.role,
        departmentId: r.departmentId,
        departmentName: getDepartmentName(r.departmentId),
        program: r.program || `BS ${getDepartmentName(r.departmentId)}`,
        yearLevel: r.yearLevel || '1st Year',
        accountStatus: r.accountStatus,
        rejectionReason: r.rejectionReason,
        reviewedBy: audit ? audit.reviewerName : null,
        reviewedAt: audit ? audit.timestamp : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({
      registrations: formatted,
      total: formatted.length,
      departmentId: deptCode,
    });
  } catch (error: any) {
    console.error('Error fetching student registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch student registrations: ' + error.message }, { status: 500 });
  }
}
