import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req?: NextRequest) {
  const startTime = Date.now();
  try {
    const [
      departmentsCount,
      usersCount,
      adminsCount,
      deptHeadsCount,
      educatorsCount,
      studentsCount,
      subjectsCount,
      syllabiCount,
      versionsCount,
      auditLogsCount,
      enrollmentsCount,
      classSectionsCount,
    ] = await Promise.all([
      prisma.department.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'Admin' } }),
      prisma.user.count({ where: { role: 'DepartmentHead' } }),
      prisma.user.count({ where: { role: 'Educator' } }),
      prisma.user.count({ where: { role: 'Student' } }),
      prisma.subject.count(),
      prisma.syllabus.count(),
      prisma.syllabusVersion.count(),
      prisma.auditLog.count(),
      prisma.enrollment.count(),
      prisma.classSection.count(),
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
        departments: departmentsCount,
        users: usersCount,
        admin: usersCount, // Backwards-compatible alias
        admins: adminsCount,
        department_heads: deptHeadsCount,
        educators: educatorsCount,
        students: studentsCount,
        subjects: subjectsCount,
        courses: subjectsCount, // Backwards-compatible alias
        syllabi: syllabiCount,
        syllabus_versions: versionsCount,
        enrollments: enrollmentsCount,
        class_sections: classSectionsCount,
        audit_logs: auditLogsCount,
      },
      models: {
        Department: departmentsCount,
        User: usersCount,
        Subject: subjectsCount,
        Course: subjectsCount, // Backwards-compatible alias
        ClassSection: classSectionsCount,
        Syllabus: syllabiCount,
        SyllabusVersion: versionsCount,
        Enrollment: enrollmentsCount,
        AuditLog: auditLogsCount,
      },
      adminUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
