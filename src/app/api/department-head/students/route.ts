import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// GET /api/department-head/students - List students within department
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const status = searchParams.get('status');
    const yearLevel = searchParams.get('yearLevel');

    let deptCode: string | null = null;
    if (sessionUser.role === 'DepartmentHead') {
      deptCode = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!deptCode) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }
    } else {
      // Admin
      const reqDept = searchParams.get('departmentId')?.trim().toUpperCase();
      if (reqDept && isValidDepartmentCode(reqDept)) {
        deptCode = reqDept;
      }
    }

    const where: any = {
      role: 'Student',
    };

    if (deptCode) {
      where.departmentId = deptCode;
    }

    if (status) {
      where.accountStatus = status;
    }

    if (yearLevel) {
      where.yearLevel = yearLevel;
    }

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(!isNaN(searchNum) ? [{ id: searchNum }] : []),
      ];
    }

    const students = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        yearLevel: true,
        program: true,
        accountStatus: true,
        mustChangePassword: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        enrollments: {
          where: { status: 'ENROLLED' },
          select: {
            classSection: { select: { subject: { select: { code: true, title: true } } } },
          },
        },
      },
    });

    const formatted = students.map((s: any) => {
      const subjectCodes = (s.enrollments || []).map((e: any) => e.classSection?.subject?.code).filter(Boolean);
      return {
        id: s.id,
        idNumber: s.id,
        email: s.email,
        fullName: s.fullName,
        role: s.role,
        departmentId: s.departmentId,
        departmentName: getDepartmentName(s.departmentId),
        yearLevel: s.yearLevel || '1st Year',
        program: s.program || null,
        accountStatus: s.accountStatus,
        mustChangePassword: !!s.mustChangePassword,
        rejectionReason: s.rejectionReason,
        enrolledSubjects: subjectCodes,
        enrolledCourses: subjectCodes, // Alias for backward compatibility
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({ students: formatted, total: formatted.length, departmentId: deptCode });
  } catch (error: any) {
    console.error('Error fetching department students:', error);
    return NextResponse.json({ error: 'Failed to fetch students: ' + error.message }, { status: 500 });
  }
}

// POST /api/department-head/students - Create new student in department
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { idNumber, studentId, userId, email, fullName, yearLevel, program, password, departmentId, accountStatus } = body;

    const cleanId = String(idNumber || studentId || userId || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim();

    if (!cleanId || !cleanEmail || !cleanName) {
      return NextResponse.json({ error: 'idNumber (10 digits), email, and fullName are required.' }, { status: 400 });
    }

    // Student ID must be exactly 10 digits
    if (!/^\d{10}$/.test(cleanId)) {
      return NextResponse.json({ error: 'Student ID number must be exactly 10 digits (e.g., 2022012708).' }, { status: 400 });
    }

    const numericId = parseInt(cleanId, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid Student ID number.' }, { status: 400 });
    }

    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      return NextResponse.json({ error: 'Institutional email must end with @usjr.edu.ph.' }, { status: 400 });
    }

    // Strict Department-Based Authorization
    let deptCode: string;
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }

      // Check if request body tried to override department
      if (departmentId && String(departmentId).toUpperCase() !== userDept) {
        return NextResponse.json({
          error: `Forbidden: You are only authorized to manage resources in department ${userDept}. Cross-department operations are prohibited.`,
        }, { status: 403 });
      }

      deptCode = userDept;
    } else {
      // Admin
      const reqDept = departmentId ? String(departmentId).trim().toUpperCase() : null;
      if (!reqDept || !isValidDepartmentCode(reqDept)) {
        return NextResponse.json({ error: 'Valid departmentId is required (CPE, EE, CE, ECE, IE, ME).' }, { status: 400 });
      }
      deptCode = reqDept;
    }

    // Check unique ID or email
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: numericId }, { email: cleanEmail }] },
    });
    if (existing) {
      if (existing.id === numericId) {
        return NextResponse.json({ error: `User with ID Number ${cleanId} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
    }

    const tempPassword = (password || '').trim() || 'USJR@Student2026';
    const passwordHash = await hashPassword(tempPassword);

    const newStudent = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        fullName: cleanName,
        passwordHash,
        role: 'Student',
        departmentId: deptCode,
        accountStatus: accountStatus || 'Active',
        yearLevel: yearLevel?.trim() || '1st Year',
        program: program?.trim() || null,
        mustChangePassword: true,
      },
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType: 'StudentCreated',
      resultStatus: 'Success',
      description: `Created Student account: ${cleanName} (${numericId} - ${deptCode}) with temporary password. MustChangePassword set to true.`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        success: true,
        message: `Student account created successfully for ${cleanName}.`,
        user: {
          id: newStudent.id,
          idNumber: newStudent.id,
          email: newStudent.email,
          fullName: newStudent.fullName,
          role: 'Student',
          departmentId: newStudent.departmentId,
          departmentName: getDepartmentName(newStudent.departmentId),
          yearLevel: newStudent.yearLevel,
          program: newStudent.program,
          accountStatus: newStudent.accountStatus,
          mustChangePassword: true,
          createdAt: newStudent.createdAt,
        },
        temporaryPassword: tempPassword,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating department student:', error);
    return NextResponse.json({ error: 'Failed to create student: ' + error.message }, { status: 500 });
  }
}
