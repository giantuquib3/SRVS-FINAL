import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER, DEFAULT_SECTION, formatClassSection } from '@/lib/enrollments';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

const sectionInclude = {
  subject: { select: { id: true, code: true, title: true, units: true, departmentId: true } },
  instructor: { select: { id: true, fullName: true, email: true } },
  _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
} as const;

function format(cs: any) {
  const dept = String(cs.subject?.departmentId || '');
  return {
    ...formatClassSection(cs),
    subject: cs.subject
      ? { ...cs.subject, department: { id: dept, code: dept, name: getDepartmentName(dept) } }
      : null,
  };
}

function deptOf(user: any) {
  return user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
}

async function resolveInstructor(instructorId: any, subjectDept: string) {
  if (instructorId === null || instructorId === '' || instructorId === undefined) return { id: null };
  const id = parseInt(String(instructorId), 10);
  if (isNaN(id)) return { error: 'instructorId must be a numeric user ID.' };
  const instructor = await prisma.user.findUnique({ where: { id } });
  if (!instructor || !['Educator', 'DepartmentHead'].includes(instructor.role)) {
    return { error: 'Instructor must be an existing Educator or Department Head.' };
  }
  if (instructor.departmentId && instructor.departmentId.toUpperCase() !== subjectDept) {
    return { error: `Instructor belongs to ${instructor.departmentId}, but the subject belongs to ${subjectDept}.` };
  }
  return { id };
}

/** GET /api/class-sections?subjectId=&academicYear=&semester=&instructorId= */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const where: any = {};
    const subjectId = parseInt(searchParams.get('subjectId') || '', 10);
    const instructorId = parseInt(searchParams.get('instructorId') || '', 10);
    if (!isNaN(subjectId)) where.subjectId = subjectId;
    if (!isNaN(instructorId)) where.instructorId = instructorId;
    if (searchParams.get('academicYear')) where.academicYear = searchParams.get('academicYear')!.trim();
    if (searchParams.get('semester')) where.semester = searchParams.get('semester')!.trim();

    // Non-admins only see sections from their own department
    if (user.role !== 'Admin') {
      const dept = deptOf(user);
      if (!dept) return NextResponse.json({ classSections: [], total: 0 });
      where.subject = { departmentId: dept };
    }

    const sections = await prisma.classSection.findMany({
      where,
      include: sectionInclude,
      orderBy: [{ academicYear: 'desc' }, { semester: 'asc' }, { subjectId: 'asc' }, { section: 'asc' }],
    });

    const formatted = sections.map(format);
    return NextResponse.json({ classSections: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Error fetching class sections:', error);
    return NextResponse.json({ error: 'Failed to retrieve class sections.' }, { status: 500 });
  }
}

/** POST /api/class-sections  { subjectId, academicYear, semester, section, capacity?, instructorId? } */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Only Administrators and Department Heads may create class sections.' }, { status: 403 });
    }

    const body = await req.json();
    const subjectId = parseInt(String(body.subjectId ?? body.courseId ?? ''), 10);
    if (isNaN(subjectId)) return NextResponse.json({ error: 'A valid subjectId is required.' }, { status: 400 });

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    const subjectDept = subject.departmentId.toUpperCase();
    if (user.role === 'DepartmentHead' && deptOf(user) !== subjectDept) {
      return NextResponse.json({ error: 'Department Heads may only create sections for their own department.' }, { status: 403 });
    }

    const instructor = await resolveInstructor(body.instructorId, subjectDept);
    if (instructor.error) return NextResponse.json({ error: instructor.error }, { status: 400 });

    const capacity = body.capacity !== undefined ? parseInt(String(body.capacity), 10) : 40;
    if (isNaN(capacity) || capacity < 1) return NextResponse.json({ error: 'capacity must be a positive number.' }, { status: 400 });

    const created = await prisma.classSection.create({
      data: {
        subjectId,
        academicYear: String(body.academicYear || DEFAULT_ACADEMIC_YEAR).trim(),
        semester: String(body.semester || DEFAULT_SEMESTER).trim(),
        section: String(body.section || DEFAULT_SECTION).trim().toUpperCase(),
        capacity,
        instructorId: instructor.id,
      },
      include: sectionInclude,
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateClassSection',
      resultStatus: 'Success',
      description: `Created section ${created.section} of [${subject.code}] for ${created.semester} ${created.academicYear}`,
      entityType: 'ClassSection',
      entityId: String(created.id),
    });

    return NextResponse.json({ success: true, classSection: format(created) }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'That section already exists for this subject and term.' }, { status: 409 });
    }
    console.error('Error creating class section:', error);
    return NextResponse.json({ error: 'Failed to create class section.' }, { status: 500 });
  }
}

