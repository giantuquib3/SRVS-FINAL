import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getDepartmentName } from '@/lib/departments';
import { SYLLABUS_STATUS, DEFAULT_ACADEMIC_YEAR } from '@/lib/status';
import { createDefaultSyllabusContent } from '@/lib/syllabus-template';
import { getFacultyEditPermissionsMap } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const departmentId = searchParams.get('departmentId');
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId') || searchParams.get('id');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode') || searchParams.get('code');
    const semester = searchParams.get('semester');
    const yearLevel = searchParams.get('yearLevel');

    const where: any = {};

    // Department Isolation
    if (user?.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (!deptCode) return NextResponse.json({ subjects: [], courses: [] });
      where.departmentId = deptCode;
    } else if (user?.role === 'Dean') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) {
        where.departmentId = deptCode;
      } else if (departmentId) {
        where.departmentId = String(departmentId).trim().toUpperCase();
      }
    } else if (user?.role === 'Educator' || user?.role === 'Faculty') {
      const deptCode = user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;
      if (deptCode) where.departmentId = deptCode;
    } else if (departmentId) {
      where.departmentId = String(departmentId).trim().toUpperCase();
    }

    // subjectId: internal database record ID
    if (subjectIdParam) {
      const parsedId = parseInt(subjectIdParam, 10);
      if (!isNaN(parsedId)) {
        where.id = parsedId;
      }
    }

    // subjectCode: institutional subject code (e.g., CPE101)
    if (subjectCodeParam) {
      where.code = subjectCodeParam.trim().toUpperCase();
    }

    if (semester) where.semester = semester;
    if (yearLevel) where.yearLevel = yearLevel;

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { professorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Enrolled / requested subjects for student check
    const studentEnrollmentMap = new Map<string, { id: number; status: string; academicYear: string; semester: string }>();
    if (user?.role === 'Student') {
      const studentIntId = parseInt(user.id, 10);
      const studentSubjects = !isNaN(studentIntId)
        ? await prisma.studentSubject.findMany({
            where: { studentId: studentIntId },
            select: {
              id: true,
              status: true,
              academicYear: true,
              semester: true,
              subject: { select: { code: true } },
            },
          })
        : [];
      for (const ss of studentSubjects) {
        const code = ss.subject?.code?.toUpperCase();
        if (code) {
          studentEnrollmentMap.set(code, {
            id: ss.id,
            status: ss.status,
            academicYear: ss.academicYear,
            semester: ss.semester,
          });
        }
      }
    }

    const includeStudentsParam = searchParams.get('includeStudents');
    const shouldIncludeStudents = (user?.role === 'Admin' || user?.role === 'DepartmentHead') && (includeStudentsParam === 'true' || Boolean(subjectIdParam) || Boolean(subjectCodeParam));

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        department: true,
        syllabi: {
          where: user?.role === 'Student' ? { status: SYLLABUS_STATUS.APPROVED } : undefined,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            academicYear: true,
            semester: true,
            currentVersionNumber: true,
            instructor: { select: { id: true, fullName: true } },
          },
        },
        ...(shouldIncludeStudents ? {
          studentSubjects: {
            where: { status: 'ENROLLED' },
            orderBy: { studentId: 'asc' },
            select: {
              id: true,
              studentId: true,
              status: true,
              academicYear: true,
              semester: true,
              createdAt: true,
              student: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  departmentId: true,
                  yearLevel: true,
                },
              },
            },
          },
        } : {}),
        _count: { select: { syllabi: true, studentSubjects: { where: { status: 'ENROLLED' } } } },
      },
    });

    const isFacultyUser = user?.role === 'Educator' || user?.role === 'Faculty';
    const currentUserIdInt = user ? parseInt(user.id, 10) || 0 : 0;
    const allSyllabusIds = isFacultyUser
      ? subjects.flatMap((s: any) => (s.syllabi || []).map((sy: any) => sy.id))
      : [];
    const editPermMap =
      isFacultyUser && currentUserIdInt > 0 && allSyllabusIds.length > 0
        ? await getFacultyEditPermissionsMap(currentUserIdInt, allSyllabusIds)
        : new Map();

    const formatted = subjects.map((s: any) => {
      const deptCode = String(s.departmentId || '');
      const deptName = s.department?.name || getDepartmentName(deptCode);
      const studentEnrollment = user?.role === 'Student' ? studentEnrollmentMap.get(s.code.toUpperCase()) || null : null;
      const enrollmentStatus = studentEnrollment?.status || null;
      const isEnrolled = user?.role === 'Student' ? enrollmentStatus === 'ENROLLED' : true;
      const assignedProf =
        s.professorName ||
        s.syllabi?.[0]?.instructor?.fullName ||
        null;
      const enrolledStudents = shouldIncludeStudents
        ? (s.studentSubjects || []).map((ss: any) => ({
            enrollmentId: ss.id,
            studentId: ss.studentId,
            idNumber: ss.studentId,
            fullName: ss.student?.fullName,
            studentName: ss.student?.fullName,
            email: ss.student?.email,
            departmentId: ss.student?.departmentId,
            yearLevel: ss.student?.yearLevel,
            status: ss.status,
            academicYear: ss.academicYear,
            semester: ss.semester,
            enrolledAt: ss.createdAt,
          }))
        : undefined;
      const enrichedSyllabi = (s.syllabi || []).map((sy: any) => ({
        ...sy,
        editPermissionStatus: isFacultyUser
          ? editPermMap.get(sy.id)?.status || 'NONE'
          : user?.role === 'DepartmentHead'
          ? 'DIRECT_ACCESS'
          : 'READ_ONLY',
      }));
      return {
        id: s.id,
        code: s.code,
        title: s.title,
        description: s.description,
        units: s.units,
        lecHours: s.lecHours,
        labHours: s.labHours,
        prerequisite: s.prerequisite,
        yearLevel: s.yearLevel,
        semester: s.semester,
        departmentId: deptCode,
        professorName: assignedProf,
        department: { id: deptCode, code: deptCode, name: deptName },
        isEnrolled,
        enrollmentStatus,
        enrollmentId: studentEnrollment?.id ?? null,
        enrollmentAcademicYear: studentEnrollment?.academicYear ?? null,
        enrollmentSemester: studentEnrollment?.semester ?? null,
        enrolledCount: s._count?.studentSubjects ?? 0,
        enrolledStudents,
        syllabi: user?.role === 'Student' && !isEnrolled ? [] : enrichedSyllabi,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({
      subjects: formatted,
      courses: formatted, // Alias for backward compatibility
      total: formatted.length,
    });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Failed to retrieve subjects: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Administrators can add subjects.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      title,
      description,
      units = 3,
      lecHours = 3,
      labHours = 0,
      prerequisite = 'None',
      yearLevel = '1st Year',
      semester = '1st Semester',
      departmentId,
      professorName,
      facultyName,
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: 'Subject code and title are required.' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const deptCode = departmentId
      ? String(departmentId).trim().toUpperCase()
      : user.departmentId ? String(user.departmentId).trim().toUpperCase() : null;

    if (!deptCode) {
      return NextResponse.json({ error: 'A valid department code is required.' }, { status: 400 });
    }

    const dbDepartment = await prisma.department.findUnique({ where: { id: deptCode } });
    if (!dbDepartment) {
      return NextResponse.json(
        { error: `Department "${deptCode}" was not found in the system.` },
        { status: 400 }
      );
    }

    // Department Isolation: Department Head can only create subjects in their own department
    if (user.role === 'DepartmentHead' && user.departmentId && deptCode !== user.departmentId.toUpperCase()) {
      return NextResponse.json({
        error: `Department Heads may only create subjects in their assigned department (${user.departmentId.toUpperCase()}).`,
      }, { status: 403 });
    }

    const existing = await prisma.subject.findUnique({ where: { code: upperCode } });
    if (existing) {
      return NextResponse.json({ error: `Subject with code "${upperCode}" already exists.` }, { status: 409 });
    }

    const resolvedProfessorName = (professorName || facultyName || '').trim() || null;

    const subject = await prisma.subject.create({
      data: {
        code: upperCode,
        title: title.trim(),
        description: description?.trim() || null,
        units: Number(units) || 3,
        lecHours: Number(lecHours) || 3,
        labHours: Number(labHours) || 0,
        prerequisite: prerequisite?.trim() || 'None',
        yearLevel: yearLevel || '1st Year',
        semester: semester || '1st Semester',
        departmentId: deptCode,
        professorName: resolvedProfessorName,
      },
    });

    // Automatically provision the initial pre-existing Electronic Syllabus template (Version 1, APPROVED)
    let instructorUser = resolvedProfessorName
      ? await prisma.user.findFirst({
          where: {
            fullName: { equals: resolvedProfessorName, mode: 'insensitive' },
            departmentId: deptCode,
          },
          select: { id: true },
        })
      : null;
    if (!instructorUser) {
      instructorUser = await prisma.user.findFirst({
        where: { role: { in: ['Educator', 'Faculty'] }, departmentId: deptCode, accountStatus: 'Active' },
        select: { id: true },
      });
    }
    const creatorIdInt = parseInt(user.id, 10) || 0;
    const instructorIdInt = instructorUser?.id ?? creatorIdInt;
    const initialTemplate = createDefaultSyllabusContent(subject, dbDepartment.name || getDepartmentName(deptCode));
    const now = new Date();

    await prisma.syllabus.create({
      data: {
        subjectId: subject.id,
        instructorId: instructorIdInt,
        departmentId: deptCode,
        academicYear: DEFAULT_ACADEMIC_YEAR,
        semester: (semester === '2nd Semester' || semester === 'Summer') ? semester : '1st Semester',
        section: 'A',
        status: SYLLABUS_STATUS.APPROVED,
        currentVersionNumber: 1,
        reviewedAt: now,
        reviewedByUserId: creatorIdInt,
        reviewerRemarks: `Initial syllabus (Version 1) — ${dbDepartment.name}`,
        versions: {
          create: {
            versionNumber: 1,
            editorId: creatorIdInt,
            changeSummary: `Initial syllabus for ${subject.code} (Version 1)`,
            changeType: 'Create',
            statusAtSave: SYLLABUS_STATUS.APPROVED,
            approvalStatus: SYLLABUS_STATUS.APPROVED,
            content: initialTemplate as any,
            submittedById: creatorIdInt,
            submittedAt: now,
            reviewedById: creatorIdInt,
            reviewedAt: now,
          },
        },
      },
    });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'CreateSubject',
      resultStatus: 'Success',
      description: `Created subject [${upperCode}] ${title.trim()} (${Number(units)} Units, ${deptCode})`,
      entityType: 'Subject',
      entityId: String(subject.id),
    });

    const formattedSubject = {
      id: subject.id,
      code: subject.code,
      title: subject.title,
      description: subject.description,
      units: subject.units,
      lecHours: subject.lecHours,
      labHours: subject.labHours,
      prerequisite: subject.prerequisite,
      yearLevel: subject.yearLevel,
      semester: subject.semester,
      departmentId: deptCode,
      professorName: resolvedProfessorName,
      department: { id: deptCode, code: deptCode, name: dbDepartment.name || getDepartmentName(deptCode) },
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };

    return NextResponse.json({
      success: true,
      subject: formattedSubject,
      course: formattedSubject, // Alias for backward compatibility
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject: ' + error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Department Head access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, subjectId, courseId, code, title, description, units, lecHours, labHours, prerequisite, yearLevel, semester, professorName, facultyName } = body;

    const subjectIdentifier = id || subjectId || courseId;
    const parsedId = subjectIdentifier ? parseInt(String(subjectIdentifier), 10) : null;
    const subjectCode = code ? String(code).trim().toUpperCase() : null;

    if (!parsedId && !subjectCode) {
      return NextResponse.json({ error: 'Subject id or code is required.' }, { status: 400 });
    }

    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          ...(parsedId !== null && !isNaN(parsedId) ? [{ id: parsedId }] : []),
          ...(subjectCode ? [{ code: subjectCode }] : []),
        ],
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    }

    // Department Isolation for Department Head
    if (user.role === 'DepartmentHead') {
      const deptCode = user.departmentId ? String(user.departmentId).toUpperCase() : null;
      if (!deptCode || subject.departmentId.toUpperCase() !== deptCode) {
        return NextResponse.json({
          error: `Forbidden: Department Heads may only manage subjects within their assigned department (${deptCode || 'None'}).`,
        }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (units !== undefined) updateData.units = Number(units);
    if (lecHours !== undefined) updateData.lecHours = Number(lecHours);
    if (labHours !== undefined) updateData.labHours = Number(labHours);
    if (prerequisite !== undefined) updateData.prerequisite = prerequisite?.trim() || 'None';
    if (yearLevel) updateData.yearLevel = yearLevel;
    if (semester) updateData.semester = semester;

    const assignedProf = professorName !== undefined ? professorName : facultyName;
    let facultyAssignmentChanged = false;
    if (assignedProf !== undefined) {
      updateData.professorName = assignedProf ? String(assignedProf).trim() : null;
      facultyAssignmentChanged = true;
    }

    const updated = await prisma.subject.update({
      where: { id: subject.id },
      data: updateData,
    });

    const auditAction = facultyAssignmentChanged ? 'FacultyAssigned' : 'UpdateSubject';
    const auditDesc = facultyAssignmentChanged
      ? `Assigned faculty "${updateData.professorName || 'None'}" to subject [${updated.code}] ${updated.title}`
      : `Updated subject [${updated.code}] ${updated.title}`;

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName || user.id,
      actionType: auditAction,
      resultStatus: 'Success',
      description: auditDesc,
      entityType: 'Subject',
      entityId: String(updated.id),
      ipAddress: req.ip || '127.0.0.1',
    });

    const formattedSubject = {
      id: updated.id,
      code: updated.code,
      title: updated.title,
      description: updated.description,
      units: updated.units,
      lecHours: updated.lecHours,
      labHours: updated.labHours,
      prerequisite: updated.prerequisite,
      yearLevel: updated.yearLevel,
      semester: updated.semester,
      departmentId: updated.departmentId,
      professorName: updated.professorName,
      department: { id: updated.departmentId, code: updated.departmentId, name: getDepartmentName(updated.departmentId) },
      updatedAt: updated.updatedAt,
    };

    return NextResponse.json({
      success: true,
      subject: formattedSubject,
      course: formattedSubject, // Alias for backward compatibility
    });
  } catch (error: any) {
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Failed to update subject: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Admin' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subjectIdParam = searchParams.get('subjectId') || searchParams.get('courseId') || searchParams.get('id');
    const subjectCodeParam = searchParams.get('subjectCode') || searchParams.get('courseCode') || searchParams.get('code');

    if (!subjectIdParam && !subjectCodeParam) {
      return NextResponse.json({ error: 'subjectId or subjectCode is required.' }, { status: 400 });
    }

    const parsedSubjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : null;
    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          ...(parsedSubjectId !== null && !isNaN(parsedSubjectId) ? [{ id: parsedSubjectId }] : []),
          ...(subjectCodeParam ? [{ code: subjectCodeParam.trim().toUpperCase() }] : []),
        ],
      },
    });

    if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });

    // Department Isolation: Department Head can only delete subjects in their own department
    if (user.role === 'DepartmentHead' && user.departmentId && subject.departmentId.toUpperCase() !== user.departmentId.toUpperCase()) {
      return NextResponse.json({
        error: `Department Heads may only delete subjects within their assigned department (${user.departmentId.toUpperCase()}).`,
      }, { status: 403 });
    }

    // student_subjects references subjects with ON DELETE NO ACTION: never remove associations implicitly
    const associatedStudents = await prisma.studentSubject.count({ where: { subjectId: subject.id } });
    if (associatedStudents > 0) {
      return NextResponse.json({
        error: `Cannot delete [${subject.code}]: ${associatedStudents} enrollment record(s) still reference it (any status). Remove them first.`,
      }, { status: 409 });
    }

    await prisma.subject.delete({ where: { id: subject.id } });

    await logAuditEvent({
      userId: user.id,
      userDisplayName: user.fullName,
      actionType: 'DeleteSubject',
      resultStatus: 'Success',
      description: `Deleted subject [${subject.code}] ${subject.title}`,
      entityType: 'Subject',
      entityId: String(subject.id),
    });

    return NextResponse.json({ success: true, message: `Subject ${subject.code} deleted successfully.` });
  } catch (error: any) {
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Failed to delete subject.' }, { status: 500 });
  }
}
