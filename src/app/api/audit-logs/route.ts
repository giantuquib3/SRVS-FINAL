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

    const versions = await prisma.syllabusVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        editor: {
          select: {
            id: true,
            idNumber: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        syllabus: {
          include: { subject: true },
        },
      },
    });

    const logs = versions.map((v) => ({
      id: v.id,
      actionType: v.changeType,
      resultStatus: 'Success',
      description: `${v.changeSummary} (${v.syllabus?.subject?.code || 'Syllabus'} v${v.versionNumber})`,
      userDisplayName: v.editor.fullName,
      createdAt: v.createdAt,
      user: v.editor,
    }));

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit logs.' }, { status: 500 });
  }
}
