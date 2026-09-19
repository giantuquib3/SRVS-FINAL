import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const currentUserId = user.id;

    // ─── ADMIN ───────────────────────────────────────────────────────────────
    if (user.role === 'Admin') {
      const [
        totalAdmins,
        totalDeptHeads,
        totalEducators,
        totalStudents,
        pendingUsers,
        totalCourses,
        totalSyllabi,
        pendingApprovals,
        recentLogs,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'Admin' } }),
        prisma.user.count({ where: { role: 'DepartmentHead' } }),
        prisma.user.count({ where: { role: 'Educator' } }),
        prisma.user.count({ where: { role: 'Student' } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval' } }),
        prisma.course.count(),
        prisma.syllabus.count(),
        prisma.syllabus.count({ where: { status: { in: ['PENDING_APPROVAL', 'Submitted'] } } }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

      const totalUsers = totalAdmins + totalDeptHeads + totalEducators + totalStudents;

      return NextResponse.json({
        role: 'Admin',
        stats: {
          totalUsers,
          totalAdmins,
          totalDeptHeads,
          totalEducators,
          totalStudents,
          pendingRegistrations: pendingUsers,
          totalCourses,
          totalSyllabi,
          pendingApprovals,
          pendingSyllabi: pendingApprovals,
        },
        recentActivities: recentLogs.map((l) => ({
          id: l.id,
          actionType: l.actionType,
          description: l.description,
          createdAt: l.createdAt,
          userDisplayName: l.userDisplayName,
          resultStatus: l.resultStatus,
          user: { fullName: l.userDisplayName, role: 'System' },
        })),
      });
    }

    // ─── DEPARTMENT HEAD ─────────────────────────────────────────────────────
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      const deptName = getDepartmentName(deptCode);

      if (!deptCode) {
        return NextResponse.json({
          role: 'DepartmentHead',
          department: null,
          stats: { totalCourses: 0, totalSyllabi: 0, draftSyllabi: 0, submittedSyllabi: 0, approvedSyllabi: 0, rejectedSyllabi: 0, educatorsCount: 0, studentsCount: 0, pendingRegistrations: 0, pendingApprovals: 0, missingSyllabi: 0 },
        });
      }

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
        pendingApprovals,
      ] = await Promise.all([
        prisma.course.count({ where: { departmentId: deptCode } }),
        prisma.syllabus.count({ where: { departmentId: deptCode } }),
        prisma.syllabus.count({ where: { status: { in: ['Draft', 'DRAFT'] }, departmentId: deptCode } }),
        prisma.syllabus.count({ where: { status: { in: ['Submitted', 'PENDING_APPROVAL'] }, departmentId: deptCode } }),
        prisma.syllabus.count({ where: { status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] }, departmentId: deptCode } }),
        prisma.syllabus.count({ where: { status: { in: ['Rejected', 'REJECTED'] }, departmentId: deptCode } }),
        prisma.user.count({ where: { role: 'Educator', departmentId: deptCode } }),
        prisma.user.count({ where: { role: 'Student', departmentId: deptCode } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', departmentId: deptCode } }),
        prisma.syllabus.count({ where: { status: { in: ['PENDING_APPROVAL', 'Submitted'] }, departmentId: deptCode } }),
      ]);

      const missingSyllabi = Math.max(0, totalCourses - approvedSyllabi);

      return NextResponse.json({
        role: 'DepartmentHead',
        department: { id: deptCode, code: deptCode, name: deptName },
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
          pendingApprovals,
          missingSyllabi,
        },
      });
    }

    // ─── EDUCATOR ────────────────────────────────────────────────────────────
    if (user.role === 'Educator') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      const educatorIntId = !isNaN(parseInt(currentUserId, 10)) ? parseInt(currentUserId, 10) : 0;

      const [totalMySyllabi, draftCount, submittedCount, approvedCount, rejectedCount, recentSyllabi] =
        await Promise.all([
          prisma.syllabus.count({ where: { instructorId: educatorIntId } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: { in: ['Draft', 'DRAFT'] } } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: { in: ['Submitted', 'PENDING_APPROVAL'] } } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: { in: ['Rejected', 'REJECTED'] } } }),
          prisma.syllabus.findMany({
            where: { instructorId: educatorIntId },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            include: {
              course: true,
              versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
            },
          }),
        ]);

      const formattedSyllabi = (recentSyllabi as any[]).map((s: any) => ({
        ...s,
        subject: s.course,
        subjectId: s.courseId,
      }));

      return NextResponse.json({
        role: 'Educator',
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        stats: { totalMySyllabi, draftCount, submittedCount, approvedCount, rejectedCount },
        recentSyllabi: formattedSyllabi,
      });
    }

    // ─── STUDENT ─────────────────────────────────────────────────────────────
    const studentDeptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : '';

    const studentIntId = parseInt(currentUserId, 10);
    const enrollments = !isNaN(studentIntId)
      ? await prisma.enrollment.findMany({
          where: { studentId: studentIntId, status: 'ENROLLED' },
          include: {
            course: {
              include: {
                syllabi: {
                  where: { status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] } },
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        })
      : [];

    const availableSyllabiCount = enrollments.filter((e: any) => e.course?.syllabi?.length > 0).length;

    const formattedEnrollments = enrollments.map((e: any) => {
      const deptCode = String(e.course.departmentId || '');
      return {
        id: `${e.studentId}_${e.courseId}`,
        studentId: e.studentId,
        studentName: e.studentName,
        courseId: e.courseId,
        subjectId: e.courseId,
        course: {
          ...e.course,
          department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        },
        subject: e.course,
      };
    });

    return NextResponse.json({
      role: 'Student',
      stats: {
        enrolledCount: enrollments.length,
        availableSyllabiCount,
        unreadNotifications: 0,
      },
      department: {
        id: studentDeptCode,
        code: studentDeptCode,
        name: getDepartmentName(studentDeptCode),
      },
      enrolledSubjects: formattedEnrollments,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard data.' }, { status: 500 });
  }
}
