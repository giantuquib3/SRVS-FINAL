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
    if (!user || (user.role !== 'Educator' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;

    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: true,
        department: true,
      },
    });

    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    if (user.role === 'Educator' && syllabus.instructorId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const updated = await prisma.syllabus.update({
      where: { id },
      data: {
        status: 'Submitted',
        submittedAt: new Date(),
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabus',
      resultStatus: 'Success',
      description: `Submitted syllabus for [${syllabus.course.code}] ${syllabus.course.title} for administrative review`,
      entityType: 'Syllabus',
      entityId: syllabus.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    // Notify Department Head & Admins
    const reviewers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin' },
          { role: 'DepartmentHead', departmentId: syllabus.departmentId },
        ],
      },
    });

    for (const reviewer of reviewers) {
      await createNotification(
        reviewer.id,
        'Syllabus Submitted for Review',
        `${syllabus.course.code} was submitted by ${user.fullName} for review.`,
        `/syllabi/${syllabus.id}`
      );
    }

    return NextResponse.json({ success: true, message: 'Syllabus submitted for review.', syllabus: updated });
  } catch (error: any) {
    console.error('Error submitting syllabus:', error);
    return NextResponse.json({ error: 'Failed to submit syllabus.' }, { status: 500 });
  }
}
