import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS } from '@/lib/status';

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
        totalRegistrarVp,
        totalDeans,
        totalDeptHeads,
        totalEducators,
        pendingUsers,
        passwordResetRequests,
        totalSubjects,
        totalSyllabi,
        pendingApprovals,
        recentLogs,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'Admin' } }),
        prisma.user.count({ where: { role: { in: ['Registrar', 'VPAcademics'] } } }),
        prisma.user.count({ where: { role: 'Dean' } }),
        prisma.user.count({ where: { role: 'DepartmentHead' } }),
        prisma.user.count({ where: { role: { in: ['Educator', 'Faculty'] } } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval' } }),
        prisma.user.findMany({
          where: { mustChangePassword: true },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, fullName: true, email: true, role: true, departmentId: true, updatedAt: true },
        }),
        prisma.subject.count(),
        prisma.syllabus.count(),
        prisma.syllabus.count({ where: { status: { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] } } }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

      const totalUsers = totalAdmins + totalRegistrarVp + totalDeans + totalDeptHeads + totalEducators;

      return NextResponse.json({
        role: 'Admin',
        stats: {
          totalUsers,
          totalAdmins,
          totalRegistrarVp,
          totalDeans,
          totalDeptHeads,
          totalEducators,
          pendingRegistrations: pendingUsers,
          passwordResetCount: passwordResetRequests.length,
          totalSubjects,
          totalCourses: totalSubjects, // Alias
          totalSyllabi,
          pendingApprovals,
          pendingSyllabi: pendingApprovals,
        },
        passwordResetRequests,
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

    // ─── DEAN & DEPARTMENT HEAD ──────────────────────────────────────────────
    if (user.role === 'DepartmentHead' || user.role === 'Dean') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      const deptName = getDepartmentName(deptCode);

      if (user.role === 'DepartmentHead' && !deptCode) {
        return NextResponse.json({
          role: user.role,
          department: null,
          stats: {
            totalSubjects: 0,
            totalCourses: 0,
            totalSyllabi: 0,
            draftSyllabi: 0,
            submittedSyllabi: 0,
            endorsedSyllabi: 0,
            approvedSyllabi: 0,
            rejectedSyllabi: 0,
            educatorsCount: 0,
            pendingRegistrations: 0,
            pendingApprovals: 0,
            missingSyllabi: 0,
          },
        });
      }

      const deptWhere = deptCode ? { departmentId: deptCode } : {};

      const [
        totalSubjects,
        totalSyllabi,
        draftSyllabi,
        submittedSyllabi,
        endorsedSyllabi,
        approvedSyllabi,
        rejectedSyllabi,
        educatorsCount,
        pendingRegistrations,
      ] = await Promise.all([
        prisma.subject.count({ where: deptWhere }),
        prisma.syllabus.count({ where: deptWhere }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.DRAFT, ...deptWhere } }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.SUBMITTED, ...deptWhere } }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.UNDER_REVIEW, ...deptWhere } }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.APPROVED, ...deptWhere } }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.REJECTED, ...deptWhere } }),
        prisma.user.count({ where: { role: { in: ['Educator', 'Faculty'] }, ...deptWhere } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', role: { in: ['Educator', 'Faculty'] }, ...deptWhere } }),
      ]);

      // For Dept Head, action queue is SUBMITTED (from Faculty); for Dean, action queue is UNDER_REVIEW (endorsed by Dept Head)
      const pendingApprovals = user.role === 'Dean' ? endorsedSyllabi : submittedSyllabi;
      const missingSyllabi = Math.max(0, totalSubjects - approvedSyllabi);

      return NextResponse.json({
        role: user.role,
        department: deptCode ? { id: deptCode, code: deptCode, name: deptName } : null,
        stats: {
          totalSubjects,
          totalCourses: totalSubjects, // Alias
          totalSyllabi,
          draftSyllabi,
          submittedSyllabi,
          endorsedSyllabi,
          approvedSyllabi,
          rejectedSyllabi,
          educatorsCount,
          pendingRegistrations,
          pendingApprovals,
          missingSyllabi,
        },
      });
    }

    // ─── FACULTY (EDUCATOR) ──────────────────────────────────────────────────
    if (user.role === 'Educator' || user.role === 'Faculty') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      const educatorIntId = !isNaN(parseInt(currentUserId, 10)) ? parseInt(currentUserId, 10) : 0;

      const [totalMySyllabi, draftCount, submittedCount, approvedCount, rejectedCount, recentSyllabi] =
        await Promise.all([
          prisma.syllabus.count({ where: { instructorId: educatorIntId } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: SYLLABUS_STATUS.DRAFT } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] } } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: SYLLABUS_STATUS.APPROVED } }),
          prisma.syllabus.count({ where: { instructorId: educatorIntId, status: SYLLABUS_STATUS.REJECTED } }),
          prisma.syllabus.findMany({
            where: { instructorId: educatorIntId },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            include: {
              subject: true,
              versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
            },
          }),
        ]);

      const formattedSyllabi = (recentSyllabi as any[]).map((s: any) => ({
        ...s,
        subject: s.subject,
        course: s.subject, // Alias
        subjectId: s.subjectId,
        courseId: s.subjectId, // Alias
      }));

      return NextResponse.json({
        role: 'Educator',
        department: { id: deptCode, code: deptCode, name: getDepartmentName(deptCode) },
        stats: { totalMySyllabi, draftCount, submittedCount, approvedCount, rejectedCount },
        recentSyllabi: formattedSyllabi,
      });
    }

    // ─── SCHOOL REGISTRAR & VP-ACADEMICS (READ-ONLY VIEW ALL SYLLABI) ────────
    const [totalSyllabi, approvedSyllabi, pendingSyllabi, totalSubjects, allSyllabi] = await Promise.all([
      prisma.syllabus.count(),
      prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.APPROVED } }),
      prisma.syllabus.count({ where: { status: { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] } } }),
      prisma.subject.count(),
      prisma.syllabus.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          subject: true,
          instructor: { select: { id: true, fullName: true, email: true, academicRank: true } },
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      }),
    ]);

    return NextResponse.json({
      role: user.role,
      stats: {
        totalSyllabi,
        approvedSyllabi,
        pendingSyllabi,
        totalSubjects,
      },
      allSyllabi,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard data.' }, { status: 500 });
  }
}
