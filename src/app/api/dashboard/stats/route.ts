import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS } from '@/lib/status';
import { countPendingEditRequestsForDepartment, listEditRequests } from '@/lib/edit-permissions';

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
          totalSubjects,
          totalCourses: totalSubjects, // Alias
          totalSyllabi,
          pendingApprovals,
          pendingSyllabi: pendingApprovals,
        },
        recentActivities: recentLogs.map((l: any) => ({
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
      const dbDept = deptCode ? await prisma.department.findUnique({ where: { id: deptCode } }) : null;
      const deptName = dbDept?.name || getDepartmentName(deptCode);

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
            pendingEditRequests: 0,
            missingSyllabi: 0,
          },
        });
      }

      const deptWhere = deptCode ? { departmentId: deptCode } : {};
      const versionDeptWhere = deptCode ? { syllabus: { departmentId: deptCode } } : {};

      const [
        totalSubjects,
        totalSyllabi,
        draftSyllabi,
        submittedVersions,
        deanPendingVersions,
        approvedSyllabi,
        rejectedVersions,
        educatorsCount,
        pendingRegistrations,
        pendingEditRequests,
      ] = await Promise.all([
        prisma.subject.count({ where: deptWhere }),
        prisma.syllabus.count({ where: deptWhere }),
        prisma.syllabusVersion.count({ where: { approvalStatus: SYLLABUS_STATUS.DRAFT, ...versionDeptWhere } }),
        prisma.syllabusVersion.count({ where: { approvalStatus: SYLLABUS_STATUS.SUBMITTED, ...versionDeptWhere } }),
        prisma.syllabusVersion.count({ where: { approvalStatus: SYLLABUS_STATUS.UNDER_REVIEW, ...versionDeptWhere } }),
        prisma.syllabus.count({ where: { status: SYLLABUS_STATUS.APPROVED, ...deptWhere } }),
        prisma.syllabusVersion.count({ where: { approvalStatus: SYLLABUS_STATUS.REJECTED, ...versionDeptWhere } }),
        prisma.user.count({ where: { role: { in: ['Educator', 'Faculty'] }, ...deptWhere } }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', role: { in: ['Educator', 'Faculty'] }, ...deptWhere } }),
        countPendingEditRequestsForDepartment(deptCode),
      ]);

      // Dept Head action queue = Faculty submissions (SUBMITTED); Dean action queue = Dept Head submissions (UNDER_REVIEW)
      const pendingApprovals = user.role === 'Dean' ? deanPendingVersions : submittedVersions;
      const missingSyllabi = Math.max(0, totalSubjects - approvedSyllabi);

      return NextResponse.json({
        role: user.role,
        department: deptCode ? { id: deptCode, code: deptCode, name: deptName } : null,
        stats: {
          totalSubjects,
          totalCourses: totalSubjects,
          totalSyllabi,
          draftSyllabi,
          submittedSyllabi: submittedVersions,
          endorsedSyllabi: deanPendingVersions,
          approvedSyllabi,
          rejectedSyllabi: rejectedVersions,
          educatorsCount,
          pendingRegistrations,
          pendingApprovals,
          pendingEditRequests,
          missingSyllabi,
        },
      });
    }

    // ─── FACULTY (EDUCATOR) ──────────────────────────────────────────────────
    if (user.role === 'Educator' || user.role === 'Faculty') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      const dbDept = deptCode ? await prisma.department.findUnique({ where: { id: deptCode } }) : null;
      const deptName = dbDept?.name || getDepartmentName(deptCode);
      const educatorIntId = !isNaN(parseInt(currentUserId, 10)) ? parseInt(currentUserId, 10) : 0;

      const deptWhere = deptCode ? { departmentId: deptCode } : {};

      const [totalMySyllabi, draftCount, submittedCount, approvedCount, rejectedCount, recentSyllabi, myEditReqs] =
        await Promise.all([
          prisma.syllabus.count({ where: deptWhere }),
          prisma.syllabusVersion.count({ where: { editorId: educatorIntId, approvalStatus: SYLLABUS_STATUS.DRAFT } }),
          prisma.syllabusVersion.count({
            where: {
              editorId: educatorIntId,
              approvalStatus: { in: [SYLLABUS_STATUS.SUBMITTED, SYLLABUS_STATUS.UNDER_REVIEW] },
            },
          }),
          prisma.syllabus.count({ where: { ...deptWhere, status: SYLLABUS_STATUS.APPROVED } }),
          prisma.syllabusVersion.count({ where: { editorId: educatorIntId, approvalStatus: SYLLABUS_STATUS.REJECTED } }),
          prisma.syllabus.findMany({
            where: deptWhere,
            orderBy: { updatedAt: 'desc' },
            take: 5,
            include: {
              subject: true,
              versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
            },
          }),
          listEditRequests({ facultyId: educatorIntId }),
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
        department: deptCode ? { id: deptCode, code: deptCode, name: deptName } : null,
        stats: {
          totalMySyllabi,
          draftCount,
          submittedCount,
          approvedCount,
          rejectedCount,
          grantedEditPermissions: myEditReqs.filter((r) => r.status === 'APPROVED').length,
          pendingEditRequests: myEditReqs.filter((r) => r.status === 'PENDING').length,
        },
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
