import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDepartmentName } from '@/lib/departments';
import { studentSubjectInclude, formatStudentSubject } from '@/lib/enrollments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const userIdInt = parseInt(session.id, 10);
  if (isNaN(userIdInt)) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userIdInt },
  });

  if (!userRecord || (userRecord.accountStatus && userRecord.accountStatus !== 'Active')) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const isAdmin = userRecord.role === 'Admin';
  const deptCode = isAdmin ? null : (userRecord.departmentId || null);
  const deptName = isAdmin ? 'All Departments (Administration)' : getDepartmentName(deptCode);

  let userEnrollments: any[] = [];
  if (userRecord.role === 'Student') {
    const rows = await prisma.studentSubject.findMany({
      where: { studentId: userRecord.id, status: 'ENROLLED' },
      include: studentSubjectInclude,
    });
    userEnrollments = rows.map((r: any) => formatStudentSubject(r));
  }

  const enrolledCodes = userEnrollments
    .map((e) => e.subject?.code)
    .filter(Boolean)
    .join(', ');

  return NextResponse.json({
    user: {
      id: userRecord.id,
      idNumber: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.fullName,
      role: userRecord.role,
      departmentId: deptCode,
      departmentCode: deptCode,
      departmentName: deptName,
      title: userRecord.academicRank || (userRecord.role === 'DepartmentHead' ? 'Department Chairperson' : null),
      academicRank: userRecord.academicRank || (userRecord.role === 'Educator' ? 'Faculty Member' : null),
      yearLevel: userRecord.yearLevel || (userRecord.role === 'Student' ? '1st Year' : null),
      program: userRecord.program || null,
      mustChangePassword: !!userRecord.mustChangePassword,
      enrolledSubjects: enrolledCodes,
      enrollments: userEnrollments,
    },
  });
}
