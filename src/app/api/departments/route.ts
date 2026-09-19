import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    let list = DEPARTMENTS;
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      list = DEPARTMENTS.filter(
        (d) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
      );
    }

    const departmentsWithCounts = await Promise.all(
      list.map(async (dept) => {
        const [coursesCount, educatorsCount, studentsCount, deptHeadsCount, syllabiCount] = await Promise.all([
          prisma.course.count({ where: { departmentId: dept.code } }),
          prisma.user.count({ where: { role: 'Educator', departmentId: dept.code } }),
          prisma.user.count({ where: { role: 'Student', departmentId: dept.code } }),
          prisma.user.count({ where: { role: 'DepartmentHead', departmentId: dept.code } }),
          prisma.syllabus.count({ where: { departmentId: dept.code } }),
        ]);

        return {
          id: dept.code,
          code: dept.code,
          name: dept.name,
          description: dept.description,
          _count: {
            subjects: coursesCount,
            courses: coursesCount,
            users: educatorsCount + studentsCount + deptHeadsCount,
            educators: educatorsCount,
            students: studentsCount,
            syllabi: syllabiCount,
          },
        };
      })
    );

    return NextResponse.json({ departments: departmentsWithCounts });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments.' }, { status: 500 });
  }
}
