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
    // - Students only see Approved & Active syllabi for their actively enrolled subjects
    // - Dept Heads strictly see syllabi in their own department
    // - Educators see own syllabi or approved syllabi
    // - Admin sees everything
    if (user?.role === 'Student') {
      where.status = { in: ['Approved', 'ACTIVE'] };
      // Find all courses the student is actively enrolled in
      const studentEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: user.id,
          status: 'ENROLLED',
        },
        select: { courseId: true },
      });
      const enrolledCourseIds = studentEnrollments.map((e) => e.courseId);
      where.courseId = { in: enrolledCourseIds };
    } else if (user?.role === 'DepartmentHead') {
      // Strictly scoped to own department - Department Head cannot see other departments
      where.departmentId = user.departmentId || '__NO_DEPT__';
      if (status) where.status = status;
    } else if (user?.role === 'Educator') {
      if (status) where.status = status;
      if (searchParams.get('mySyllabi') === 'true') {
        where.instructorId = user.id;
      }
    } else if (user?.role === 'Admin') {
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
    } else {
      where.status = { in: ['Approved', 'ACTIVE'] };
    }

    if (user?.role !== 'DepartmentHead' && departmentId) {
      where.departmentId = departmentId;
    }
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
            approvalStatus: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            submittedAt: true,
            reviewedAt: true,
            editor: {
              select: {
                id: true,
                fullName: true,
              },
            },
            submittedBy: {
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
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Educator, Department Head, or Admin access required to create a syllabus.' }, { status: 403 });
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
      fileName,
      fileUrl,
      fileType,
      fileSize,
    } = await req.json();

    // Validate required data
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

    // Must have either structured description or an uploaded document
    if (!fileUrl && (!courseDescription || !courseDescription.trim())) {
      return NextResponse.json({ error: 'Please provide either a course description or an uploaded syllabus document (PDF/DOCX).' }, { status: 400 });
    }

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    const initialStatus = saveAsDraft ? 'DRAFT' : 'PENDING_APPROVAL';
    const now = new Date();

    // Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the syllabus record
      const syllabus = await tx.syllabus.create({
        data: {
          courseId: course.id,
          instructorId: user.id,
          departmentId: course.departmentId,
          academicYear,
          semester,
          status: initialStatus,
          currentVersionNumber: 1,
          submittedAt: initialStatus === 'PENDING_APPROVAL' ? now : null,
        },
      });

      // 2. Create Syllabus Version 1
      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: user.id,
          changeSummary: fileUrl
            ? `Initial syllabus creation with uploaded document (${fileName})`
            : 'Initial syllabus creation (Version 1)',
          changeType: 'Create',
          statusAtSave: initialStatus,
          approvalStatus: initialStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: initialStatus === 'PENDING_APPROVAL' ? user.id : null,
          submittedAt: initialStatus === 'PENDING_APPROVAL' ? now : null,
        },
      });

      // 3. Create audit logs
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.fullName,
          actionType: initialStatus === 'PENDING_APPROVAL' ? 'SubmitSyllabus' : 'CreateSyllabusDraft',
          resultStatus: 'Success',
          description: `Created syllabus for [${course.code}] ${course.title} (${semester}, AY ${academicYear}) as Version 1 [${initialStatus}]`,
          entityType: 'Syllabus',
          entityId: syllabus.id,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { syllabus, version };
    });

    // 4. If submitted for approval, notify Department Head and Administrators
    if (initialStatus === 'PENDING_APPROVAL') {
      const reviewers = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'Admin', accountStatus: 'Active' },
            { role: 'DepartmentHead', departmentId: course.departmentId, accountStatus: 'Active' },
          ],
        },
        select: { id: true },
      });

      for (const reviewer of reviewers) {
        if (reviewer.id !== user.id) {
          const { createNotification } = await import('@/lib/notifications');
          await createNotification(
            reviewer.id,
            `Pending Syllabus Review: ${course.code}`,
            `A new syllabus for ${course.code} (${course.title}) Version 1 has been submitted by ${user.fullName} for Department Head review.`,
            `/department/syllabus-approvals/${result.version.id}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: initialStatus === 'PENDING_APPROVAL'
        ? 'Your syllabus has been submitted for Department Head approval.'
        : 'Syllabus draft saved successfully.',
      syllabus: result.syllabus,
      version: result.version,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus.' }, { status: 500 });
  }
}
