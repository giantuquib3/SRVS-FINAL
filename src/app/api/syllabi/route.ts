import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS, SEMESTERS, DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER, DEFAULT_SECTION, parseSyllabusStatusParam } from '@/lib/status';

export const dynamic = 'force-dynamic';

function applyStatusFilter(where: any, status: string | null) {
  if (!status || status.toUpperCase() === 'ALL') return;
  const canonical = parseSyllabusStatusParam(status);
  if (canonical === SYLLABUS_STATUS.SUBMITTED) {
    // "Pending" includes syllabi that a reviewer has already picked up
    where.status = { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] };
  } else {
    where.status = canonical ?? status;
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
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId') || searchParams.get('id');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode');
    const instructorParam = searchParams.get('instructorId') || searchParams.get('idNumber');

    const where: any = {};

    // Department-Level Data Isolation
    if (user?.role === 'Student') {
      where.status = SYLLABUS_STATUS.APPROVED;
      const studentDept = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!studentDept) return NextResponse.json({ syllabi: [] });
      where.departmentId = studentDept;

      // Show only syllabi for subjects the student is enrolled in
      const studentIntId = parseInt(user.id, 10);
      const studentSubjects = !isNaN(studentIntId)
        ? await prisma.studentSubject.findMany({
            where: { studentId: studentIntId, status: 'ENROLLED' },
            select: { subjectId: true },
          })
        : [];
      const enrolledSubjectIds = studentSubjects.map((ss: any) => ss.subjectId);
      if (enrolledSubjectIds.length === 0) return NextResponse.json({ syllabi: [] });
      where.subjectId = { in: enrolledSubjectIds };

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
      where.status = SYLLABUS_STATUS.APPROVED;
    }

    if (semester) where.semester = semester;
    if (academicYear) where.academicYear = academicYear;

    // subjectId (integer database ID)
    if (subjectIdParam) {
      const parsedSubjectId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedSubjectId)) where.subjectId = parsedSubjectId;
    }

    // subjectCode (string institutional subject code)
    if (subjectCodeParam) {
      where.subject = { ...(where.subject || {}), code: subjectCodeParam.trim().toUpperCase() };
    }

    // instructorId (integer institutional ID)
    if (instructorParam) {
      const parsedInstId = parseInt(instructorParam, 10);
      if (!isNaN(parsedInstId)) where.instructorId = parsedInstId;
    }

    if (search) {
      where.subject = {
        ...(where.subject || {}),
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
        subject: {
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
      const deptCode = String(s.departmentId || s.subject?.departmentId || '');
      const latestVersion = s.versions?.[0] || null;
      const subjData = {
        id: s.subject?.id,
        code: s.subject?.code,
        title: s.subject?.title,
        units: s.subject?.units,
        departmentId: s.subject?.departmentId,
        professorName: s.subject?.professorName || null,
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
      };

      return {
        id: s.id,
        subjectId: s.subjectId,
        courseId: s.subjectId, // Alias
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
        subject: subjData,
        course: subjData, // Alias
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
      subjectId,
      courseId,
      subjectCode,
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

    const targetSubjId = subjectId !== undefined && subjectId !== null ? subjectId : courseId;
    const targetSubjCode = subjectCode || courseCode;

    if ((!targetSubjId && !targetSubjCode) || !semester || !academicYear) {
      return NextResponse.json({ error: 'subjectId or subjectCode, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Resolve subject
    let subject = null;
    if (targetSubjId && !isNaN(parseInt(String(targetSubjId), 10))) {
      subject = await prisma.subject.findUnique({ where: { id: parseInt(String(targetSubjId), 10) } });
    } else if (targetSubjCode) {
      subject = await prisma.subject.findUnique({ where: { code: String(targetSubjCode).trim().toUpperCase() } });
    }

    if (!subject) {
      return NextResponse.json({ error: 'Selected subject was not found.' }, { status: 404 });
    }

    // Department Isolation
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (userDeptCode && subject.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({
        error: `You may only create syllabi for subjects within your assigned department (${userDeptCode}).`,
      }, { status: 403 });
    }

    // File type validation (PDF syllabi only)
    if (fileUrl && fileType && fileType.toUpperCase() !== 'PDF') {
      return NextResponse.json({
        error: 'Invalid file type. The SRVS system accepts PDF syllabi only.',
      }, { status: 400 });
    }

    if (!fileUrl && (!courseDescription || !courseDescription.trim())) {
      return NextResponse.json({
        error: 'Please provide either a subject description or an uploaded PDF syllabus document.',
      }, { status: 400 });
    }

    // Workflow enforcement: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED
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

    let instructorIdInt = currentUserIdInt;
    if (user.role === 'DepartmentHead' && body.instructorId) {
      const parsedInstructorId = parseInt(String(body.instructorId), 10);
      if (!isNaN(parsedInstructorId)) {
        const assignedUser = await prisma.user.findUnique({ where: { id: parsedInstructorId } });
        if (assignedUser && assignedUser.departmentId === subject.departmentId) {
          instructorIdInt = parsedInstructorId;
        }
      }
    }

    // Academic term this syllabus is for
    const termAcademicYear = String(academicYear || DEFAULT_ACADEMIC_YEAR).trim();
    const termSemester = String(semester || DEFAULT_SEMESTER).trim();
    const termSection = String(section || DEFAULT_SECTION).trim().toUpperCase();
    if (!(SEMESTERS as readonly string[]).includes(termSemester)) {
      return NextResponse.json({ error: `Invalid semester "${termSemester}". Allowed: ${SEMESTERS.join(', ')}.` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const syllabus = await tx.syllabus.create({
        data: {
          subjectId: subject.id,
          instructorId: instructorIdInt,
          departmentId: subject.departmentId,
          academicYear: termAcademicYear,
          semester: termSemester,
          section: termSection,
          status: initialStatus,
          currentVersionNumber: 1,
          submittedAt: isDraft ? null : now,
        },
      });

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
      description: `Created syllabus for [${subject.code}] ${subject.title} (${semester}, AY ${academicYear}) – Status: ${initialStatus}`,
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
