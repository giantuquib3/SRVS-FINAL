import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academicYear');
    const status = searchParams.get('status');

    const where: any = {};

    // Role-based visibility rules:
    // - Students only see Approved syllabi
    // - Dept Heads see syllabi in their department
    // - Educators see own syllabi or all approved
    // - Admin sees everything
    if (!user || user.role === 'Student') {
      where.status = 'Approved';
    } else if (user.role === 'DepartmentHead' && user.departmentId) {
      where.departmentId = user.departmentId;
      if (status) where.status = status;
    } else if (user.role === 'Educator') {
      if (status) {
        where.status = status;
      }
      // If filtering own syllabi
      if (searchParams.get('mySyllabi') === 'true') {
        where.instructorId = user.id;
      }
    } else if (user.role === 'Admin') {
      if (status) where.status = status;
    }

    if (departmentId) where.departmentId = departmentId;
    if (semester) where.semester = semester;
    if (academicYear) where.academicYear = academicYear;

    if (search) {
      where.course = {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const syllabi = await prisma.syllabus.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        course: {
          include: {
            department: true,
          },
        },
        instructor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        department: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            changeSummary: true,
            changeType: true,
            statusAtSave: true,
            createdAt: true,
            editor: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ syllabi });
  } catch (error: any) {
    console.error('Error fetching syllabi:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabi.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Educator or Admin access required to create a syllabus.' }, { status: 403 });
    }

    const {
      courseId,
      semester,
      academicYear,
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      saveAsDraft = true,
    } = await req.json();

    // 3. Validate required data
    if (!courseId || !semester || !academicYear) {
      return NextResponse.json({ error: 'Course, Semester, and Academic Year are required.' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Selected course was not found.' }, { status: 404 });
    }

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    const initialStatus = saveAsDraft ? 'Draft' : 'Submitted';

    // 4. Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 5. Create the syllabus record
      const syllabus = await tx.syllabus.create({
        data: {
          courseId: course.id,
          instructorId: user.id,
          departmentId: course.departmentId,
          academicYear,
          semester,
          status: initialStatus,
          currentVersionNumber: 1,
          submittedAt: initialStatus === 'Submitted' ? new Date() : null,
        },
      });

      // 6. Create Syllabus Version 1 using submitted content
      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: user.id,
          changeSummary: 'Initial syllabus creation (Version 1)',
          changeType: 'Create',
          statusAtSave: initialStatus,
          content: contentSnapshot,
        },
      });

      // 8. Create audit logs
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: 'CreateSyllabus',
          resultStatus: 'Success',
          description: `Created syllabus for [${course.code}] ${course.title} (${semester}, AY ${academicYear}) as Version 1 [${initialStatus}]`,
          entityType: 'Syllabus',
          entityId: syllabus.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { syllabus, version };
    });

    // 10. Return the created syllabus
    return NextResponse.json({ success: true, syllabus: result.syllabus, version: result.version }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus.' }, { status: 500 });
  }
}
