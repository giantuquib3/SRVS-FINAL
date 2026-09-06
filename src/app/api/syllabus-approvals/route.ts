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

    const effectiveDeptId = user.role === 'DepartmentHead' ? user.departmentId : departmentParam;
    const numericDeptId = effectiveDeptId ? Number(effectiveDeptId) : null;

    const where: any = {};

    if (numericDeptId && !isNaN(numericDeptId)) {
      where.syllabus = {
        departmentId: numericDeptId,
      };
    }

    if (statusParam && statusParam !== 'ALL') {
      where.approvalStatus = statusParam;
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
    if (numericDeptId && !isNaN(numericDeptId)) {
      statsWhere.syllabus = { departmentId: numericDeptId };
    }

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: 'PENDING_APPROVAL' } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: 'APPROVED' } }),
      prisma.syllabusVersion.count({ where: { ...statsWhere, approvalStatus: 'REJECTED' } }),
    ]);

    return NextResponse.json({
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
