const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_PILO_LIST = [
  {
    letter: 'a',
    outcome:
      'Apply knowledge of mathematics, natural science, engineering fundamentals and an engineering specialization to the solution of complex engineering problems.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'b',
    outcome:
      'Conduct investigations of complex engineering problems using research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of information to provide valid conclusions.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'c',
    outcome:
      'Design solutions for complex engineering problems and design systems, components or processes that meet specified needs with appropriate consideration for public health and safety, cultural, societal, and environmental considerations.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'd',
    outcome:
      'Function effectively as an individual, and as a member or leader in diverse teams and in multi-disciplinary settings.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'e',
    outcome:
      'Identify, formulate, research literature and analyze complex engineering problems reaching substantiated conclusions using first principles of mathematics, natural sciences and engineering sciences.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'f',
    outcome:
      'Apply ethical principles and commit to professional ethics and responsibilities and norms of engineering practice.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'g',
    outcome:
      'Communicate effectively on complex engineering activities with the engineering community and with society at large, such as being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'h',
    outcome:
      'Understand and evaluate the sustainability and impact of professional engineering work in the solution of complex engineering problems in societal and environmental context.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'i',
    outcome:
      'Recognize the need for, and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'j',
    outcome:
      'Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to professional engineering practice and solutions to complex engineering problems.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'k',
    outcome:
      'Create, select and apply appropriate techniques, resources, and modern engineering and IT tools, including prediction and modelling, to complex engineering problems with an understanding of the limitations.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
  {
    letter: 'l',
    outcome:
      'Demonstrate knowledge and understanding of engineering management principles and economic decision-making and apply these to one’s own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.',
    peo1: false,
    peo2: false,
    peo3: false,
  },
];

const DEFAULT_INTEGRATION_SCHEMES = [
  {
    coreValue: 'Integrity & Reliability.',
    description:
      'Integrity and Reliability of data gathered will be developed as the students gather information and collate this information to come up with good decisions.',
  },
  {
    coreValue: 'Excellence.',
    description:
      'The students are expected to embody excellence in their respective outputs through oral presentations.',
  },
];

const DEFAULT_COURSE_POLICIES = [
  {
    section: 'Attendance and Participation',
    items: [
      'Attendance will be checked every meeting. Regular class attendance is expected from the student, however, a maximum of ten (10) hours worth of absences is allowed (i.e., 10days for MWF classes, 6 days for TTh classes). Beyond this limit, the student will automatically be dropped from the subject and will be given an NC or No Credit for the course.',
      'In case of absences, the student should present a duly signed excuse letter prior to a planned absence (e.g. student is sent by school for an inter-school activity) or the meeting immediately following his day of absence (e.g. due to illness).',
      'For online classes, students are expected to attend synchronous classes as scheduled, and comply with all requirements and expected outputs given during asynchronous sessions. The student must also inform the professor through LMS communication therein the reason for such missed classes.',
    ],
  },
  {
    section: 'Academic Integrity',
    items: [
      'Plagiarism & cheating are definitely not allowed. Cheating may include obtaining or intentionally giving unauthorized information to create an unfair advantage in an examination, assignment, or classroom situation.',
      'Any form of violation of academic integrity such as cheating during exams, copying of outputs, and plagiarism will be dealt with accordingly.',
    ],
  },
  {
    section: 'Submission of Works/Outputs',
    items: [
      'Students are expected to submit their outputs on the set deadlines. Late submissions will have a corresponding deduction of points. (e.g. -20% for one meeting late, -50% for two meetings late). Submissions made a week after the deadline will not be accepted.',
      'All submissions must be done during class hours unless otherwise specified.',
      'Submitted outputs should always contain the name of the student or group members, the date submitted, the class schedule, and the course.',
    ],
  },
  {
    section: 'Use of Technology',
    items: [
      'Use of mobile phones and other gadgets during class is prohibited, unless specified (e.g. need to be used in classroom activities). These should be put in silent mode so as not to disrupt the class discussion.',
      'For urgent need of use, such as in case of emergency, the student is advised to step out quietly.',
    ],
  },
  {
    section: 'Accommodations for Students for Missed Activities',
    items: [
      'No make-up will be given for missed homework, seat works or any class activity. Make-up opportunities for missed homework, seat work, or class activities will be offered only at the teacher’s discretion, if the reason for absence is valid. Students should immediately communicate with the instructor to discuss possible accommodations.',
      'For missed major quizzes or major exams (Prelim, Midterm, and Finals), make-up will only be given if the reason for absence is valid and that a duly signed excuse letter and excuse slip from the Student Development and Placement Center is submitted to the meeting immediately following the scheduled day of exam.',
    ],
  },
  {
    section: 'Means of Communication',
    items: [
      'The means of communication will be through LMS direct messaging and should be done during class hours (8am-5pm), and class days only. Observe weekends and working holidays.',
      'The instructor may opt to use other forms of communication.',
    ],
  },
  {
    section: 'Withdrawal of Course',
    items: [
      'The student is given the chance to withdraw the course within the midterm period. It is the responsibility of the student to inform the teacher in oral and written form his intention to withdraw.',
      'After midterms or before the final examinations, a student may still be allowed to withdraw from a course provided he/she obtains a passing grade in Prelim and Midterm in the courses to be withdrawn. Otherwise, the student is no longer allowed to withdraw the course. In this case, the teacher has the discretion to give the student the appropriate grade at the end of the term.',
      'If the student has started attending classes until finals and decided to withdraw the course without proper notice, he will be given a grade of 5.0.',
    ],
  },
];

function getDepartmentHeaderName(deptCode, deptName) {
  switch (String(deptCode || '').trim().toUpperCase()) {
    case 'CE':
      return 'Department of Civil Engineering';
    case 'CPE':
      return 'Department of Computer Engineering';
    case 'EE':
      return 'Department of Electrical Engineering';
    case 'ECE':
      return 'Department of Electronics Engineering';
    case 'IE':
      return 'Department of Industrial Engineering';
    case 'ME':
      return 'Department of Mechanical Engineering';
    default:
      if (deptName && deptName.trim()) {
        return deptName.trim().toLowerCase().startsWith('department of')
          ? deptName.trim()
          : `Department of ${deptName.replace(/\s*Department$/i, '').trim()}`;
      }
      return 'Department of Computer Engineering';
  }
}

function getDisciplineName(deptCode, deptName) {
  switch (String(deptCode || '').trim().toUpperCase()) {
    case 'CE':
      return 'Civil Engineering';
    case 'CPE':
      return 'Computer Engineering';
    case 'EE':
      return 'Electrical Engineering';
    case 'ECE':
      return 'Electronics Engineering';
    case 'IE':
      return 'Industrial Engineering';
    case 'ME':
      return 'Mechanical Engineering';
    default:
      return String(deptName || 'Engineering')
        .replace(/^Department of\s+/i, '')
        .replace(/\s*Department$/i, '')
        .trim();
  }
}

function getProgramNameForDepartment(deptCode, deptName) {
  switch (String(deptCode || '').trim().toUpperCase()) {
    case 'CE':
      return 'BS Civil Engineering';
    case 'CPE':
      return 'BS Computer Engineering';
    case 'EE':
      return 'BS Electrical Engineering';
    case 'ECE':
      return 'BS Electronics Engineering';
    case 'IE':
      return 'BS Industrial Engineering';
    case 'ME':
      return 'BS Mechanical Engineering';
    default:
      return (deptName && deptName.trim()) || 'BS Engineering';
  }
}

function getDefaultOwatGrading(deptCode, deptName) {
  const discipline = getDisciplineName(deptCode, deptName);
  const engineersPlural = discipline.toLowerCase().endsWith('engineering')
    ? discipline.replace(/engineering$/i, 'Engineers')
    : `${discipline} Professionals`;

  return [
    {
      outcome: `Categorize the role of ${engineersPlural} in the Society`,
      totalWeight: 50,
      items: [
        { points: 100, tool: 'Synthesis Report 1A' },
        { points: 100, tool: 'Synthesis Report 2A' },
        { points: 100, tool: 'Synthesis Report 3A' },
        { points: 100, tool: 'Synthesis Report 4A' },
        { points: 100, tool: 'Case Study Report 1A' },
        { points: 100, tool: 'Case Study Report 2A' },
        { points: 300, tool: 'Midterm Case Study Report 3A' },
        { points: 100, tool: 'Case Study Report 4A' },
        { points: 300, tool: 'Finals Case Study Report 5A' },
      ],
    },
    {
      outcome: 'Plan Career path as Engineers',
      totalWeight: 50,
      items: [
        { points: 100, tool: 'Synthesis Report 1B' },
        { points: 100, tool: 'Synthesis Report 2B' },
        { points: 100, tool: 'Synthesis Report 3B' },
        { points: 100, tool: 'Synthesis Report 4B' },
        { points: 100, tool: 'Case Study Report 1B' },
        { points: 100, tool: 'Case Study Report 2B' },
        { points: 300, tool: 'Midterm Case Study Report 3B' },
        { points: 100, tool: 'Case Study Report 4B' },
        { points: 300, tool: 'Finals Case Study Report 5B' },
      ],
    },
  ];
}

function buildOfficialUsjrVersion1Content(subject, departmentName) {
  const deptCode = String(subject.departmentId || '');
  const deptHeader = getDepartmentHeaderName(deptCode, departmentName || subject.department?.name);
  const discipline = getDisciplineName(deptCode, departmentName || subject.department?.name);
  const program = getProgramNameForDepartment(deptCode, departmentName || subject.department?.name);
  const units = Number(subject.units ?? 3);
  const lecHours = Number(subject.lecHours ?? 3);
  const labHours = Number(subject.labHours ?? 0);
  const prerequisite = (subject.prerequisite || 'None').trim() || 'None';
  const yearLevel = (subject.yearLevel || '1st Year').trim();
  const semester = (subject.semester || '1st Semester').trim();
  const assignedInstructor = (subject.professorName || '').trim();
  const rawDesc = (subject.description || '').trim();
  const termOffered = [semester, yearLevel].filter(Boolean).join(' — ');
  const owatGrading = getDefaultOwatGrading(deptCode, departmentName || subject.department?.name);

  return {
    curriculumYear: 'Curriculum 2022',
    coRequisites: 'None',
    termOffered,
    programs: program,
    schedule: '',
    courseDescription: rawDesc,
    peoStatement: '',
    peos: [],
    missionPeoMapping: [
      {
        mission: 'Imbued with the spirit of Caritas et Scientia',
        peo: `(PEO 3) Successfully apply core ${discipline.toLowerCase()} knowledge and skills in a creative and innovative manner.`,
      },
      {
        mission: 'Provide the highest level of quality education',
        peo: '',
      },
      {
        mission: 'Christian, community-oriented education',
        peo: '',
      },
    ],
    piloPeoMapping: DEFAULT_PILO_LIST.map((r) => ({ ...r })),
    piloStandards: [
      { pilo: '', standard: '' },
      { pilo: '', standard: '' },
      { pilo: '', standard: '' },
      { pilo: '', standard: '' },
    ],
    cilos: [
      {
        code: 'CILO 1',
        description: '',
        mappedPilo: '',
        peo1: false,
        peo2: true,
        peo3: true,
      },
      {
        code: 'CILO 2',
        description: '',
        mappedPilo: '',
        peo1: false,
        peo2: false,
        peo3: false,
      },
    ],
    assessmentOfOutcomes: '',
    criteriaStandards: '',
    weeklyPlan: [
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
      { timeFrame: '', intendedLearningOutcome: '', ciloMapping: [], assessment: '', teachingLearningActivities: '', learningContent: '', resources: '' },
    ],
    integrationSchemes: DEFAULT_INTEGRATION_SCHEMES.map((i) => ({ ...i })),
    owatGrading,
    references: [],
    coursePolicies: DEFAULT_COURSE_POLICIES.map((p) => ({ section: p.section, items: [...p.items] })),
    remarks: '',
    subjectSnapshot: {
      code: subject.code,
      title: subject.title,
      departmentId: subject.departmentId,
      departmentName: deptHeader,
      units,
      lecHours,
      labHours,
      prerequisite,
      yearLevel,
      semester,
      professorName: assignedInstructor || null,
      description: rawDesc || null,
    },
    learningOutcomes: [],
    topics: [],
    gradingSystem: owatGrading.map((g) => ({ component: g.outcome, weight: g.totalWeight })),
  };
}

async function main() {
  // 1. Ensure syllabus_edit_requests table & indexes exist
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

  // 2. Refresh / initialize Version 1 syllabus for EVERY existing subject across ALL departments using the official USJ-R template
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
  let updatedV1Count = 0;
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

    const v1Content = buildOfficialUsjrVersion1Content(subject, deptName);
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
      const isInitialV1 =
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
      } else if (isInitialV1) {
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
        updatedV1Count++;
      } else {
        preservedCount++;
      }
    }
  }

  console.log(
    `Done! total_subjects=${subjects.length}, created=${createdCount}, refreshed_v1_official_template=${updatedV1Count}, preserved_custom=${preservedCount}`
  );
}

main()
  .catch((err) => {
    console.error('Migration/seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
