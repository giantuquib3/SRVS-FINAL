import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only authorized Department Heads and Administrators may review syllabi.' }, { status: 403 });
    }

    const numericId = Number(params.id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid approval request ID.' }, { status: 400 });
    }

    let version = await prisma.syllabusVersion.findUnique({
      where: { id: numericId },
      include: {
        syllabus: {
          include: {
            subject: {
              include: { department: true },
            },
            instructor: {
              select: {
                id: true,
                idNumber: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            department: true,
          },
        },
        editor: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
          },
        },
      },
    });

    if (!version) {
      // Check if it was syllabusId
      version = await prisma.syllabusVersion.findFirst({
        where: { syllabusId: numericId },
        orderBy: { versionNumber: 'desc' },
        include: {
          syllabus: {
            include: {
              subject: {
                include: { department: true },
              },
              instructor: {
                select: {
                  id: true,
                  idNumber: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
              department: true,
            },
          },
          editor: {
            select: {
              id: true,
              idNumber: true,
              fullName: true,
              email: true,
            },
          },
          submittedBy: {
            select: {
              id: true,
              idNumber: true,
              fullName: true,
              email: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              idNumber: true,
              fullName: true,
            },
          },
        },
      });
    }

    if (!version) {
      return NextResponse.json({ error: 'Syllabus approval request not found.' }, { status: 404 });
    }

    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== version.syllabus.departmentId) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view approvals for this department.' }, { status: 403 });
    }

    const previousApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: version.syllabusId,
        approvalStatus: 'APPROVED',
        versionNumber: { lt: version.versionNumber },
      },
      orderBy: { versionNumber: 'desc' },
    });

    const isSelfSubmission =
      Number(user.id) === version.submittedById ||
      Number(user.id) === version.syllabus.instructorId;

    const formattedApproval = {
      ...version,
      syllabus: {
        ...version.syllabus,
        course: version.syllabus.subject,
        courseId: version.syllabus.subjectId,
      },
    };

    return NextResponse.json({
      approval: formattedApproval,
      previousApprovedVersion,
      isSelfSubmission,
    });
  } catch (error: any) {
    console.error('Error fetching approval detail:', error);
    return NextResponse.json({ error: 'Failed to retrieve approval detail: ' + error.message }, { status: 500 });
  }
}
