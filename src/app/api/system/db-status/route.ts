import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    const [
      departmentsCount,
      subjectsCount,
      usersCount,
      adminsCount,
      deptHeadsCount,
      facultiesCount,
      studentsCount,
      syllabiCount,
      versionsCount,
      enrollmentsCount,
    ] = await Promise.all([
      prisma.department.count(),
      prisma.subject.count(),
      prisma.user.count(),
      prisma.admin.count(),
      prisma.departmentHead.count(),
      prisma.faculty.count(),
      prisma.student.count(),
      prisma.syllabus.count(),
      prisma.syllabusVersion.count(),
      prisma.enrollment.count(),
    ]);

    const adminUser = await prisma.user.findFirst({
      where: { role: 'Admin' },
      select: { id: true, idNumber: true, email: true, fullName: true, role: true, accountStatus: true },
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'PostgreSQL (Supabase Pooler)',
      latencyMs: `${latencyMs}ms`,
      timestamp: new Date().toISOString(),
      tables: {
        srvs_departments: departmentsCount,
        srvs_subjects: subjectsCount,
        srvs_users: usersCount,
        srvs_admins: adminsCount,
        srvs_department_heads: deptHeadsCount,
        srvs_faculties: facultiesCount,
        srvs_students: studentsCount,
        srvs_syllabi: syllabiCount,
        srvs_syllabus_versions: versionsCount,
        srvs_enrollments: enrollmentsCount,
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
