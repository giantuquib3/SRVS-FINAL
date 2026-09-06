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

    const { id } = params;

    // The ID could either be the SyllabusVersion ID or the Syllabus ID
    let version = await prisma.syllabusVersion.findUnique({
      where: { id },
      include: {
        syllabus: {
          include: {
            course: {
              include: { department: true },
            },
            instructor: {
              select: {
                id: true,
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
            fullName: true,
            email: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
        approvalLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // If not found by version ID, check if it's a syllabus ID and fetch latest pending/active version
    if (!version) {
      const syllabus = await prisma.syllabus.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (syllabus && syllabus.versions.length > 0) {
        return GET(req, { params: { id: syllabus.versions[0].id } });
      }

      return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 });
    }

    // Strictly enforce Department authorization
    if (user.role === 'DepartmentHead' && user.departmentId !== version.syllabus.departmentId) {
      return NextResponse.json({
        error: 'Forbidden: You are only authorized to review syllabi belonging to your department.',
      }, { status: 403 });
    }

    // Locate the previous approved version (for comparison / version diffing)
    const previousApprovedVersion = await prisma.syllabusVersion.findFirst({
      where: {
        syllabusId: version.syllabusId,
        approvalStatus: 'APPROVED',
        versionNumber: { lt: version.versionNumber },
      },
      orderBy: { versionNumber: 'desc' },
      include: {
        editor: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Determine if reviewer is attempting self-review
    const isSelfSubmission =
      user.id === version.submittedById ||
      user.id === version.syllabus.instructorId;

    return NextResponse.json({
      version,
      syllabus: version.syllabus,
      previousApprovedVersion,
      isSelfSubmission,
    });
  } catch (error: any) {
    console.error('Error fetching approval details:', error);
    return NextResponse.json({ error: 'Failed to retrieve approval request: ' + error.message }, { status: 500 });
  }
}
