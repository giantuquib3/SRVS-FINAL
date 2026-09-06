import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academicYear');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (user?.role === 'Student') {
      where.status = { in: ['Approved', 'ACTIVE'] };
      const studentEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: Number(user.id),
          status: 'ENROLLED',
        },
        select: { subjectId: true },
      });
      const enrolledSubjectIds = studentEnrollments.map((e) => e.subjectId);
      where.subjectId = { in: enrolledSubjectIds };
    } else if (user?.role === 'DepartmentHead') {
      if (user.departmentId) {
        where.departmentId = Number(user.departmentId);
      }
      if (status) where.status = status;
    } else if (user?.role === 'Educator') {
      if (status) where.status = status;
      if (searchParams.get('mySyllabi') === 'true') {
        where.instructorId = Number(user.id);
      }
    } else if (user?.role === 'Admin') {
      if (status) where.status = status;
      if (departmentId) where.departmentId = Number(departmentId);
    } else {
      where.status = { in: ['Approved', 'ACTIVE'] };
    }

    if (user?.role !== 'DepartmentHead' && departmentId) {
      const parsedDeptId = Number(departmentId);
      if (!isNaN(parsedDeptId)) where.departmentId = parsedDeptId;
    }
    if (semester) where.semester = semester;
    if (academicYear) where.academicYear = academicYear;

    if (search) {
      where.subject = {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const syllabi = await prisma.syllabus.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        subject: {
          include: {
            department: true,
          },
        },
        instructor: {
          select: {
            id: true,
            idNumber: true,
            fullName: true,
            email: true,
          },
        },
        department: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            changeSummary: true,
            changeType: true,
            statusAtSave: true,
            approvalStatus: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            uploadedByUserId: true,
            createdAt: true,
            submittedAt: true,
            reviewedAt: true,
            editor: {
              select: {
                id: true,
                idNumber: true,
                fullName: true,
              },
            },
            submittedBy: {
              select: {
                id: true,
                idNumber: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Format output ensuring course compatibility for legacy consumers
    const formattedSyllabi = syllabi.map((s) => ({
      ...s,
      course: s.subject, // Map subject to course so legacy consumers work seamlessly
      courseId: s.subjectId,
    }));

    return NextResponse.json({ syllabi: formattedSyllabi });
  } catch (error: any) {
    console.error('Error fetching syllabi:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabi.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead' && user.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Educator, Department Head, or Admin access required to create a syllabus.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseId,
      subjectId,
      semester,
      academicYear,
      courseDescription,
      learningOutcomes,
      topics,
      references,
      gradingSystem,
      schedule,
      section = 'A',
      directApprove = false,
      saveAsDraft = true,
      fileName,
      fileUrl,
      fileType,
      fileSize,
    } = body;

    const rawTarget = String(subjectId || courseId || '').trim();

    if (!rawTarget || !semester || !academicYear) {
      return NextResponse.json({ error: 'Subject/Course, Semester, and Academic Year are required.' }, { status: 400 });
    }

    // Lookup Subject by ID or code
    const numericTarget = Number(rawTarget);
    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          { code: rawTarget.toUpperCase() },
          { id: isNaN(numericTarget) ? -1 : numericTarget },
        ],
      },
      include: { department: true },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Selected subject/course was not found.' }, { status: 404 });
    }

    if (!fileUrl && (!courseDescription || !courseDescription.trim())) {
      return NextResponse.json({ error: 'Please provide either a course description or an uploaded syllabus document (PDF/DOCX).' }, { status: 400 });
    }

    const contentSnapshot = {
      courseDescription: courseDescription?.trim() || '',
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      topics: Array.isArray(topics) ? topics : [],
      references: Array.isArray(references) ? references : [],
      gradingSystem: Array.isArray(gradingSystem) ? gradingSystem : [],
      schedule: schedule?.trim() || '',
    };

    const canDirectApprove = (user.role === 'DepartmentHead' || user.role === 'Admin') && directApprove === true;
    const initialStatus = canDirectApprove ? 'ACTIVE' : (saveAsDraft ? 'DRAFT' : 'PENDING_APPROVAL');
    const versionApprovalStatus = canDirectApprove ? 'APPROVED' : initialStatus;
    const now = new Date();
    const uIdNumber = String(user.idNumber || user.username || user.id);
    const currentUserId = Number(user.id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create syllabus master record
      const syllabus = await tx.syllabus.create({
        data: {
          subjectId: subject.id,
          instructorId: currentUserId,
          createdById: currentUserId,
          uploadedByUserId: uIdNumber,
          departmentId: subject.departmentId,
          academicYear,
          semester,
          section: section || 'A',
          status: initialStatus,
          currentVersionNumber: 1,
          submittedAt: initialStatus === 'PENDING_APPROVAL' ? now : null,
          reviewedAt: canDirectApprove ? now : null,
          reviewedByUserId: canDirectApprove ? currentUserId : null,
          reviewerRemarks: canDirectApprove ? 'Approved on initial creation by Department Head' : null,
        },
      });

      // 2. Create Syllabus Version 1
      const version = await tx.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: currentUserId,
          uploadedByUserId: uIdNumber,
          changeSummary: fileUrl
            ? `Initial syllabus creation with uploaded document (${fileName})`
            : 'Initial syllabus creation (Version 1)',
          changeType: 'Create',
          statusAtSave: versionApprovalStatus,
          approvalStatus: versionApprovalStatus,
          content: contentSnapshot,
          fileName: fileName || null,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileSize: fileSize || null,
          submittedById: initialStatus === 'PENDING_APPROVAL' || canDirectApprove ? currentUserId : null,
          submittedAt: initialStatus === 'PENDING_APPROVAL' || canDirectApprove ? now : null,
          reviewedById: canDirectApprove ? currentUserId : null,
          reviewedAt: canDirectApprove ? now : null,
        },
      });

      return { syllabus, version };
    });

    await logAuditEvent({
      userId: currentUserId,
      userDisplayName: user.fullName,
      actionType: canDirectApprove ? 'UploadAndApproveSyllabus' : (saveAsDraft ? 'DraftSyllabus' : 'SubmitSyllabus'),
      resultStatus: 'Success',
      description: `Created syllabus for ${subject.code} (${semester}, AY ${academicYear}) - Status: ${initialStatus} [Uploaded by ID: ${uIdNumber}]`,
      entityType: 'Syllabus',
      entityId: result.syllabus.id,
    });

    return NextResponse.json({
      success: true,
      syllabus: result.syllabus,
      version: result.version,
      message: canDirectApprove
        ? `${subject.code} syllabus has been created, approved, and activated.`
        : (saveAsDraft
          ? 'Syllabus draft saved successfully.'
          : 'Syllabus submitted for Department Head review.'),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating syllabus:', error);
    return NextResponse.json({ error: 'Failed to create syllabus: ' + error.message }, { status: 500 });
  }
}
