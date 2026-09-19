import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    // Announcements are surfaced via notifications; no separate table yet
    return NextResponse.json({ announcements: [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve announcements.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Only Department Heads and Administrators may create announcements.' }, { status: 403 });
    }

    const { title, message, departmentId } = await req.json();
    if (!title || !message) {
      return NextResponse.json({ error: 'Announcement title and message are required.' }, { status: 400 });
    }

    const targetDeptId = user.role === 'DepartmentHead' ? user.departmentId : (departmentId || user.departmentId);
    if (!targetDeptId) {
      return NextResponse.json({ error: 'Target department ID is required.' }, { status: 400 });
    }

    const deptCode = String(targetDeptId).toUpperCase();

    // Find all active Educators and Students in this department
    const recipients = await prisma.user.findMany({
      where: {
        departmentId: deptCode,
        role: { in: ['Educator', 'Student'] },
        accountStatus: 'Active',
      },
      select: { id: true, fullName: true, role: true },
    });

    const announcementTitle = `[Announcement] ${title.trim()}`;

    for (const recipient of recipients) {
      const link = recipient.role === 'Student' ? '/student/dashboard' : '/educator/dashboard';
      await createNotification(recipient.id, announcementTitle, message.trim(), link);
    }

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateAnnouncement',
      resultStatus: 'Success',
      description: `Posted announcement: "${title.trim()}" to ${recipients.length} members in dept ${deptCode}`,
      entityType: 'Department',
      entityId: deptCode,
    });

    return NextResponse.json({
      success: true,
      message: `Announcement broadcast to ${recipients.length} department members.`,
      recipientsCount: recipients.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement.' }, { status: 500 });
  }
}
