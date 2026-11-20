const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function buildSubjectOnlyVersion1Content(subject, departmentName) {
  const deptName = departmentName || subject.department?.name || subject.departmentId || 'Academic Department';
  const units = Number(subject.units ?? 3);
  const lecHours = Number(subject.lecHours ?? 3);
  const labHours = Number(subject.labHours ?? 0);
  const prerequisite = (subject.prerequisite || 'None').trim() || 'None';
  const yearLevel = (subject.yearLevel || '1st Year').trim();
  const semester = (subject.semester || '1st Semester').trim();
  const assignedInstructor = (subject.professorName || '').trim();

  const rawDesc = (subject.description || '').trim();
  const courseDescription =
    rawDesc ||
    `${subject.code} (${subject.title}) is a ${units}-unit course (${lecHours} hr${lecHours === 1 ? '' : 's'} lecture, ${labHours} hr${labHours === 1 ? '' : 's'} laboratory) offered under ${deptName} for ${yearLevel} (${semester}). Prerequisite: ${prerequisite}.`;

  return {
    generatedFromSubject: true,
    curriculumYear: '',
    coRequisites: 'None',
    programs: deptName,
    schedule: '',
    courseDescription,
    subjectSnapshot: {
      code: subject.code,
      title: subject.title,
      departmentId: subject.departmentId,
      departmentName: deptName,
      units,
      lecHours,
      labHours,
      prerequisite,
      yearLevel,
      semester,
      professorName: assignedInstructor || null,
      description: rawDesc || null,
    },
    peos: [],
    missionPeoMapping: [],
    piloPeoMapping: [],
    piloStandards: [],
    cilos: [],
    assessmentOfOutcomes: '',
    criteriaStandards: '',
    weeklyPlan: [],
    integrationSchemes: [],
    owatGrading: [],
    references: [],
    coursePolicies: [],
    remarks: '',
    learningOutcomes: [],
    topics: [],
    gradingSystem: [],
  };
}

