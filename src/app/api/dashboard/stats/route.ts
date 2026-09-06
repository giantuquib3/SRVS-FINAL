import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const currentUserId = Number(user.id);

    if (user.role === 'Admin') {
      const [
        totalUsers,
        pendingRegistrations,
        totalSyllabi,
        totalVersions,
        recentVersions,
        pendingApprovals,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { accountStatus: 'PendingApproval' } }),
        prisma.syllabus.count(),
        prisma.syllabusVersion.count(),
        prisma.syllabusVersion.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            editor: {
              select: {
                fullName: true,
                role: true,
              },
            },
            syllabus: {
              include: {
                subject: true,
              },
            },
          },
        }),
        prisma.syllabusVersion.count({ where: { approvalStatus: 'PENDING_APPROVAL' } }),
      ]);

      const recentActivities = recentVersions.map((v) => ({
        id: v.id,
        actionType: v.changeType,
        description: `Version ${v.versionNumber} (${v.approvalStatus}) for ${v.syllabus?.subject?.code || 'Syllabus'}`,
        createdAt: v.createdAt,
        user: {
          fullName: v.editor.fullName,
          role: v.editor.role,
        },
      }));

      return NextResponse.json({
        role: 'Admin',
        stats: {
          totalUsers,
          pendingRegistrations,
          totalSyllabi,
          totalVersions,
          pendingApprovals,
        },
        recentActivities,
      });
    }

    if (user.role === 'DepartmentHead') {
      const deptId = user.departmentId ? Number(user.departmentId) : undefined;
      const [
        totalSubjects,
        totalSyllabi,
        draftSyllabi,
        submittedSyllabi,
        approvedSyllabi,
        rejectedSyllabi,
        educatorsCount,
        studentsCount,
        pendingRegistrations,
        pendingApprovals,
      ] = await Promise.all([
        prisma.subject.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.syllabus.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.syllabus.count({ where: { status: 'Draft', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Submitted', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Approved', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Rejected', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.faculty.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.student.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabusVersion.count({
          where: {
            approvalStatus: 'PENDING_APPROVAL',
            ...(deptId ? { syllabus: { departmentId: deptId } } : {}),
          },
        }),
      ]);

      const missingSyllabi = Math.max(0, totalSubjects - approvedSyllabi);

      return NextResponse.json({
        role: 'DepartmentHead',
        stats: {
          totalCourses: totalSubjects,
          totalSyllabi,
          draftSyllabi,
          submittedSyllabi,
          approvedSyllabi,
          rejectedSyllabi,
          educatorsCount,
          studentsCount,
          pendingRegistrations,
          pendingApprovals,
          missingSyllabi,
        },
      });
    }

    if (user.role === 'Educator') {
      const [
        totalMySyllabi,
        draftCount,
        submittedCount,
        approvedCount,
        rejectedCount,
        recentSyllabi,
      ] = await Promise.all([
        prisma.syllabus.count({ where: { instructorId: currentUserId } }),
        prisma.syllabus.count({ where: { instructorId: currentUserId, status: 'Draft' } }),
        prisma.syllabus.count({ where: { instructorId: currentUserId, status: 'Submitted' } }),
        prisma.syllabus.count({ where: { instructorId: currentUserId, status: 'Approved' } }),
        prisma.syllabus.count({ where: { instructorId: currentUserId, status: 'Rejected' } }),
        prisma.syllabus.findMany({
          where: { instructorId: currentUserId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            subject: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        }),
      ]);

      const formattedSyllabi = recentSyllabi.map((s) => ({
        ...s,
        course: s.subject,
      }));

      return NextResponse.json({
        role: 'Educator',
        stats: {
          totalMySyllabi,
          draftCount,
          submittedCount,
          approvedCount,
          rejectedCount,
          unreadNotifications: 0,
        },
        recentSyllabi: formattedSyllabi,
      });
    }

    // Student role
    const [enrolledCount, activeEnrollments] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: currentUserId, status: 'ENROLLED' } }),
      prisma.enrollment.findMany({
        where: { studentId: currentUserId, status: 'ENROLLED' },
        include: {
          subject: {
            include: {
              department: true,
              syllabi: {
                where: { status: { in: ['Approved', 'ACTIVE'] } },
                orderBy: { currentVersionNumber: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const formattedEnrollments = activeEnrollments.map((e) => ({
      ...e,
      course: e.subject,
    }));

    const availableSyllabiCount = activeEnrollments.filter((e) => {
      return e.subject?.syllabi && e.subject.syllabi.length > 0;
    }).length;

    return NextResponse.json({
      role: 'Student',
      stats: {
        enrolledCount,
        availableSyllabiCount,
        unreadNotifications: 0,
      },
      enrolledSubjects: formattedEnrollments,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard data.' }, { status: 500 });
  }
}
