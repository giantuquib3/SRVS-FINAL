import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS, isDeptHeadSubmission } from '@/lib/status';
import { extractReviewComments } from '@/lib/syllabus-template';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Dean' && user.role !== 'Admin')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads, Deans, and Administrators may review syllabi.',
      }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    const versionInclude = {
      editor: { select: { id: true, fullName: true, email: true, role: true } },
      submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
      syllabus: {
        include: {
          subject: true,
          department: true,
          instructor: { select: { id: true, fullName: true, email: true, role: true, academicRank: true } },
        },
      },
    };

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include: versionInclude,
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include: versionInclude,
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus approval request not found.' }, { status: 404 });

    // Department Isolation for DepartmentHead
    if (user.role === 'DepartmentHead') {
      if (!user.departmentId || String(user.departmentId).toUpperCase() !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({
          error: 'Forbidden: You may only manage syllabi within your assigned department.',
        }, { status: 403 });
      }
    } else if (user.role === 'Dean' && user.departmentId) {
      if (String(user.departmentId).toUpperCase() !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({
          error: 'Forbidden: You do not have permission to view approvals outside your designated department.',
        }, { status: 403 });
      }
    }

    const allVersions = await prisma.syllabusVersion.findMany({
      where: { syllabusId: version.syllabusId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        editor: { select: { id: true, fullName: true, email: true, role: true } },
        submittedBy: { select: { id: true, fullName: true, email: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    const previousApprovedVersion =
      allVersions.find(
        (v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.versionNumber < version!.versionNumber
      ) ||
      allVersions.find((v: any) => v.approvalStatus === SYLLABUS_STATUS.APPROVED && v.id !== version!.id) ||
      allVersions.find((v: any) => v.versionNumber < version!.versionNumber) ||
      null;

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isSelfSubmission = currentUserIdInt === version.editorId || currentUserIdInt === version.submittedById;
    const deptHeadSub = isDeptHeadSubmission(version);
    const sDept = version.syllabus.departmentId;
    const sDeptName = version.syllabus.department?.name || getDepartmentName(sDept);

    const canReview =
      !isSelfSubmission &&
      ((user.role === 'Dean' && version.approvalStatus === SYLLABUS_STATUS.UNDER_REVIEW) ||
        (user.role === 'DepartmentHead' &&
          !deptHeadSub &&
          version.approvalStatus === SYLLABUS_STATUS.SUBMITTED &&
          String(user.departmentId || '').toUpperCase() === sDept.toUpperCase()));

    const subjectData = {
      id: version.syllabus.subject.id,
      code: version.syllabus.subject.code,
      title: version.syllabus.subject.title,
      description: version.syllabus.subject.description,
      units: version.syllabus.subject.units,
      lecHours: version.syllabus.subject.lecHours,
      labHours: version.syllabus.subject.labHours,
      prerequisite: version.syllabus.subject.prerequisite,
      yearLevel: version.syllabus.subject.yearLevel,
      semester: version.syllabus.subject.semester,
      departmentId: version.syllabus.subject.departmentId,
      professorName: version.syllabus.subject.professorName || null,
      department: {
        id: version.syllabus.subject.departmentId,
        code: version.syllabus.subject.departmentId,
        name: sDeptName,
      },
    };

    const formattedSyllabus = {
      id: version.syllabus.id,
      subjectId: version.syllabus.subjectId,
      courseId: version.syllabus.subjectId,
      academicYear: version.syllabus.academicYear,
      semester: version.syllabus.semester,
      section: version.syllabus.section,
      status: version.syllabus.status,
      currentVersionNumber: version.syllabus.currentVersionNumber,
      departmentId: sDept,
      department: { id: sDept, code: sDept, name: sDeptName },
      subject: subjectData,
      course: subjectData,
      instructor: version.syllabus.instructor
        ? {
            id: version.syllabus.instructor.id,
            idNumber: version.syllabus.instructor.id,
            fullName: version.syllabus.instructor.fullName,
            email: version.syllabus.instructor.email,
            role: version.syllabus.instructor.role,
          }
        : null,
    };

    const formattedVersion = {
      id: version.id,
      versionNumber: version.versionNumber,
      syllabusId: version.syllabusId,
      subjectId: version.syllabus.subjectId,
      changeSummary: version.changeSummary,
      changeType: version.changeType,
      approvalStatus: version.approvalStatus,
      statusAtSave: version.statusAtSave,
      fileName: version.fileName,
      fileUrl: version.fileUrl,
      fileType: version.fileType,
      fileSize: version.fileSize,
      content: version.content,
      editorId: version.editorId,
      editor: version.editor,
      submittedById: version.submittedById,
      submittedBy: version.submittedBy,
      submittedAt: version.submittedAt,
      reviewedById: version.reviewedById,
      reviewedBy: version.reviewedBy,
      reviewedAt: version.reviewedAt,
      rejectionReason: version.rejectionReason,
      reviewComments: extractReviewComments(version),
      createdAt: version.createdAt,
      syllabus: formattedSyllabus,
    };

    return NextResponse.json({
      approval: formattedVersion,
      version: formattedVersion,
      syllabus: formattedSyllabus,
      previousApprovedVersion: previousApprovedVersion
        ? { ...previousApprovedVersion, reviewComments: extractReviewComments(previousApprovedVersion) }
        : null,
      allVersions: allVersions.map((v: any) => ({
        ...v,
        subjectId: version!.syllabus.subjectId,
        reviewComments: extractReviewComments(v),
      })),
      isSelfSubmission,
      isDeptHeadSubmission: deptHeadSub,
      canReview,
      viewerRole: user.role,
    });
  } catch (error: any) {
    console.error('Error fetching approval detail:', error);
    return NextResponse.json({ error: 'Failed to retrieve syllabus approval details.' }, { status: 500 });
  }
}