async function main() {
  // 1. Create syllabus_edit_requests table & indexes if not present
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS syllabus_edit_requests (
      id SERIAL PRIMARY KEY,
      "syllabusId" INTEGER NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
      "facultyId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "departmentId" TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
      "reviewedById" INTEGER REFERENCES users(id) ON DELETE SET NULL,
      "reviewRemarks" TEXT,
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reviewedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_syllabus_edit_requests_syllabus ON syllabus_edit_requests("syllabusId");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_syllabus_edit_requests_faculty ON syllabus_edit_requests("facultyId");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_syllabus_edit_requests_dept_status ON syllabus_edit_requests("departmentId", status);`
  );
  console.log('Verified table: syllabus_edit_requests');

  // 2. Auto-generate / refresh initial Version 1 syllabus for EVERY existing subject across ALL departments
  const subjects = await prisma.subject.findMany({
    include: {
      department: true,
      syllabi: {
        include: { versions: { orderBy: { versionNumber: 'asc' } } },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: [{ departmentId: 'asc' }, { code: 'asc' }],
  });

  const users = await prisma.user.findMany({
    where: { accountStatus: 'Active' },
    select: { id: true, fullName: true, role: true, departmentId: true },
  });

  const adminUser = users.find((u) => u.role === 'Admin') || users[0];
  let createdCount = 0;
  let updatedAutoV1Count = 0;
  let preservedCount = 0;

  for (const subject of subjects) {
    const deptCode = String(subject.departmentId);
    const deptName = subject.department?.name || deptCode;
    const deptHead =
      users.find((u) => u.role === 'DepartmentHead' && u.departmentId === deptCode) ||
      adminUser;

    let facultyUser = null;
    if (subject.professorName) {
      const needle = subject.professorName.trim().toLowerCase();
      facultyUser = users.find(
        (u) => u.fullName.trim().toLowerCase() === needle && u.departmentId === deptCode
      );
    }
    if (!facultyUser) {
      facultyUser =
        users.find((u) => (u.role === 'Educator' || u.role === 'Faculty') && u.departmentId === deptCode) ||
        deptHead ||
        adminUser;
    }

    const v1Content = buildSubjectOnlyVersion1Content(subject, deptName);
    const normalizedSemester =
      subject.semester === '2nd Semester' || subject.semester === 'Summer'
        ? subject.semester
        : '1st Semester';
    const now = new Date();
    const existingSyllabus = subject.syllabi[0];

    if (!existingSyllabus) {
      await prisma.syllabus.create({
        data: {
          subjectId: subject.id,
          instructorId: facultyUser.id,
          departmentId: deptCode,
          academicYear: '2026-2027',
          semester: normalizedSemester,
          section: 'A',
          status: 'APPROVED',
          currentVersionNumber: 1,
          reviewedAt: now,
          reviewedByUserId: deptHead?.id ?? adminUser.id,
          reviewerRemarks: `Initial syllabus (Version 1) — ${deptName}`,
          versions: {
            create: {
              versionNumber: 1,
              editorId: deptHead?.id ?? facultyUser.id,
              changeSummary: `Initial syllabus for ${subject.code} (Version 1)`,
              changeType: 'Create',
              statusAtSave: 'APPROVED',
              approvalStatus: 'APPROVED',
              content: v1Content,
              submittedById: deptHead?.id ?? facultyUser.id,
              submittedAt: now,
              reviewedById: deptHead?.id ?? adminUser.id,
              reviewedAt: now,
            },
          },
        },
      });
      createdCount++;
    } else {
      const v1 = existingSyllabus.versions.find((v) => v.versionNumber === 1);
      const isAutoSeededV1 =
        v1 &&
        (String(v1.changeSummary || '').startsWith('Pre-existing institutional') ||
          String(v1.changeSummary || '').startsWith('Initial pre-existing') ||
          String(v1.changeSummary || '').startsWith('Auto-generated initial') ||
          String(v1.changeSummary || '').startsWith('Initial syllabus') ||
          Boolean(v1.content && v1.content.generatedFromSubject));

      if (!v1) {
        await prisma.syllabusVersion.create({
          data: {
            syllabusId: existingSyllabus.id,
            versionNumber: 1,
            editorId: deptHead?.id ?? facultyUser.id,
            changeSummary: `Initial syllabus for ${subject.code} (Version 1)`,
            changeType: 'Create',
            statusAtSave: 'APPROVED',
            approvalStatus: 'APPROVED',
            content: v1Content,
            submittedById: deptHead?.id ?? facultyUser.id,
            submittedAt: now,
            reviewedById: deptHead?.id ?? adminUser.id,
            reviewedAt: now,
          },
        });
        await prisma.syllabus.update({
          where: { id: existingSyllabus.id },
          data: {
            status: 'APPROVED',
            currentVersionNumber: Math.max(1, existingSyllabus.currentVersionNumber || 1),
          },
        });
        createdCount++;
      } else if (isAutoSeededV1) {
        await prisma.syllabusVersion.update({
          where: { id: v1.id },
          data: {
            changeSummary: `Initial syllabus for ${subject.code} (Version 1)`,
            approvalStatus: 'APPROVED',
            statusAtSave: 'APPROVED',
            content: v1Content,
          },
        });
        if (existingSyllabus.versions.length === 1) {
          await prisma.syllabus.update({
            where: { id: existingSyllabus.id },
            data: {
              status: 'APPROVED',
              currentVersionNumber: 1,
              semester: normalizedSemester,
              reviewerRemarks: `Initial syllabus (Version 1) — ${deptName}`,
            },
          });
        }
        updatedAutoV1Count++;
      } else {
        preservedCount++;
      }
    }
  }

  console.log(
    `Done! total_subjects=${subjects.length}, created=${createdCount}, refreshed_v1_from_subject_details=${updatedAutoV1Count}, preserved_custom=${preservedCount}`
  );
}

main()
  .catch((err) => {
    console.error('Migration/seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

