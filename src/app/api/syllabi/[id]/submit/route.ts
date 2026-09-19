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
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only educators and department heads may submit a syllabus.' }, { status: 403 });
    }

    const syllabusId = parseInt(params.id, 10);
    if (isNaN(syllabusId)) return NextResponse.json({ error: 'Invalid syllabus ID.' }, { status: 400 });

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { course: true },
    });

    if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    if (user.role === 'Educator' && syllabus.instructorId !== currentUserIdInt) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch (e) { /* body is optional */ }

    const updated = await prisma.syllabus.update({
      where: { id: syllabusId },
      data: { status: 'Submitted', submittedAt: new Date() },
    });

    const notesSummary = body?.notes ? ` – Note: "${body.notes}"` : '';

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'SubmitSyllabus',
      resultStatus: 'Success',
      description: `Submitted syllabus for [${syllabus.course.code}] ${syllabus.course.title} for review${notesSummary}`,
      entityType: 'Syllabus',
      entityId: String(syllabus.id),
    });

    // Notify admins and dept head in this department
    const reviewers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin' },
          { role: 'DepartmentHead', departmentId: syllabus.departmentId },
        ],
        accountStatus: 'Active',
      },
      select: { id: true },
    });

    for (const reviewer of reviewers) {
      await createNotification(
        String(reviewer.id),
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
