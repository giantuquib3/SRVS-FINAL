import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName, isValidDepartmentCode } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// GET /api/department-head/faculty - List faculty within department
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const status = searchParams.get('status');

    let deptCode: string | null = null;
    if (sessionUser.role === 'DepartmentHead') {
      deptCode = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!deptCode) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }
    } else {
      // Admin can view all or filter by department
      const reqDept = searchParams.get('departmentId')?.trim().toUpperCase();
      if (reqDept && isValidDepartmentCode(reqDept)) {
        deptCode = reqDept;
      }
    }

    const where: any = {
      role: 'Educator',
    };

    if (deptCode) {
      where.departmentId = deptCode;
    }

    if (status) {
      where.accountStatus = status;
    }

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(!isNaN(searchNum) ? [{ id: searchNum }] : []),
      ];
    }

    const faculty = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        academicRank: true,
        accountStatus: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const formatted = faculty.map((f: any) => ({
      id: f.id,
      idNumber: f.id,
      email: f.email,
      fullName: f.fullName,
      role: f.role,
      departmentId: f.departmentId,
      departmentName: getDepartmentName(f.departmentId),
      academicRank: f.academicRank || 'Faculty Member',
      accountStatus: f.accountStatus,
      mustChangePassword: !!f.mustChangePassword,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return NextResponse.json({ faculty: formatted, total: formatted.length, departmentId: deptCode });
  } catch (error: any) {
    console.error('Error fetching department faculty:', error);
    return NextResponse.json({ error: 'Failed to fetch faculty: ' + error.message }, { status: 500 });
  }
}

// POST /api/department-head/faculty - Create new faculty in department
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser || (sessionUser.role !== 'DepartmentHead' && sessionUser.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Department Head or Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { idNumber, userId, email, fullName, academicRank, password, departmentId, accountStatus } = body;

    const cleanId = String(idNumber || userId || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim();

    if (!cleanId || !cleanEmail || !cleanName) {
      return NextResponse.json({ error: 'idNumber (5 digits), email, and fullName are required.' }, { status: 400 });
    }

    // Faculty ID must be exactly 5 digits
    if (!/^\d{5}$/.test(cleanId)) {
      return NextResponse.json({ error: 'Faculty ID number must be exactly 5 digits (e.g., 10001).' }, { status: 400 });
    }

    const numericId = parseInt(cleanId, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid ID number.' }, { status: 400 });
    }

    if (!cleanEmail.endsWith('@usjr.edu.ph')) {
      return NextResponse.json({ error: 'Institutional email must end with @usjr.edu.ph.' }, { status: 400 });
    }

    // Enforce strict Department Isolation
    let deptCode: string;
    if (sessionUser.role === 'DepartmentHead') {
      const userDept = sessionUser.departmentId ? String(sessionUser.departmentId).toUpperCase() : null;
      if (!userDept) {
        return NextResponse.json({ error: 'Forbidden: Department Head is not assigned to a department.' }, { status: 403 });
      }

      // If client supplied a different department, reject with 403
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

    const tempPassword = (password || '').trim() || 'USJR@Faculty2026';
    const passwordHash = await hashPassword(tempPassword);

    const newFaculty = await prisma.user.create({
      data: {
        id: numericId,
        email: cleanEmail,
        fullName: cleanName,
        passwordHash,
        role: 'Educator',
        departmentId: deptCode,
        accountStatus: accountStatus || 'Active',
        academicRank: academicRank?.trim() || 'Faculty Member',
        mustChangePassword: true,
      },
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userDisplayName: sessionUser.fullName || sessionUser.id,
      actionType: 'FacultyCreated',
      resultStatus: 'Success',
      description: `Created Faculty account: ${cleanName} (${numericId} - ${deptCode}) with temporary password. MustChangePassword set to true.`,
      entityType: 'User',
      entityId: String(numericId),
      ipAddress: req.ip || '127.0.0.1',
    });

    return NextResponse.json(
      {
        success: true,
        message: `Faculty account created successfully for ${cleanName}.`,
        user: {
          id: newFaculty.id,
          idNumber: newFaculty.id,
          email: newFaculty.email,
          fullName: newFaculty.fullName,
          role: 'Educator',
          departmentId: newFaculty.departmentId,
          departmentName: getDepartmentName(newFaculty.departmentId),
          academicRank: newFaculty.academicRank,
          accountStatus: newFaculty.accountStatus,
          mustChangePassword: true,
          createdAt: newFaculty.createdAt,
        },
        temporaryPassword: tempPassword,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating department faculty:', error);
    return NextResponse.json({ error: 'Failed to create faculty: ' + error.message }, { status: 500 });
  }
}
