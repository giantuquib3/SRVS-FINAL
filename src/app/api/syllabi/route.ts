import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

function applyStatusFilter(where: any, status: string | null) {
  if (!status) return;
  const s = status.toLowerCase();
  if (s === 'submitted' || s === 'pending_approval') {
    where.status = { in: ['Submitted', 'PENDING_APPROVAL'] };
  } else if (s === 'approved' || s === 'active') {
    where.status = { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] };
  } else if (s === 'draft') {
    where.status = { in: ['Draft', 'DRAFT'] };
  } else if (s === 'rejected') {
    where.status = { in: ['Rejected', 'REJECTED'] };
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

    const where: any = {};

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
      const enrolledCourseIds = enrollments.map((e) => e.courseId);
      if (enrolledCourseIds.length === 0) return NextResponse.json({ syllabi: [] });
      where.courseId = { in: enrolledCourseIds };

    } else if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
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

    const courseParam = (searchParams.get('courseId') || searchParams.get('subjectId'))?.trim();
    const instructorParam = searchParams.get('instructorId')?.trim();

    if (courseParam) {
      const parsedCourseId = parseInt(courseParam, 10);
      if (!isNaN(parsedCourseId)) {
        where.courseId = parsedCourseId;
      } else {
        where.course = { ...(where.course || {}), code: courseParam.toUpperCase() };
      }
    }

    if (instructorParam) {
      const parsedInstId = parseInt(instructorParam, 10);
      if (!isNaN(parsedInstId)) {
        where.instructorId = parsedInstId;
      }
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
        course: true,
        instructor: {
          select: { id: true, fullName: true, email: true, academicRank: true },
        },
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
            editorId: true,
            submittedById: true,
            reviewedById: true,
            createdAt: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    const formatted = syllabi.map((s) => {
      const deptCode = s.departmentId;
      return {
        ...s,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        course: {
          ...s.course,
          department: {
            id: s.course.departmentId,
            code: s.course.departmentId,
            name: getDepartmentName(s.course.departmentId),
          },
        },
        // Back-compat aliases
        subject: s.course,
        subjectId: s.courseId,
        courseId: s.courseId,
      };
    });

    return NextResponse.json({ syllabi: formatted });
  } catch (error: any) {
    console.error('Error fetching syllabi:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabi.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Educators can create a syllabus.',
      }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseId, subjectId,
      semester, academicYear,
      courseDescription, learningOutcomes, topics, references, gradingSystem, schedule,
      section = 'A',
      directApprove = false,
      saveAsDraft = true,
      fileName, fileUrl, fileType, fileSize,
    } = body;

    const rawTarget = String(subjectId || courseId || '').trim().toUpperCase();
    if (!rawTarget || !semester || !academicYear) {
      return NextResponse.json({ error: 'Subject/Course, Semester, and Academic Year are required.' }, { status: 400 });
    }

    const parsedCourseTarget = !isNaN(parseInt(rawTarget, 10)) ? parseInt(rawTarget, 10) : null;
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          ...(parsedCourseTarget !== null ? [{ id: parsedCourseTarget }] : []),
          { code: rawTarget },
        ],
      },
    });
    if (!course) {
      return NextResponse.json({ error: 'Selected course/subject was not found.' }, { status: 404 });
    }

    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (userDeptCode && course.departmentId !== userDeptCode) {
      return NextResponse.json({
        error: `You may only create syllabi for courses within your assigned department (${userDeptCode}).`,
      }, { status: 403 });
    }

    if (!fileUrl && (!courseDescription || !courseDescription.trim())) {
      return NextResponse.json({
        error: 'Please provide either a course description or an uploaded syllabus document (PDF/DOCX).',
      }, { status: 400 });
    }

    const canDirectApprove = user.role === 'DepartmentHead' && (directApprove === true || !saveAsDraft);
    const initialStatus = canDirectApprove ? 'ACTIVE' : (saveAsDraft ? 'DRAFT' : 'PENDING_APPROVAL');
    const versionApprovalStatus = canDirectApprove ? 'APPROVED' : initialStatus;
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

    // In the unified architecture, instructorId references admin.id directly.
    // Department Heads can directly author/upload syllabi or optionally assign an educator.
    let instructorIdInt = currentUserIdInt;
    if (user.role === 'DepartmentHead' && body.instructorId) {
      const parsedInstructorId = parseInt(String(body.instructorId), 10);
      if (!isNaN(parsedInstructorId)) {
        const assignedUser = await prisma.user.findUnique({ where: { id: parsedInstructorId } });
        if (assignedUser) instructorIdInt = parsedInstructorId;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (canDirectApprove) {
        await tx.syllabus.updateMany({
          where: {
            courseId: course.id,
            status: { in: ['ACTIVE', 'Active', 'Approved', 'APPROVED'] },
          },
          data: { status: 'ARCHIVED' },
        });
      }

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
          submittedAt: initialStatus === 'PENDING_APPROVAL' ? now : null,
          reviewedAt: canDirectApprove ? now : null,
          reviewedByUserId: canDirectApprove ? currentUserIdInt : null,
          reviewerRemarks: canDirectApprove ? 'Approved on initial creation by Department Head' : null,
        },
      });

      const courseFacultyId = user.role === 'Educator' ? currentUserIdInt : instructorIdInt;
      await tx.course.update({
        where: { id: course.id },
        data: {
          facultyName: user.role === 'Educator' ? user.fullName : (course.facultyName || user.fullName),
          facultyId: courseFacultyId,
        },
      });

      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: currentUserIdInt,
          changeSummary: fileUrl
            ? `Initial creation with uploaded document (${fileName})`
            : 'Initial syllabus creation (Version 1)',
          changeType: 'Create',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: initialStatus === 'PENDING_APPROVAL' || canDirectApprove ? currentUserIdInt : null,
          submittedAt: initialStatus === 'PENDING_APPROVAL' || canDirectApprove ? now : null,
          reviewedById: canDirectApprove ? currentUserIdInt : null,
          reviewedAt: canDirectApprove ? now : null,
        },
      });

      return { syllabus, version };
    });

    await logAuditEvent({
      userId: currentUserIdInt,
      userDisplayName: user.fullName,
      actionType: canDirectApprove
        ? 'UploadAndApproveSyllabus'
        : saveAsDraft ? 'DraftSyllabus' : 'SubmitSyllabus',
      resultStatus: 'Success',
      description: `Created syllabus for ${course.code} (${semester}, AY ${academicYear}) – Status: ${initialStatus}`,
      entityType: 'Syllabus',
      entityId: String(result.syllabus.id),
    });

    return NextResponse.json({
      success: true,
      syllabus: result.syllabus,
      version: result.version,
      message: canDirectApprove
        ? `${course.code} syllabus created, approved, and activated.`
        : saveAsDraft ? 'Syllabus draft saved.' : 'Syllabus submitted for review.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus: ' + error.message }, { status: 500 });
  }
}