/** PUT /api/class-sections  { id, instructorId?, capacity? } — assign instructor / change capacity */
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Only Administrators and Department Heads may update class sections.' }, { status: 403 });
    }

    const body = await req.json();
    const id = parseInt(String(body.id ?? ''), 10);
    if (isNaN(id)) return NextResponse.json({ error: 'A valid class section id is required.' }, { status: 400 });

    const existing = await prisma.classSection.findUnique({ where: { id }, include: { subject: true } });
    if (!existing) return NextResponse.json({ error: 'Class section not found.' }, { status: 404 });
    const subjectDept = existing.subject.departmentId.toUpperCase();
    if (user.role === 'DepartmentHead' && deptOf(user) !== subjectDept) {
      return NextResponse.json({ error: 'Department Heads may only update sections for their own department.' }, { status: 403 });
    }

    const data: any = {};
    if (body.instructorId !== undefined) {
      const instructor = await resolveInstructor(body.instructorId, subjectDept);
      if (instructor.error) return NextResponse.json({ error: instructor.error }, { status: 400 });
      data.instructorId = instructor.id;
    }
    if (body.capacity !== undefined) {
      const capacity = parseInt(String(body.capacity), 10);
      if (isNaN(capacity) || capacity < 1) return NextResponse.json({ error: 'capacity must be a positive number.' }, { status: 400 });
      data.capacity = capacity;
    }

    const updated = await prisma.classSection.update({ where: { id }, data, include: sectionInclude });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'UpdateClassSection',
      resultStatus: 'Success',
      description: `Updated section ${updated.section} of [${existing.subject.code}] (${updated.semester} ${updated.academicYear}) — instructor: ${updated.instructor?.fullName || 'None'}, capacity: ${updated.capacity}`,
      entityType: 'ClassSection',
      entityId: String(updated.id),
    });

    return NextResponse.json({ success: true, classSection: format(updated) });
  } catch (error: any) {
    console.error('Error updating class section:', error);
    return NextResponse.json({ error: 'Failed to update class section.' }, { status: 500 });
  }
}

/** DELETE /api/class-sections?id= — only allowed when the section has no enrollments */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (user.role !== 'Admin' && user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Only Administrators and Department Heads may delete class sections.' }, { status: 403 });
    }

    const id = parseInt(new URL(req.url).searchParams.get('id') || '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'A valid class section id is required.' }, { status: 400 });

    const existing = await prisma.classSection.findUnique({
      where: { id },
      include: { subject: true, _count: { select: { enrollments: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Class section not found.' }, { status: 404 });
    if (user.role === 'DepartmentHead' && deptOf(user) !== existing.subject.departmentId.toUpperCase()) {
      return NextResponse.json({ error: 'Department Heads may only delete sections for their own department.' }, { status: 403 });
    }
    if (existing._count.enrollments > 0) {
      return NextResponse.json({ error: `Cannot delete: ${existing._count.enrollments} student(s) are enrolled in this section.` }, { status: 409 });
    }

    await prisma.classSection.delete({ where: { id } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'DeleteClassSection',
      resultStatus: 'Success',
      description: `Deleted section ${existing.section} of [${existing.subject.code}] (${existing.semester} ${existing.academicYear})`,
      entityType: 'ClassSection',
      entityId: String(id),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting class section:', error);
    return NextResponse.json({ error: 'Failed to delete class section.' }, { status: 500 });
  }
}
