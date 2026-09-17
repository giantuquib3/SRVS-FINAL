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
      let deptId = user.departmentId ? Number(user.departmentId) : undefined;
      let deptCode: string | undefined = undefined;
      let deptName: string | undefined = undefined;

      if (!deptId) {
        const dh = await prisma.departmentHead.findUnique({
          where: { userId: currentUserId },
          include: { departmentRel: true },
        });
        if (dh?.departmentRel) {
          deptId = dh.departmentRel.id;
          deptCode = dh.departmentRel.code;
          deptName = dh.departmentRel.name;
        } else if (dh?.department) {
          deptCode = dh.department;
          const d = await prisma.department.findUnique({ where: { code: dh.department } });
          if (d) {
            deptId = d.id;
            deptName = d.name;
          }
        }
      } else {
        const d = await prisma.department.findUnique({ where: { id: deptId } });
        if (d) {
          deptCode = d.code;
          deptName = d.name;
        }
      }

      if (!deptId) {
        return NextResponse.json({
          role: 'DepartmentHead',
          department: null,
          stats: {
            totalCourses: 0,
            totalSyllabi: 0,
            draftSyllabi: 0,
            submittedSyllabi: 0,
            approvedSyllabi: 0,
            rejectedSyllabi: 0,
            educatorsCount: 0,
            studentsCount: 0,
            pendingRegistrations: 0,
            pendingApprovals: 0,
            missingSyllabi: 0,
          },
        });
      }

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
        prisma.subject.count({ where: { departmentId: deptId } }),
        prisma.syllabus.count({ where: { departmentId: deptId } }),
        prisma.syllabus.count({ where: { status: 'Draft', departmentId: deptId } }),
        prisma.syllabus.count({ where: { status: 'Submitted', departmentId: deptId } }),
        prisma.syllabus.count({ where: { status: 'Approved', departmentId: deptId } }),
        prisma.syllabus.count({ where: { status: 'Rejected', departmentId: deptId } }),
        prisma.faculty.count({
          where: {
            OR: [
              ...(deptCode ? [{ department: deptCode }] : []),
              ...(deptId ? [{ departmentRel: { id: deptId } }] : []),
            ],
          },
        }),
        prisma.student.count({
          where: {
            OR: [
              ...(deptCode ? [{ department: deptCode }] : []),
              ...(deptId ? [{ departmentRel: { id: deptId } }] : []),
            ],
          },
        }),
        prisma.user.count({ where: { accountStatus: 'PendingApproval', departmentId: deptId } }),
        prisma.syllabusVersion.count({
          where: {
            approvalStatus: 'PENDING_APPROVAL',
            syllabus: { departmentId: deptId },
          },
        }),
      ]);

      const missingSyllabi = Math.max(0, totalSubjects - approvedSyllabi);

      return NextResponse.json({
        role: 'DepartmentHead',
        department: {
          id: deptId,
          code: deptCode,
          name: deptName || (deptCode ? `${deptCode} Department` : null),
        },
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
      let educatorDeptId = user.departmentId ? Number(user.departmentId) : undefined;
      let educatorDeptCode: string | undefined = undefined;
      let educatorDeptName: string | undefined = undefined;

      if (!educatorDeptId) {
        const fac = await prisma.faculty.findUnique({
          where: { userId: currentUserId },
          include: { departmentRel: true },
        });
        if (fac?.departmentRel) {
          educatorDeptId = fac.departmentRel.id;
          educatorDeptCode = fac.departmentRel.code;
          educatorDeptName = fac.departmentRel.name;
        } else if (fac?.department) {
          educatorDeptCode = fac.department;
          const d = await prisma.department.findUnique({ where: { code: fac.department } });
          if (d) {
            educatorDeptId = d.id;
            educatorDeptName = d.name;
          }
        }
      } else {
        const d = await prisma.department.findUnique({ where: { id: educatorDeptId } });
        if (d) {
          educatorDeptCode = d.code;
          educatorDeptName = d.name;
        }
      }

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
        department: {
          id: educatorDeptId,
          code: educatorDeptCode,
          name: educatorDeptName || (educatorDeptCode ? `${educatorDeptCode} Department` : null),
        },
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
    let studentDeptId = user.departmentId ? Number(user.departmentId) : null;
    let studentDeptCode = user.departmentCode || '';
    let studentDeptName = user.departmentName || '';

    if (!studentDeptId) {
      const studentProfile = await prisma.student.findUnique({
        where: { userId: currentUserId },
        include: { departmentRel: true },
      });
      if (studentProfile?.departmentRel) {
        studentDeptId = studentProfile.departmentRel.id;
        studentDeptCode = studentProfile.departmentRel.code;
        studentDeptName = studentProfile.departmentRel.name;
      } else if (studentProfile?.department) {
        studentDeptCode = studentProfile.department;
        const d = await prisma.department.findUnique({ where: { code: studentProfile.department } });
        if (d) {
          studentDeptId = d.id;
          studentDeptName = d.name;
        }
      }
    }

    const enrollmentWhere: any = {
      studentId: currentUserId,
      status: 'ENROLLED',
    };
    if (studentDeptId) {
      enrollmentWhere.subject = { departmentId: studentDeptId };
    }

    const [enrolledCount, activeEnrollments] = await Promise.all([
      prisma.enrollment.count({ where: enrollmentWhere }),
      prisma.enrollment.findMany({
        where: enrollmentWhere,
        include: {
          subject: {
            include: {
              department: true,
              syllabi: {
                where: {
                  status: { in: ['Approved', 'APPROVED', 'ACTIVE', 'Active'] },
                  ...(studentDeptId ? { departmentId: studentDeptId } : {}),
                },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                take: 1,
                include: {
                  versions: {
                    where: { approvalStatus: { in: ['APPROVED', 'Approved'] } },
                    orderBy: { versionNumber: 'desc' },
                    take: 1,
                  },
                },
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
      department: {
        id: studentDeptId,
        code: studentDeptCode,
        name: studentDeptName,
      },
      enrolledSubjects: formattedEnrollments,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard data.' }, { status: 500 });
  }
}
