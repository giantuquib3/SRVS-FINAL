import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { getDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/students
 * Returns users with role=Student. Proxy for the unified users table.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const queryDept = searchParams.get('department') || searchParams.get('departmentId');
    const search = searchParams.get('search');
    const studentIdParam = searchParams.get('studentId') || searchParams.get('idNumber') || searchParams.get('userId') || searchParams.get('id');

    const where: any = { role: 'Student' };

    if (studentIdParam) {
      const sInt = parseInt(studentIdParam, 10);
      if (!isNaN(sInt)) where.id = sInt;
    }

    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ students: [], count: 0 });
      where.departmentId = deptCode;
    } else if (queryDept) {
      where.departmentId = String(queryDept).trim().toUpperCase();
    }

    if (search?.trim()) {
      const searchNum = parseInt(search.trim(), 10);
      where.OR = [
        { fullName: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        ...(!isNaN(searchNum) ? [{ id: searchNum }] : []),
      ];
    }

    const [rawStudents, allEnrollments] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          departmentId: true,
          yearLevel: true,
          accountStatus: true,
          createdAt: true,
        },
      }),
      prisma.enrollment.findMany({
        where: { status: 'ENROLLED' },
        select: { studentId: true, courseId: true },
      }),
    ]);

    const enrollmentMap = new Map<number, (string | number)[]>();
    for (const enr of allEnrollments) {
      if (!enrollmentMap.has(enr.studentId)) {
        enrollmentMap.set(enr.studentId, []);
      }
      enrollmentMap.get(enr.studentId)!.push(enr.courseId);
    }

    const students = rawStudents.map((s) => {
      const enrolledCourses = enrollmentMap.get(s.id) || [];

      return {
        id: s.id,
        idNumber: String(s.id),
        fullName: s.fullName,
        email: s.email,
        department: s.departmentId || null,
        departmentName: getDepartmentName(s.departmentId),
        yearLevel: s.yearLevel || '1st Year',
        accountStatus: s.accountStatus,
        enrolledCourses,
      };
    });

    return NextResponse.json({ students, count: students.length });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students.' }, { status: 500 });
  }
}
