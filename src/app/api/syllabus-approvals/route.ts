import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may view syllabus approvals.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'PENDING_APPROVAL';
    const departmentParam = searchParams.get('departmentId');

    const where: any = {};

    let deptInfo: { id: number; code: string; name: string } | null = null;

    if (user.role === 'DepartmentHead') {
      let deptHeadDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!deptHeadDeptId) {
        const dh = await prisma.departmentHead.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (dh?.departmentRel?.id) {
          deptHeadDeptId = dh.departmentRel.id;
        } else if (dh?.department) {
          const d = await prisma.department.findUnique({ where: { code: dh.department } });
          if (d) deptHeadDeptId = d.id;
        }
      }

      if (!deptHeadDeptId) {
        return NextResponse.json({ approvals: [], stats: { pending: 0, approved: 0, rejected: 0, total: 0 } });
      }

      const d = await prisma.department.findUnique({
        where: { id: deptHeadDeptId },
        select: { id: true, code: true, name: true },
      });
      if (d) deptInfo = d;

      where.syllabus = { departmentId: deptHeadDeptId };
    } else if (departmentParam) {
      const numericDeptId = Number(departmentParam);
      if (!isNaN(numericDeptId)) {
        where.syllabus = { departmentId: numericDeptId };
        const d = await prisma.department.findUnique({
          where: { id: numericDeptId },
          select: { id: true, code: true, name: true },
        });
        if (d) deptInfo = d;
      }
    }

    if (statusParam && statusParam !== 'ALL') {
      if (statusParam === 'APPROVED') {
        where.approvalStatus = { in: ['APPROVED', 'Approved'] };
      } else if (statusParam === 'REJECTED') {
        where.approvalStatus = { in: ['REJECTED', 'Rejected'] };
      } else if (statusParam === 'PENDING_APPROVAL') {
        where.approvalStatus = { in: ['PENDING_APPROVAL', 'PendingApproval', 'Pending', 'submitted', 'Submitted'] };
      } else {
        where.approvalStatus = statusParam;
      }
    }

    const pendingApprovals = await prisma.syllabusVersion.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        syllabus: {
          include: {
            subject: {
              include: {
                department: true,
              },
            },
            instructor: {
              select: {
                id: true,
                idNumber: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            department: true,
          },
        },
        editor: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
          },
        },
      },
    });

    // Map course alias so existing UI continues working without issues
    const formattedApprovals = pendingApprovals.map((v) => ({
      ...v,
      syllabus: {
        ...v.syllabus,
        course: v.syllabus.subject,
        courseId: v.syllabus.subjectId,
      },
    }));

    const statsWhere: any = {};
    if (where.syllabus) {
      statsWhere.syllabus = where.syllabus;
    }

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['PENDING_APPROVAL', 'PendingApproval', 'Pending', 'submitted', 'Submitted'] } } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['APPROVED', 'Approved'] } } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: { in: ['REJECTED', 'Rejected'] } } }),
    ]);

    return NextResponse.json({
      department: deptInfo,
      approvals: formattedApprovals,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching syllabus approvals:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabus approvals: ' + error.message }, { status: 500 });
  }
}
