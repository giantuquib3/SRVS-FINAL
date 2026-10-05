import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

function applyStatusFilter(where: any, status: string | null) {
  if (!status || status === 'ALL') return;
  const sUpper = status.toUpperCase();
  if (sUpper === 'ACTIVE' || sUpper === 'APPROVED') {
    where.status = { in: ['ACTIVE', 'Active', 'Approved', 'APPROVED'] };
  } else if (sUpper === 'DRAFT') {
    where.status = { in: ['DRAFT', 'Draft'] };
  } else if (sUpper === 'SUBMITTED' || sUpper === 'PENDING_APPROVAL' || sUpper === 'PENDING') {
    where.status = { in: ['PENDING_APPROVAL', 'Submitted', 'submitted', 'UNDER_REVIEW', 'Under Review'] };
  } else if (sUpper === 'UNDER_REVIEW') {
    where.status = { in: ['UNDER_REVIEW', 'Under Review'] };
  } else if (sUpper === 'REJECTED') {
    where.status = { in: ['REJECTED', 'Rejected'] };
  } else {
    where.status = status;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academicYear');
    const search = searchParams.get('search')?.trim();
    const mySyllabi = searchParams.get('mySyllabi') === 'true';
    const courseIdParam = searchParams.get('courseId') || searchParams.get('id');
    const courseCodeParam = searchParams.get('courseCode');
    const instructorParam = searchParams.get('instructorId') || searchParams.get('idNumber');

    const where: any = {};

    // Department-Level Data Isolation (Requirement 21)
    if (user?.role === 'Student') {
      where.status = { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] };
      const studentDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!studentDept) return NextResponse.json({ syllabi: [] });
      where.departmentId = studentDept;

      // Show only syllabi for courses the student is enrolled in
      const studentIntId = parseInt(user.id, 10);
      const enrollments = !isNaN(studentIntId)
        ? await prisma.enrollment.findMany({
            where: { studentId: studentIntId, status: 'ENROLLED' },
            select: { courseId: true },
          })
        : [];
      const enrolledCourseIds = enrollments.map((e: any) => e.courseId);
      if (enrolledCourseIds.length === 0) return NextResponse.json({ syllabi: [] });
      where.courseId = { in: enrolledCourseIds };

    } else if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ syllabi: [] });
      where.departmentId = deptCode;
      applyStatusFilter(where, status);

    } else if (user?.role === 'Educator') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
      applyStatusFilter(where, status);
      if (mySyllabi) where.instructorId = parseInt(user.id, 10) || 0;

    } else if (user?.role === 'Admin') {
      applyStatusFilter(where, status);
      if (departmentId) where.departmentId = String(departmentId).trim().toUpperCase();

    } else {
      where.status = { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] };
    }

    if (semester) where.semester = semester;
    if (academicYear) where.academicYear = academicYear;

    // courseId (integer database ID)
    if (courseIdParam) {
      const parsedCourseId = parseInt(courseIdParam, 10);
      if (!isNaN(parsedCourseId)) where.courseId = parsedCourseId;
    }

    // courseCode (string institutional course code)
    if (courseCodeParam) {
      where.course = { ...(where.course || {}), code: courseCodeParam.trim().toUpperCase() };
    }

    // instructorId (integer institutional ID)
    if (instructorParam) {
      const parsedInstId = parseInt(instructorParam, 10);
      if (!isNaN(parsedInstId)) where.instructorId = parsedInstId;
    }

    if (search) {
      where.course = {
        ...(where.course || {}),
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
          select: {
            id: true,
            code: true,
            title: true,
            units: true,
            departmentId: true,
            professorName: true,
          },
        },
        instructor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            departmentId: true,
            academicRank: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            changeSummary: true,
            statusAtSave: true,
            approvalStatus: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    });

    const formatted = syllabi.map((s: any) => {
      const deptCode = String(s.departmentId || s.course.departmentId || '');
      const latestVersion = s.versions?.[0] || null;
      return {
        id: s.id,
        courseId: s.courseId,
        instructorId: s.instructorId,
        departmentId: deptCode,
        academicYear: s.academicYear,
        semester: s.semester,
        section: s.section,
        status: s.status,
        currentVersionNumber: s.currentVersionNumber,
        reviewerRemarks: s.reviewerRemarks,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        reviewedByUserId: s.reviewedByUserId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        course: {
          id: s.course.id,
          code: s.course.code,
          title: s.course.title,
          units: s.course.units,
          departmentId: s.course.departmentId,
          professorName: s.course.professorName || null,
          department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        },
        instructor: s.instructor
          ? {
              id: s.instructor.id,
              idNumber: s.instructor.id,
              fullName: s.instructor.fullName,
              email: s.instructor.email,
              role: s.instructor.role,
              academicRank: s.instructor.academicRank,
            }
          : null,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        latestVersion,
      };
    });

    return NextResponse.json({ syllabi: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Error fetching syllabi:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabi.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Educators can create or upload syllabi.',
      }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseId,
      courseCode,
      semester,
      academicYear,
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      section = 'A',
      saveAsDraft = true,
      fileName,
      fileUrl,
      fileType,
      fileSize,
    } = body;

    if ((!courseId && !courseCode) || !semester || !academicYear) {
      return NextResponse.json({ error: 'courseId or courseCode, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Resolve course
    let course = null;
    if (courseId && !isNaN(parseInt(String(courseId), 10))) {
      course = await prisma.course.findUnique({ where: { id: parseInt(String(courseId), 10) } });
    } else if (courseCode) {
      course = await prisma.course.findUnique({ where: { code: String(courseCode).trim().toUpperCase() } });
    }

    if (!course) {
      return NextResponse.json({ error: 'Selected course was not found.' }, { status: 404 });
    }

    // Department Isolation (Requirement 21)
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (userDeptCode && course.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({
        error: `You may only create syllabi for courses within your assigned department (${userDeptCode}).`,
      }, { status: 403 });
    }

    // File type validation (Requirement 9: PDF syllabi only)
    if (fileUrl && fileType && fileType.toUpperCase() !== 'PDF') {
      return NextResponse.json({
        error: 'Invalid file type. The SRVS system accepts PDF syllabi only.',
      }, { status: 400 });
    }

    if (!fileUrl && (!courseDescription || !courseDescription.trim())) {
      return NextResponse.json({
        error: 'Please provide either a course description or an uploaded PDF syllabus document.',
      }, { status: 400 });
    }

    // Workflow enforcement (Requirement 11): DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED
    const isDraft = saveAsDraft === true;
    const initialStatus = isDraft ? 'DRAFT' : 'SUBMITTED';
    const versionApprovalStatus = isDraft ? 'DRAFT' : 'SUBMITTED';
    const now = new Date();
    const currentUserIdInt = parseInt(user.id, 10) || 0;

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    // Requirement 10: Determine uploader from authenticated session
    let instructorIdInt = currentUserIdInt;
    if (user.role === 'DepartmentHead' && body.instructorId) {
      const parsedInstructorId = parseInt(String(body.instructorId), 10);
      if (!isNaN(parsedInstructorId)) {
        const assignedUser = await prisma.user.findUnique({ where: { id: parsedInstructorId } });
        if (assignedUser && assignedUser.departmentId === course.departmentId) {
          instructorIdInt = parsedInstructorId;
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const syllabus = await tx.syllabus.create({
        data: {
          courseId: course.id,
          instructorId: instructorIdInt,
          departmentId: course.departmentId,
          academicYear,
          semester,
          section: section || 'A',
          status: initialStatus,
          currentVersionNumber: 1,
          submittedAt: isDraft ? null : now,
        },
      });

      // Update professorName on course if empty
      if (!course.professorName) {
        await tx.course.update({
          where: { id: course.id },
          data: {
            professorName: user.fullName,
          },
        });
      }

      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: currentUserIdInt,
          changeSummary: fileUrl
            ? `Initial syllabus creation with uploaded PDF document (${fileName})`
            : 'Initial syllabus drafting (Version 1)',
          changeType: 'Create',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: 'PDF',
          fileSize: fileSize || null,
          submittedById: isDraft ? null : currentUserIdInt,
          submittedAt: isDraft ? null : now,
        },
      });

      return { syllabus, version };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: isDraft ? 'DraftSyllabus' : 'SubmitSyllabus',
      resultStatus: 'Success',
      description: `Created syllabus for [${course.code}] ${course.title} (${semester}, AY ${academicYear}) – Status: ${initialStatus}`,
      entityType: 'Syllabus',
      entityId: String(result.syllabus.id),
    });

    return NextResponse.json({
      success: true,
      syllabus: result.syllabus,
      version: result.version,
      message: isDraft
        ? 'Syllabus draft saved successfully.'
        : 'Syllabus submitted for department head review and approval.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus: ' + error.message }, { status: 500 });
  }
}
