import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import {
  listEditRequests,
  getFacultyEditPermissionForSyllabus,
  createEditPermissionRequest,
  SyllabusEditRequestDTO,
} from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'ALL';
    const syllabusIdParam = searchParams.get('syllabusId');
    const deptParam = searchParams.get('departmentId');

    const syllabusId = syllabusIdParam ? parseInt(syllabusIdParam, 10) : null;
    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    let requests: SyllabusEditRequestDTO[] = [];
    let allForStats: SyllabusEditRequestDTO[] = [];

    if (user.role === 'Educator' || user.role === 'Faculty') {
      requests = await listEditRequests({
        facultyId: currentUserIdInt,
        syllabusId: syllabusId && !isNaN(syllabusId) ? syllabusId : null,
        status: statusParam,
      });
      allForStats = await listEditRequests({ facultyId: currentUserIdInt });
    } else if (user.role === 'DepartmentHead') {
      if (!userDeptCode) {
        return NextResponse.json({
          requests: [],
          stats: { pending: 0, approved: 0, rejected: 0, completed: 0, total: 0 },
        });
      }
      requests = await listEditRequests({
        departmentId: userDeptCode,
        syllabusId: syllabusId && !isNaN(syllabusId) ? syllabusId : null,
        status: statusParam,
      });
      allForStats = await listEditRequests({ departmentId: userDeptCode });
    } else if (user.role === 'Dean' || user.role === 'Admin') {
      const targetDept = userDeptCode || (deptParam ? deptParam.trim().toUpperCase() : null);
      requests = await listEditRequests({
        departmentId: targetDept,
        syllabusId: syllabusId && !isNaN(syllabusId) ? syllabusId : null,
        status: statusParam,
      });
      allForStats = await listEditRequests({ departmentId: targetDept });
    } else {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const stats = {
      pending: allForStats.filter((r) => r.status === 'PENDING').length,
      approved: allForStats.filter((r) => r.status === 'APPROVED').length,
      rejected: allForStats.filter((r) => r.status === 'REJECTED').length,
      completed: allForStats.filter((r) => r.status === 'COMPLETED').length,
      total: allForStats.length,
    };

    return NextResponse.json({ requests, stats });
  } catch (error: any) {
    console.error('Error fetching syllabus edit permission requests:', error);
    return NextResponse.json({ error: 'Failed to retrieve edit permission requests.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Faculty')) {
      return NextResponse.json(
        {
          error:
            user?.role === 'DepartmentHead'
              ? 'Department Heads already have direct edit access to syllabi in their department.'
              : 'Unauthorized: Only Faculty members submit edit permission requests.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const syllabusId = parseInt(String(body?.syllabusId || ''), 10);
    const reason = String(body?.reason || '').trim();

    if (isNaN(syllabusId) || syllabusId <= 0) {
      return NextResponse.json({ error: 'A valid syllabusId is required.' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json(
        { error: 'Please provide a brief reason explaining what you plan to update in this syllabus.' },
        { status: 400 }
      );
    }

    const syllabus = await prisma.syllabus.findUnique({
      where: { id: syllabusId },
      include: { subject: true, department: true },
    });
    if (!syllabus) {
      return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
    }

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (!userDeptCode || userDeptCode !== syllabus.departmentId.toUpperCase()) {
      return NextResponse.json(
        {
          error: `Forbidden: You may only request edit permission for syllabi within your assigned department (${userDeptCode || 'None'}).`,
        },
        { status: 403 }
      );
    }

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const existing = await getFacultyEditPermissionForSyllabus(syllabusId, currentUserIdInt);
    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        {
          error: 'You already have active edit permission granted for this syllabus. You can proceed to edit it directly.',
          request: existing.request,
        },
        { status: 409 }
      );
    }
    if (existing.status === 'PENDING') {
      return NextResponse.json(
        {
          error: 'You already have a pending edit permission request awaiting your Department Head’s approval.',
          request: existing.request,
        },
        { status: 409 }
      );
    }

    const created = await createEditPermissionRequest({
      syllabusId: syllabus.id,
      facultyId: currentUserIdInt,
      departmentId: syllabus.departmentId,
      reason,
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: 'RequestSyllabusEditPermission',
      resultStatus: 'Success',
      description: `Faculty ${user.fullName} requested edit permission for [${syllabus.subject.code}] ${syllabus.subject.title}: "${reason}"`,
      entityType: 'SyllabusEditRequest',
      entityId: String(created.id),
    });

    const deptHeads = await prisma.user.findMany({
      where: {
        role: 'DepartmentHead',
        departmentId: syllabus.departmentId,
        accountStatus: 'Active',
      },
      select: { id: true },
    });
    for (const dh of deptHeads) {
      await createNotification(
        String(dh.id),
        `Edit Permission Requested: ${syllabus.subject.code}`,
        `${user.fullName} requested permission to edit the electronic syllabus for [${syllabus.subject.code}] ${syllabus.subject.title}.`,
        `/dept/dashboard`
      );
    }

    return NextResponse.json(
      {
        success: true,
        request: created,
        message: `Edit permission request for [${syllabus.subject.code}] submitted to your Department Head. You will be able to edit the syllabus once permission is granted.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating syllabus edit permission request:', error);
    return NextResponse.json({ error: 'Failed to submit edit permission request.' }, { status: 500 });
  }
}
