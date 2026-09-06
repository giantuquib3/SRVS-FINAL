import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Run counts across all 8 PostgreSQL tables
    const departmentsCount = await prisma.department.count();
    const coursesCount = await prisma.course.count();
    const usersCount = await prisma.user.count();
    const enrollmentsCount = await prisma.enrollment.count();
    const syllabiCount = await prisma.syllabus.count();
    const versionsCount = await prisma.syllabusVersion.count();
    const auditLogsCount = await prisma.auditLog.count();
    const notificationsCount = await prisma.notification.count();
    const adminUser = await prisma.user.findFirst({
      where: { role: 'Admin' },
      select: { id: true, email: true, fullName: true, role: true, accountStatus: true },
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'PostgreSQL (Supabase Pooler)',
      latencyMs: `${latencyMs}ms`,
      timestamp: new Date().toISOString(),
      tables: {
        srvs_departments: departmentsCount,
        srvs_courses: coursesCount,
        srvs_users: usersCount,
        srvs_enrollments: enrollmentsCount,
        srvs_syllabi: syllabiCount,
        srvs_syllabus_versions: versionsCount,
        srvs_audit_logs: auditLogsCount,
        srvs_notifications: notificationsCount,
      },
      seededAdmin: adminUser,
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
