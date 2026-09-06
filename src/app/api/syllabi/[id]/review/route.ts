import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });
    }

    const { action, remarks } = await req.json();

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: numericId },
      include: {
        subject: true,
        instructor: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== syllabus.departmentId) {
      return NextResponse.json({ error: 'Department Heads may only review departmental syllabi.' }, { status: 403 });
    }

    const targetStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const currentUserId = Number(user.id);

    const updated = await prisma.syllabus.update({
      where: { id: numericId },
      data: {
        status: targetStatus,
        reviewerRemarks: remarks?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: currentUserId,
      },
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: action === 'Approve' ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${action}d syllabus for [${syllabus.subject.code}] ${syllabus.subject.title}${remarks ? ` with feedback: "${remarks}"` : ''}`,
      entityType: 'Syllabus',
      entityId: syllabus.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    await createNotification(
      syllabus.instructorId,
      `Syllabus ${targetStatus}: ${syllabus.subject.code}`,
      action === 'Approve'
        ? `Your syllabus for ${syllabus.subject.code} has been approved and published to students.`
        : `Your syllabus for ${syllabus.subject.code} was rejected. Feedback: "${remarks || 'Please revise and resubmit.'}"`,
      `/syllabi/${syllabus.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Syllabus successfully ${targetStatus.toLowerCase()}.`,
      syllabus: updated,
    });
  } catch (error: any) {
    console.error('Error reviewing syllabus:', error);
    return NextResponse.json({ error: 'Failed to process syllabus review.' }, { status: 500 });
  }
}
