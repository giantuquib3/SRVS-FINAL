import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req?: NextRequest) {
  const startTime = Date.now();
  try {
    const [
      usersCount,
      adminsCount,
      deptHeadsCount,
      educatorsCount,
      studentsCount,
      coursesCount,
      syllabiCount,
      versionsCount,
      auditLogsCount,
      enrollmentsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'Admin' } }),
      prisma.user.count({ where: { role: 'DepartmentHead' } }),
      prisma.user.count({ where: { role: 'Educator' } }),
      prisma.user.count({ where: { role: 'Student' } }),
      prisma.course.count(),
      prisma.syllabus.count(),
      prisma.syllabusVersion.count(),
      prisma.auditLog.count(),
      prisma.enrollment.count(),
    ]);

    const adminUser = await prisma.user.findFirst({
      where: { role: 'Admin' },
      select: { id: true, email: true, fullName: true, departmentId: true },
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'PostgreSQL (Supabase Pooler)',
      latencyMs: `${latencyMs}ms`,
      timestamp: new Date().toISOString(),
      tables: {
        admin: usersCount,
        admins: adminsCount,
        department_heads: deptHeadsCount,
        educators: educatorsCount,
        students: studentsCount,
        courses: coursesCount,
        syllabi: syllabiCount,
        syllabus_versions: versionsCount,
        enrollments: enrollmentsCount,
        audit_logs: auditLogsCount,
      },
      seededAdmin: adminUser ? { ...adminUser, role: 'Admin' } : null,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'PostgreSQL',
        latencyMs: `${latencyMs}ms`,
        error: error.message || 'Failed to query database.',
      },
      { status: 500 }
    );
  }
}
