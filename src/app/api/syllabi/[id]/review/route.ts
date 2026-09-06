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

    const { id } = params;
    const { action, remarks } = await req.json(); // action: "Approve" | "Reject"

    if (action !== 'Approve' && action !== 'Reject') {
      return NextResponse.json({ error: 'Invalid review action. Must be Approve or Reject.' }, { status: 400 });
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: true,
        instructor: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId !== syllabus.departmentId) {
      return NextResponse.json({ error: 'Department Heads may only review departmental syllabi.' }, { status: 403 });
    }

    const targetStatus = action === 'Approve' ? 'Approved' : 'Rejected';

    const updated = await prisma.syllabus.update({
      where: { id },
      data: {
        status: targetStatus,
        reviewerRemarks: remarks?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: action === 'Approve' ? 'ApproveSyllabus' : 'RejectSyllabus',
      resultStatus: 'Success',
      description: `${action}d syllabus for [${syllabus.course.code}] ${syllabus.course.title}${remarks ? ` with feedback: "${remarks}"` : ''}`,
      entityType: 'Syllabus',
      entityId: syllabus.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    // Notify submitting educator
    await createNotification(
      syllabus.instructorId,
      `Syllabus ${targetStatus}: ${syllabus.course.code}`,
      action === 'Approve'
        ? `Your syllabus for ${syllabus.course.code} has been approved and published to students.`
        : `Your syllabus for ${syllabus.course.code} was rejected. Feedback: "${remarks || 'Please revise and resubmit.'}"`,
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
