import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');
    const yearLevel = searchParams.get('yearLevel');
    const semester = searchParams.get('semester');

    const where: any = {};

    let studentDeptId: number | null = null;
    let enrolledSet = new Set<number>();

    if (user?.role === 'Student') {
      studentDeptId = user.departmentId ? Number(user.departmentId) : null;
      if (!studentDeptId) {
        const studentProfile = await prisma.student.findUnique({
          where: { userId: Number(user.id) },
          include: { departmentRel: true },
        });
        if (studentProfile?.departmentRel?.id) {
          studentDeptId = studentProfile.departmentRel.id;
        }
      }

      if (!studentDeptId) {
        return NextResponse.json({ subjects: [] });
      }

      where.departmentId = studentDeptId;

      const studentEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: Number(user.id),
          status: 'ENROLLED',
          subject: { departmentId: studentDeptId },
        },
        select: { subjectId: true },
      });
      enrolledSet = new Set(studentEnrollments.map((e) => e.subjectId));
    } else if (user?.role === 'DepartmentHead') {
      if (user.departmentId) {
        where.departmentId = Number(user.departmentId);
      }
    } else if (departmentId) {
      const parsedDeptId = Number(departmentId);
      if (!isNaN(parsedDeptId)) {
        where.departmentId = parsedDeptId;
      } else {
        const dept = await prisma.department.findUnique({ where: { code: departmentId } });
        if (dept) where.departmentId = dept.id;
      }
    }

    if (yearLevel) where.yearLevel = yearLevel;
    if (semester) where.semester = semester;

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        syllabi: {
          where: {
            status: { in: ['Approved', 'ACTIVE'] },
          },
          select: {
            id: true,
            status: true,
            academicYear: true,
            semester: true,
            currentVersionNumber: true,
            uploadedByUserId: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            syllabi: true,
          },
        },
      },
    });

    const formattedSubjects = subjects.map((s) => {
      const isEnrolled = enrolledSet.has(s.id);
      return {
        ...s,
        isEnrolled: user?.role === 'Student' ? isEnrolled : true,
        syllabi: user?.role === 'Student' && !isEnrolled ? [] : s.syllabi,
      };
    });

    return NextResponse.json({ subjects: formattedSubjects });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || user.role !== 'DepartmentHead') {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads can add courses or subjects. System Administrators cannot add courses.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      title,
      departmentId,
      description,
      units = 3,
      lecHours = 3,
      labHours = 0,
      prerequisite = 'None',
      yearLevel = '1st Year',
      semester = '1st Semester',
    } = body;

    // Validate required fields
    if (!code || !title || !departmentId) {
      return NextResponse.json({ error: 'Subject code, title, and department are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    // Resolve Department
    let targetDept = null;
    const numericDeptId = Number(departmentId);
    if (!isNaN(numericDeptId)) {
      targetDept = await prisma.department.findUnique({ where: { id: numericDeptId } });
    } else {
      targetDept = await prisma.department.findUnique({ where: { code: String(departmentId).trim().toUpperCase() } });
    }

    if (!targetDept) {
      return NextResponse.json({ error: 'Invalid department specified.' }, { status: 400 });
    }

    // Dept head scoping
    if (user.role === 'DepartmentHead' && user.departmentId && Number(user.departmentId) !== targetDept.id) {
      return NextResponse.json({ error: 'Department Heads may only manage subjects within their assigned department.' }, { status: 403 });
    }

    // Check duplicate
    const existing = await prisma.subject.findUnique({
      where: { code: upperCode },
    });

    if (existing) {
      return NextResponse.json({ error: `A subject with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const parsedUnits = Number(units) || 3;
    const parsedLecHours = Number(lecHours) || 3;
    const parsedLabHours = Number(labHours) || 0;

    // Create subject record in srvs_subjects with auto-increment integer ID
    const subject = await prisma.subject.create({
      data: {
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: parsedUnits,
        lecHours: parsedLecHours,
        labHours: parsedLabHours,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId: targetDept.id,
      },
      include: {
        department: true,
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateSubject',
      resultStatus: 'Success',
      description: `Created academic subject ${upperCode} - ${title.trim()} (${parsedUnits} Units, Lec: ${parsedLecHours}h, Lab: ${parsedLabHours}h)`,
      entityType: 'Subject',
      entityId: subject.id,
    });

    return NextResponse.json({ success: true, subject }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject: ' + error.message }, { status: 500 });
  }
}
