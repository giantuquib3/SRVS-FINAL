import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators may review syllabi.' }, { status: 403 });
    }

    const versionOrSyllabusId = parseInt(params.id, 10);
    if (isNaN(versionOrSyllabusId)) {
      return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: versionOrSyllabusId },
      include: {
        syllabus: {
          include: {
            course: true,
            instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
          },
        },
      },
    });

    if (!version) {
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: versionOrSyllabusId },
        orderBy: { versionNumber: 'desc' },
        include: {
          syllabus: {
            include: {
              course: true,
              instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
            },
          },
        },
      });
    }

    if (!version) return NextResponse.json({ error: 'Syllabus approval request not found.' }, { status: 404 });

    // Department Isolation (Requirement 21)
    if (user.role === 'DepartmentHead') {
      if (!user.departmentId || String(user.departmentId).toUpperCase() !== version.syllabus.departmentId.toUpperCase()) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to view approvals outside your assigned department.' }, { status: 403 });
      }
    }

    const previousApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: version.syllabusId, approvalStatus: { in: ['APPROVED', 'Approved'] }, versionNumber: { lt: version.versionNumber } },
      orderBy: { versionNumber: 'desc' },
    });

    const currentUserIdInt = parseInt(user.id, 10) || 0;
    const isSelfSubmission = currentUserIdInt === version.submittedById || currentUserIdInt === version.syllabus.instructorId;
    const sDept = version.syllabus.departmentId;

    const formatted = {
      id: version.id,
      versionNumber: version.versionNumber,
      syllabusId: version.syllabusId,
      changeSummary: version.changeSummary,
      approvalStatus: version.approvalStatus,
      statusAtSave: version.statusAtSave,
      fileName: version.fileName,
      fileUrl: version.fileUrl,
      fileType: version.fileType,
      fileSize: version.fileSize,
      submittedAt: version.submittedAt,
      submittedById: version.submittedById,
      reviewedAt: version.reviewedAt,
      reviewedById: version.reviewedById,
      rejectionReason: version.rejectionReason,
      content: version.content,
      syllabus: {
        id: version.syllabus.id,
        academicYear: version.syllabus.academicYear,
        semester: version.syllabus.semester,
        section: version.syllabus.section,
        status: version.syllabus.status,
        departmentId: sDept,
        department: { id: sDept, code: sDept, name: getDepartmentName(sDept) },
        course: {
          id: version.syllabus.course.id,
          code: version.syllabus.course.code,
          title: version.syllabus.course.title,
          units: version.syllabus.course.units,
          departmentId: version.syllabus.course.departmentId,
          professorName: version.syllabus.course.professorName || null,
          department: {
            id: version.syllabus.course.departmentId,
            code: version.syllabus.course.departmentId,
            name: getDepartmentName(version.syllabus.course.departmentId),
          },
        },
        instructor: version.syllabus.instructor
          ? {
              id: version.syllabus.instructor.id,
              idNumber: version.syllabus.instructor.id,
              fullName: version.syllabus.instructor.fullName,
              email: version.syllabus.instructor.email,
              academicRank: version.syllabus.instructor.academicRank,
            }
          : null,
      },
    };

    return NextResponse.json({ approval: formatted, version: formatted, syllabus: formatted.syllabus, previousApprovedVersion, isSelfSubmission });
  } catch (error: any) {
    console.error('Error fetching approval detail:', error);
    return NextResponse.json({ error: 'Failed to retrieve approval detail: ' + error.message }, { status: 500 });
  }
}
