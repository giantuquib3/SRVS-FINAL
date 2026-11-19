import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { roleLabel } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const notifications: any[] = [];

    if (user.role === 'Admin') {
      const [resetUsers, pendingUsers] = await Promise.all([
        prisma.user.findMany({
          where: { mustChangePassword: true },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, fullName: true, email: true, role: true, departmentId: true, updatedAt: true },
        }),
        prisma.user.findMany({
          where: { accountStatus: 'PendingApproval' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, fullName: true, email: true, role: true, departmentId: true, createdAt: true },
        }),
      ]);

      for (const u of resetUsers) {
        notifications.push({
          id: `reset-${u.id}`,
          title: 'Password Reset Requested',
          message: `[${roleLabel(u.role)}] ${u.fullName} (${u.email}) requested a password reset.`,
          createdAt: u.updatedAt,
          link: '/admin/dashboard',
        });
      }

      for (const u of pendingUsers) {
        notifications.push({
          id: `reg-${u.id}`,
          title: 'Pending Account Approval',
          message: `${u.fullName} (${u.email}) registered as ${roleLabel(u.role)}.`,
          createdAt: u.createdAt,
          link: '/admin/dashboard',
        });
      }
    } else if (user.role === 'DepartmentHead' && user.departmentId) {
      const deptCode = String(user.departmentId).toUpperCase();
      const pendingSyllabi = await prisma.syllabus.findMany({
        where: { departmentId: deptCode, status: 'SUBMITTED' },
        include: { subject: { select: { code: true, title: true } }, instructor: { select: { fullName: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      for (const s of pendingSyllabi) {
        notifications.push({
          id: `syl-dept-${s.id}`,
          title: `Syllabus Pending Dept. Head Review: ${s.subject.code}`,
          message: `Submitted by ${s.instructor?.fullName || 'Faculty'} for [${s.subject.code}] ${s.subject.title}.`,
          createdAt: s.updatedAt,
          link: '/department/syllabus-approvals',
        });
      }
    } else if (user.role === 'Dean') {
      const deptWhere = user.departmentId
        ? { departmentId: String(user.departmentId).toUpperCase(), status: 'UNDER_REVIEW' }
        : { status: 'UNDER_REVIEW' };
      const endorsedSyllabi = await prisma.syllabus.findMany({
        where: deptWhere,
        include: { subject: { select: { code: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      for (const s of endorsedSyllabi) {
        notifications.push({
          id: `syl-dean-${s.id}`,
          title: `Endorsed by Dept. Head (Pending Dean): ${s.subject.code}`,
          message: `[${s.subject.code}] ${s.subject.title} was approved by the Department Head and awaits your final approval.`,
          createdAt: s.updatedAt,
          link: '/department/syllabus-approvals',
        });
      }
    }

    return NextResponse.json({ notifications, unreadCount: notifications.length });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
