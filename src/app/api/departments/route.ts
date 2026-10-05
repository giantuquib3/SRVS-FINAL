import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    // Retrieve from database table departments, fallback to constant if empty or error
    let dbDepts: any[] = [];
    try {
      dbDepts = await prisma.department.findMany({
        orderBy: { code: 'asc' },
      });
    } catch (dbErr) {
      console.warn('[Departments API] Database query failed, falling back to static DEPARTMENTS:', dbErr);
    }

    let list = dbDepts && dbDepts.length > 0 ? dbDepts : DEPARTMENTS;

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d: any) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
      );
    }

    let departmentsWithCounts: any[];
    try {
      departmentsWithCounts = await Promise.all(
        list.map(async (dept: any) => {
          try {
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
          } catch {
            return {
              id: dept.code,
              code: dept.code,
              name: dept.name,
              description: dept.description,
              _count: { subjects: 0, courses: 0, users: 0, educators: 0, students: 0, syllabi: 0 },
            };
          }
        })
      );
    } catch {
      departmentsWithCounts = list.map((dept: any) => ({
        id: dept.code,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        _count: { subjects: 0, courses: 0, users: 0, educators: 0, students: 0, syllabi: 0 },
      }));
    }

    return NextResponse.json({ departments: departmentsWithCounts });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({
      departments: DEPARTMENTS.map((d) => ({
        id: d.code,
        code: d.code,
        name: d.name,
        description: d.description,
        _count: { subjects: 0, courses: 0, users: 0, educators: 0, students: 0, syllabi: 0 },
      })),
    });
  }
}
