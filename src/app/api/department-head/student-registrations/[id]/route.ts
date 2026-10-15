import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// GET /api/department-head/student-registrations/[id] - View specific student registration
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const targetId = parseInt(params.id, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid registration ID.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser || targetUser.role !== 'Student') {
      return NextResponse.json({ error: 'Student registration record not found.' }, { status: 404 });
    }

    // Strict Department-Level Access Control
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept || String(targetUser.departmentId || '').toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to review student registrations for your assigned department (${userDept || 'None'}). Cross-department access is strictly prohibited.`,
        }, { status: 403 });
      }
    }

    // Fetch review history from audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'User',
        entityId: String(targetId),
        actionType: { in: ['StudentRegistrationApproved', 'StudentRegistrationRejected', 'Register', 'ApproveUser', 'RejectUser'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const latestReview = auditLogs.find((l) => ['StudentRegistrationApproved', 'StudentRegistrationRejected', 'ApproveUser', 'RejectUser'].includes(l.actionType));

    return NextResponse.json({
      registration: {
        id: targetUser.id,
        idNumber: targetUser.id,
        studentId: String(targetUser.id),
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        departmentId: targetUser.departmentId,
        departmentName: getDepartmentName(targetUser.departmentId),
        program: targetUser.program || `BS ${getDepartmentName(targetUser.departmentId)}`,
        yearLevel: targetUser.yearLevel || '1st Year',
        accountStatus: targetUser.accountStatus,
        rejectionReason: targetUser.rejectionReason,
        reviewedBy: latestReview?.userDisplayName || null,
        reviewedAt: latestReview?.createdAt || null,
        reviewAction: latestReview?.actionType || null,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
        auditHistory: auditLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching student registration details:', error);
    return NextResponse.json({ error: 'Failed to fetch registration: ' + error.message }, { status: 500 });
  }
}
