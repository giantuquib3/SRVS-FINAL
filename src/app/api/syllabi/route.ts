import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getDepartmentName } from '@/lib/departments';
import {
  SYLLABUS_STATUS,
  SEMESTERS,
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_SEMESTER,
  DEFAULT_SECTION,
  parseSyllabusStatusParam,
} from '@/lib/status';
import { normalizeSyllabusContent, extractReviewComments } from '@/lib/syllabus-template';
import { getFacultyEditPermissionsMap } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

function applyStatusFilter(where: any, status: string | null) {
  if (!status || status.toUpperCase() === 'ALL') return;
  const canonical = parseSyllabusStatusParam(status);
  if (canonical === SYLLABUS_STATUS.SUBMITTED) {
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

    // Role & Department-Level Data Isolation
    if (user?.role === 'Registrar' || user?.role === 'VPAcademics' || user?.role === 'Admin') {
      applyStatusFilter(where, status);
      if (departmentId) where.departmentId = String(departmentId).trim().toUpperCase();
    } else if (user?.role === 'Dean') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) {
        where.departmentId = deptCode;
      } else if (departmentId) {
        where.departmentId = String(departmentId).trim().toUpperCase();
      }
      applyStatusFilter(where, status);
    } else if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ syllabi: [], total: 0 });
      where.departmentId = deptCode;
      applyStatusFilter(where, status);
    } else if (user?.role === 'Educator' || user?.role === 'Faculty') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
      applyStatusFilter(where, status);
      if (mySyllabi) {
        const uid = parseInt(user.id, 10) || 0;
        where.OR = [
          { instructorId: uid },
          { versions: { some: { editorId: uid } } },
        ];
      }
    } else {
      where.status = SYLLABUS_STATUS.APPROVED;
    }

    if (semester) where.semester = semester;
    if (academicYear) where.academicYear = academicYear;

    if (subjectIdParam) {
      const parsedSubjectId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedSubjectId)) where.subjectId = parsedSubjectId;
    }

    if (subjectCodeParam) {
      where.subject = { ...(where.subject || {}), code: subjectCodeParam.trim().toUpperCase() };
    }

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
        department: true,
        subject: {
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            units: true,
            lecHours: true,
            labHours: true,
            prerequisite: true,
            yearLevel: true,
            semester: true,
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
            editor: { select: { id: true, fullName: true, email: true, role: true } },
            submittedById: true,
            submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
            submittedAt: true,
            reviewedById: true,
            reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
            reviewedAt: true,
            rejectionReason: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const isFacultyUser = user?.role === 'Educator' || user?.role === 'Faculty';
    const isDeptHeadUser = user?.role === 'DepartmentHead';
    const currentUserIdInt = user ? parseInt(user.id, 10) || 0 : 0;
    const userDeptUpper = user?.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    const editPermMap =
      isFacultyUser && currentUserIdInt > 0 && syllabi.length > 0
        ? await getFacultyEditPermissionsMap(
          currentUserIdInt,
          syllabi.map((s: any) => s.id)
        )
        : new Map();

    const formatted = syllabi.map((s: any) => {
      const deptCode = String(s.departmentId || s.subject?.departmentId || '');
      const deptName = s.department?.name || getDepartmentName(deptCode);
      const versionsList = s.versions || [];
      const approvedVersion =
        versionsList.find((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber === s.currentVersionNumber) ||
        versionsList.find((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED) ||
        null;
      const latestVersion = versionsList[0] || null;
      const pendingVersion =
        versionsList.find(
          (v: any) =>
            v.approvalStatus === SYLLABUS_STATUS.SUBMITTED ||
            v.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW
        ) || null;
      const latestRejectedVersion =
        versionsList.find((v: any) => v.approvalStatus === SYLLABUS_STATUS.REJECTED) || null;

      const stripHeavyContent = (v: any) =>
        v
          ? {
            id: v.id,
            versionNumber: v.versionNumber,
            changeSummary: v.changeSummary,
            changeType: v.changeType,
            statusAtSave: v.statusAtSave,
            approvalStatus: v.approvalStatus,
            fileName: v.fileName,
            fileUrl: v.fileUrl,
            fileType: v.fileType,
            fileSize: v.fileSize,
            editorId: v.editorId,
            editor: v.editor,
            submittedById: v.submittedById,
            submittedBy: v.submittedBy,
            submittedAt: v.submittedAt,
            reviewedById: v.reviewedById,
            reviewedBy: v.reviewedBy,
            reviewedAt: v.reviewedAt,
            rejectionReason: v.rejectionReason,
            reviewComments: extractReviewComments(v),
            content: v.content?._proposalMeta ? { _proposalMeta: v.content._proposalMeta } : undefined,
            createdAt: v.createdAt,
          }
          : null;

      const subjData = {
        id: s.subject?.id,
        code: s.subject?.code,
        title: s.subject?.title,
        description: s.subject?.description,
        units: s.subject?.units,
        lecHours: s.subject?.lecHours,
        labHours: s.subject?.labHours,
        prerequisite: s.subject?.prerequisite,
        yearLevel: s.subject?.yearLevel,
        semester: s.subject?.semester,
        departmentId: s.subject?.departmentId,
        professorName: s.subject?.professorName || null,
        department: { id: deptCode, code: deptCode, name: deptName },
      };

      const editReq = isFacultyUser ? editPermMap.get(s.id) || null : null;
      const editPermissionStatus = isDeptHeadUser
        ? 'DIRECT_ACCESS'
        : isFacultyUser
          ? editReq?.status || 'NONE'
          : 'READ_ONLY';
      const canEdit =
        (isDeptHeadUser && Boolean(userDeptUpper && userDeptUpper === deptCode.toUpperCase())) ||
        (isFacultyUser && editPermissionStatus === 'APPROVED');

      return {
        id: s.id,
        subjectId: s.subjectId,
        courseId: s.subjectId,
        instructorId: s.instructorId,
        departmentId: deptCode,
        academicYear: s.academicYear,
        semester: s.semester,
        section: s.section,
        status: s.status,
        currentVersionNumber: s.currentVersionNumber,
        totalVersions: versionsList.length,
        reviewerRemarks: s.reviewerRemarks,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        reviewedByUserId: s.reviewedByUserId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        canEdit,
        editPermissionStatus,
        editPermissionRequest: editReq,
        subject: subjData,
        course: subjData,
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
        department: { id: deptCode, code: deptCode, name: deptName },
        latestVersion: stripHeavyContent(latestVersion),
        approvedVersion: stripHeavyContent(approvedVersion),
        pendingVersion: stripHeavyContent(pendingVersion),
        latestRejectedVersion: stripHeavyContent(latestRejectedVersion),
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
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({
        error:
          user?.role === 'Educator' || user?.role === 'Faculty'
            ? 'Faculty members cannot create new syllabi directly. Select an existing subject syllabus and request edit permission from your Department Head.'
            : 'Unauthorized: Only Department Heads may create new syllabus records.',
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
      section = 'A',
      saveAsDraft = true,
      changeSummary,
      content: structuredContent,
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      fileName,
      fileUrl,
      fileType,
      fileSize,
    } = body;

    const targetSubjId = subjectId !== undefined && subjectId !== null ? subjectId : courseId;
    const targetSubjCode = subjectCode || courseCode;

    if ((!targetSubjId && !targetSubjCode) || !semester || !academicYear) {
      return NextResponse.json({ error: 'Subject, Semester, and Academic Year are required.' }, { status: 400 });
    }

    let subject: (Awaited<ReturnType<typeof prisma.subject.findUnique>> & { department?: { name: string } | null }) | null = null;
    if (targetSubjId && !isNaN(parseInt(String(targetSubjId), 10))) {
      subject = await prisma.subject.findUnique({
        where: { id: parseInt(String(targetSubjId), 10) },
        include: { department: true },
      });
    } else if (targetSubjCode) {
      subject = await prisma.subject.findUnique({
        where: { code: String(targetSubjCode).trim().toUpperCase() },
        include: { department: true },
      });
    }

    if (!subject) {
      return NextResponse.json({ error: 'Selected subject was not found.' }, { status: 404 });
    }

    // Department Isolation: Faculty & Department Heads can only create syllabi within their assigned department
    const userDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
    if (!userDeptCode || subject.departmentId.toUpperCase() !== userDeptCode) {
      return NextResponse.json({
        error: `Forbidden: You may only create syllabi for subjects within your assigned department (${userDeptCode || 'None'}).`,
      }, { status: 403 });
    }

    // Prevent duplicate syllabus creation when Version 1 already exists (also prevents Faculty bypassing edit permission!)
    const existingForSubject = await prisma.syllabus.findFirst({
      where: { subjectId: subject.id },
      select: { id: true, currentVersionNumber: true },
    });
    if (existingForSubject) {
      return NextResponse.json(
        {
          error:
            user.role === 'DepartmentHead'
              ? `An electronic syllabus (Version ${existingForSubject.currentVersionNumber}) already exists for [${subject.code}]. Open and edit it directly to submit Version ${existingForSubject.currentVersionNumber + 1} for Dean approval.`
              : `An electronic syllabus (Version ${existingForSubject.currentVersionNumber}) already exists for [${subject.code}]. Please request edit permission from your Department Head to revise it.`,
          existingSyllabusId: existingForSubject.id,
        },
        { status: 409 }
      );
    }

    const normalizedContent = normalizeSyllabusContent(
      structuredContent || {
        courseDescription,
        learningOutcomes,
        topics,
        references,
        gradingSystem,
        schedule,
      },
      subject,
      subject.department?.name || getDepartmentName(subject.departmentId)
    );

    // Dual approval workflow:
    // - Draft -> DRAFT
    // - Faculty submit -> SUBMITTED (Pending Department Head Approval)
    // - Department Head submit -> UNDER_REVIEW (Pending Dean Approval — NEVER self-approved!)
    const isDraft = saveAsDraft === true;
    const isDeptHead = user.role === 'DepartmentHead';
    const targetStatus = isDraft
      ? SYLLABUS_STATUS.DRAFT
      : isDeptHead
        ? SYLLABUS_STATUS.UNDER_REVIEW
        : SYLLABUS_STATUS.SUBMITTED;

    const now = new Date();
    const currentUserIdInt = parseInt(user.id, 10) || 0;

    let instructorIdInt = currentUserIdInt;
    if (isDeptHead && body.instructorId) {
      const parsedInstructorId = parseInt(String(body.instructorId), 10);
      if (!isNaN(parsedInstructorId)) {
        const assignedUser = await prisma.user.findUnique({ where: { id: parsedInstructorId } });
        if (assignedUser && assignedUser.departmentId === subject.departmentId) {
          instructorIdInt = parsedInstructorId;
        }
      }
    }

    const termAcademicYear = String(academicYear || DEFAULT_ACADEMIC_YEAR).trim();
    const termSemester = String(semester || DEFAULT_SEMESTER).trim().replace('Summer Term', 'Summer');
    const termSection = String(section || DEFAULT_SECTION).trim().toUpperCase();
    if (!(SEMESTERS as readonly string[]).includes(termSemester)) {
      return NextResponse.json({ error: `Invalid semester "${termSemester}". Allowed: ${SEMESTERS.join(', ')}.` }, { status: 400 });
    }

    const summaryText =
      changeSummary?.trim() ||
      (isDeptHead
        ? 'Initial electronic syllabus authored by Department Head (Version 1)'
        : 'Initial electronic syllabus authored by Faculty (Version 1)');

    const result = await prisma.$transaction(async (tx: any) => {
      const syllabus = await tx.syllabus.create({
        data: {
          subjectId: subject.id,
          instructorId: instructorIdInt,
          departmentId: subject.departmentId,
          academicYear: termAcademicYear,
          semester: termSemester,
          section: termSection,
          status: targetStatus,
          currentVersionNumber: 1,
          submittedAt: isDraft ? null : now,
        },
      });

      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: currentUserIdInt,
          changeSummary: summaryText,
          changeType: 'Create',
          statusAtSave: targetStatus,
          approvalStatus: targetStatus,
          content: normalizedContent as any,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileUrl ? fileType || 'PDF' : null,
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
      description: `Created electronic syllabus v1 for [${subject.code}] ${subject.title} (${termSemester}, AY ${termAcademicYear}) – Status: ${targetStatus}`,
      entityType: 'Syllabus',
      entityId: String(result.syllabus.id),
    });

    // Notify the appropriate reviewer when submitted
    if (!isDraft) {
      if (isDeptHead) {
        const deans = await prisma.user.findMany({
          where: { role: 'Dean', accountStatus: 'Active' },
          select: { id: true },
        });
        for (const dean of deans) {
          await createNotification(
            String(dean.id),
            `Dept. Head Syllabus Submission: ${subject.code}`,
            `Department Head ${user.fullName} submitted [${subject.code}] ${subject.title} (v1) for Dean review and approval.`,
            `/department/syllabus-approvals/${result.version.id}`
          );
        }
      } else {
        const deptHeads = await prisma.user.findMany({
          where: { role: 'DepartmentHead', departmentId: subject.departmentId, accountStatus: 'Active' },
          select: { id: true },
        });
        for (const dh of deptHeads) {
          await createNotification(
            String(dh.id),
            `Faculty Syllabus Submission: ${subject.code}`,
            `Faculty ${user.fullName} submitted [${subject.code}] ${subject.title} (v1) for Department Head review and approval.`,
            `/department/syllabus-approvals/${result.version.id}`
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        syllabus: result.syllabus,
        version: result.version,
        message: isDraft
          ? 'Electronic syllabus Version 1 saved as draft.'
          : isDeptHead
            ? 'Electronic syllabus Version 1 submitted to the Dean for review and approval.'
            : 'Electronic syllabus Version 1 submitted to the Department Head for review and approval.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus: ' + error.message }, { status: 500 });
  }
}
