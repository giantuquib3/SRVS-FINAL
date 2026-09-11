import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const take = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : 100;
    const actionType = searchParams.get('actionType') || undefined;
    const search = searchParams.get('search')?.toLowerCase() || undefined;

    const versions = await prisma.syllabusVersion.findMany({
      where: {
        ...(actionType ? { changeType: actionType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        editor: {
          select: {
            id: true,
            idNumber: true,
            email: true,
            fullName: true,
            role: true,
            department: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            deptHeadProfile: {
              select: {
                department: true,
                departmentRel: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
            facultyProfile: {
              select: {
                department: true,
                departmentRel: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        },
        syllabus: {
          include: { subject: true },
        },
      },
    });

    const logs = versions.map((v) => {
      const deptCode =
        v.editor.department?.code ||
        v.editor.deptHeadProfile?.departmentRel?.code ||
        v.editor.deptHeadProfile?.department ||
        v.editor.facultyProfile?.departmentRel?.code ||
        v.editor.facultyProfile?.department ||
        null;
      const deptName =
        v.editor.department?.name ||
        v.editor.deptHeadProfile?.departmentRel?.name ||
        v.editor.facultyProfile?.departmentRel?.name ||
        (deptCode ? `${deptCode} Department` : null);

      return {
        id: v.id,
        actionType: v.changeType,
        resultStatus: 'Success',
        description: `${v.changeSummary} (${v.syllabus?.subject?.code || 'Syllabus'} v${v.versionNumber})`,
        userDisplayName: v.editor.fullName,
        createdAt: v.createdAt,
        user: {
          ...v.editor,
          departmentCode: deptCode,
          departmentName: deptName,
        },
      };
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit logs.' }, { status: 500 });
  }
}
