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

    if (user.role === 'Admin') {
      const [
        totalUsers,
        pendingRegistrations,
        totalSyllabi,
        totalVersions,
        recentActivities,
        pendingSyllabi,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { accountStatus: 'PendingApproval' } }),
        prisma.syllabus.count(),
        prisma.syllabusVersion.count(),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            user: {
              select: {
                fullName: true,
                role: true,
              },
            },
          },
        }),
        prisma.syllabus.count({ where: { status: 'Submitted' } }),
      ]);

      return NextResponse.json({
        role: 'Admin',
        stats: {
          totalUsers,
          pendingRegistrations,
          totalSyllabi,
          totalVersions,
          pendingSyllabi,
        },
        recentActivities,
      });
    }

    if (user.role === 'DepartmentHead') {
      const deptId = user.departmentId;
      const [
        totalCourses,
        totalSyllabi,
        draftSyllabi,
        submittedSyllabi,
        approvedSyllabi,
        rejectedSyllabi,
        educatorsCount,
        studentsCount,
        pendingRegistrations,
      ] = await Promise.all([
        prisma.course.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.syllabus.count({ where: deptId ? { departmentId: deptId } : {} }),
        prisma.syllabus.count({ where: { status: 'Draft', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Submitted', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Approved', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.syllabus.count({ where: { status: 'Rejected', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.user.count({ where: { role: 'Educator', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.user.count({ where: { role: 'Student', ...(deptId ? { departmentId: deptId } : {}) } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', ...(deptId ? { departmentId: deptId } : {}) } }),
      ]);

      const missingSyllabi = Math.max(0, totalCourses - approvedSyllabi);

      return NextResponse.json({
        role: 'DepartmentHead',
        stats: {
          totalCourses,
          totalSyllabi,
          draftSyllabi,
          submittedSyllabi,
          approvedSyllabi,
          rejectedSyllabi,
          educatorsCount,
          studentsCount,
          pendingRegistrations,
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
        unreadNotifications,
        recentSyllabi,
      ] = await Promise.all([
        prisma.syllabus.count({ where: { instructorId: user.id } }),
        prisma.syllabus.count({ where: { instructorId: user.id, status: 'Draft' } }),
        prisma.syllabus.count({ where: { instructorId: user.id, status: 'Submitted' } }),
        prisma.syllabus.count({ where: { instructorId: user.id, status: 'Approved' } }),
        prisma.syllabus.count({ where: { instructorId: user.id, status: 'Rejected' } }),
        prisma.notification.count({ where: { userId: user.id, isRead: false } }),
        prisma.syllabus.findMany({
          where: { instructorId: user.id },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            course: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        }),
      ]);

      return NextResponse.json({
        role: 'Educator',
        stats: {
          totalMySyllabi,
          draftCount,
          submittedCount,
          approvedCount,
          rejectedCount,
          unreadNotifications,
        },
        recentSyllabi,
      });
    }

    // Student role
    const [enrolledCount, unreadNotifications, activeEnrollments] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: user.id, status: 'ENROLLED' } }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
      prisma.enrollment.findMany({
        where: { studentId: user.id, status: 'ENROLLED' },
        include: {
          course: {
            include: {
              department: true,
              syllabi: {
                where: { status: 'Approved' },
                orderBy: { currentVersionNumber: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const availableSyllabiCount = activeEnrollments.filter(
      (e) => e.course.syllabi && e.course.syllabi.length > 0
    ).length;

    return NextResponse.json({
      role: 'Student',
      stats: {
        enrolledCount,
        availableSyllabiCount,
        unreadNotifications,
      },
      enrolledSubjects: activeEnrollments,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard data.' }, { status: 500 });
  }
}
