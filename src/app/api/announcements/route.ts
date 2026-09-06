import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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

    const numericDeptId = Number(targetDeptId);

    // Find all users in this department (Educators, Students)
    const departmentUsers = await prisma.user.findMany({
      where: {
        departmentId: numericDeptId,
        accountStatus: 'Active',
      },
      select: { id: true, fullName: true, role: true },
    });

    const announcementTitle = `[Announcement] ${title.trim()}`;

    for (const recipient of departmentUsers) {
      await createNotification(
        recipient.id,
        announcementTitle,
        message.trim(),
        recipient.role === 'Student' ? '/student/dashboard' : '/educator/dashboard'
      );
    }

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateAnnouncement',
      resultStatus: 'Success',
      description: `Posted department announcement: "${title.trim()}" to ${departmentUsers.length} members`,
      entityType: 'Department',
      entityId: numericDeptId,
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `Announcement broadcast to ${departmentUsers.length} department members.`,
      recipientsCount: departmentUsers.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement.' }, { status: 500 });
  }
}
