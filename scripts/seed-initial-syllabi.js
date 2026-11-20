const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEPT_NAMES = {
  CE: 'Civil Engineering',
  CPE: 'Computer Engineering',
  EE: 'Electrical Engineering',
  ECE: 'Electronics and Communications Engineering',
  IE: 'Industrial Engineering',
  ME: 'Mechanical Engineering',
};

const PROGRAM_NAMES = {
  CE: 'BS Civil Engineering',
  CPE: 'BS Computer Engineering',
  EE: 'BS Electrical Engineering',
  ECE: 'BS Electronics Engineering',
  IE: 'BS Industrial Engineering',
  ME: 'BS Mechanical Engineering',
};

const DEFAULT_PILOS = [
  { letter: 'a', outcome: 'Apply knowledge of mathematics, natural science, engineering fundamentals and an engineering specialization to the solution of complex engineering problems.', peo1: true, peo2: true, peo3: true },
  { letter: 'b', outcome: 'Conduct investigations of complex engineering problems using research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of information to provide valid conclusions.', peo1: false, peo2: true, peo3: true },
  { letter: 'c', outcome: 'Design solutions for complex engineering problems and design systems, components or processes that meet specified needs with appropriate consideration for public health and safety, cultural, societal, and environmental considerations.', peo1: true, peo2: true, peo3: true },
  { letter: 'd', outcome: 'Function effectively as an individual, and as a member or leader in diverse teams and in multi-disciplinary settings.', peo1: true, peo2: false, peo3: true },
  { letter: 'e', outcome: 'Identify, formulate, research literature and analyze complex engineering problems reaching substantiated conclusions using first principles of mathematics, natural sciences and engineering sciences.', peo1: false, peo2: true, peo3: true },
  { letter: 'f', outcome: 'Apply ethical principles and commit to professional ethics and responsibilities and norms of engineering practice.', peo1: true, peo2: true, peo3: false },
  { letter: 'g', outcome: 'Communicate effectively on complex engineering activities with the engineering community and with society at large, such as being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.', peo1: true, peo2: true, peo3: true },
  { letter: 'h', outcome: 'Understand and evaluate the sustainability and impact of professional engineering work in the solution of complex engineering problems in societal and environmental context.', peo1: true, peo2: false, peo3: true },
  { letter: 'i', outcome: 'Recognize the need for, and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.', peo1: true, peo2: true, peo3: true },
  { letter: 'j', outcome: 'Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to professional engineering practice and solutions to complex engineering problems.', peo1: true, peo2: false, peo3: true },
  { letter: 'k', outcome: 'Create, select and apply appropriate techniques, resources, and modern engineering and IT tools, including prediction and modelling, to complex engineering problems with an understanding of the limitations.', peo1: false, peo2: true, peo3: true },
  { letter: 'l', outcome: 'Demonstrate knowledge and understanding of engineering management principles and economic decision-making and apply these to one’s own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.', peo1: true, peo2: true, peo3: true },
];

const DEFAULT_POLICIES = [
  {
    section: 'Attendance and Participation',
    items: [
      'Attendance will be checked every meeting. Regular class attendance is expected from the student; however, a maximum of ten (10) hours worth of absences is allowed (i.e., 10 days for MWF classes, 6 days for TTh classes). Beyond this limit, the student will automatically be dropped from the subject and will be given an NC or No Credit for the course.',
      'In case of absences, the student should present a duly signed excuse letter prior to a planned absence or the meeting immediately following the day of absence.',
      'For online classes, students are expected to attend synchronous classes as scheduled, and comply with all requirements and expected outputs given during asynchronous sessions.',
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
      'Students are expected to submit their outputs on the set deadlines. Late submissions will have a corresponding deduction of points (e.g. -20% for one meeting late, -50% for two meetings late). Submissions made a week after the deadline will not be accepted.',
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
      'No make-up will be given for missed homework, seat works or any class activity. Make-up opportunities will be offered only at the teacher’s discretion, if the reason for absence is valid.',
      'For missed major quizzes or major exams (Prelim, Midterm, and Finals), make-up will only be given if the reason for absence is valid and a duly signed excuse letter and excuse slip from the Student Development and Placement Center is submitted.',
    ],
  },
  {
    section: 'Means of Communication',
    items: [
      'The means of communication will be through LMS direct messaging and should be done during class hours (8am–5pm) on class days only. Observe weekends and working holidays.',
      'The instructor may opt to use other official institutional forms of communication.',
    ],
  },
  {
    section: 'Withdrawal of Course',
    items: [
      'The student is given the chance to withdraw the course within the midterm period. It is the responsibility of the student to inform the teacher in oral and written form of his/her intention to withdraw.',
      'After midterms or before the final examinations, a student may still be allowed to withdraw from a course provided he/she obtains a passing grade in Prelim and Midterm.',
      'If the student has started attending classes until finals and decided to withdraw the course without proper notice, he/she will be given a grade of 5.0.',
    ],
  },
];

function buildElectronicTemplate(subject) {
  const deptCode = String(subject.departmentId || 'CPE').toUpperCase();
  const deptName = DEPT_NAMES[deptCode] || 'Engineering';
  const program = PROGRAM_NAMES[deptCode] || 'BS Engineering';

  return {
    curriculumYear: 'Curriculum 2022',
    coRequisites: 'None',
    programs: program,
    schedule: 'MWF / TTh (Standard Departmental Schedule)',
    courseDescription:
      subject.description ||
      `This course provides ${program} students with a solid theoretical and applied foundation in ${subject.title} (${subject.code}), emphasizing analytical reasoning, outcome-based engineering design, and professional ethics aligned with USJ-R School of Engineering standards.`,
    peos: [
      { code: 'PEO 1', statement: `Demonstrate professional competence and ethical leadership in ${deptName.toLowerCase()} practice and community service.` },
      { code: 'PEO 2', statement: `Engage in continuous research, technological advancement, and lifelong learning in ${deptName.toLowerCase()}.` },
      { code: 'PEO 3', statement: `Successfully apply core ${deptName.toLowerCase()} knowledge and skills in a creative and innovative manner.` },
    ],
    missionPeoMapping: [
      { mission: 'Imbued with the spirit of Caritas et Scientia', peo: `(PEO 3) Successfully apply core ${deptName.toLowerCase()} knowledge and skills in a creative and innovative manner.` },
      { mission: 'Provide the highest level of quality education', peo: `(PEO 2) Engage in continuous research and technological advancement in ${deptName.toLowerCase()}.` },
      { mission: 'Christian, community-oriented education', peo: `(PEO 1) Demonstrate professional competence and ethical leadership in community service.` },
    ],
    piloPeoMapping: DEFAULT_PILOS,
    piloStandards: [
      { pilo: `Apply fundamental principles of ${deptName.toLowerCase()} to analyze and solve complex engineering problems.`, standard: 'Formulates valid models and derives verified engineering solutions.' },
      { pilo: 'Communicate technical findings effectively through structured reports and presentations.', standard: 'Produces clear engineering documentation meeting institutional standards.' },
    ],
    cilos: [
      {
        code: 'CILO 1',
        description: `Explain the fundamental concepts, theories, and professional engineering standards of ${subject.title}.`,
        mappedPilo: 'a, f, g',
        peo1: true,
        peo2: true,
        peo3: true,
      },
      {
        code: 'CILO 2',
        description: `Apply analytical methods, modern tools, and design principles to solve structured ${deptName.toLowerCase()} problems in ${subject.title}.`,
        mappedPilo: 'c, e, k',
        peo1: false,
        peo2: true,
        peo3: true,
      },
    ],
    assessmentOfOutcomes:
      'Formative and summative OBE assessments including synthesis reports, problem sets, case study reports, midterm examination, and final project/examination.',
    criteriaStandards:
      'Minimum passing score of 60% (Final Grade 3.0 — Knowledgeable / Rubric Level 3) evaluated using standardized USJ-R OBE rubrics.',
    weeklyPlan: [
      {
        timeFrame: 'Weeks 1–3',
        intendedLearningOutcome: `Explain the foundational principles and scope of ${subject.title}.`,
        ciloMapping: ['1'],
        assessment: 'Synthesis Report 1A & Diagnostic Quiz',
        teachingLearningActivities: 'Interactive Lecture & Guided Discussion',
        learningContent: `Introduction, Terminology, and Core Foundations of ${subject.title}`,
        resources: 'USJ-R LMS Module 1, Primary Reference Textbook Ch. 1–2',
      },
      {
        timeFrame: 'Weeks 4–9',
        intendedLearningOutcome: `Analyze and model intermediate engineering scenarios related to ${subject.title}.`,
        ciloMapping: ['1', '2'],
        assessment: 'Case Study Reports 1A–2A & Midterm Assessment',
        teachingLearningActivities: 'Problem-Solving Workshop & Case Study Analysis',
        learningContent: `Analytical Methods, System Modeling, and Applied Techniques in ${subject.title}`,
        resources: 'USJ-R LMS Module 2, Departmental Engineering Standards',
      },
      {
        timeFrame: 'Weeks 10–18',
        intendedLearningOutcome: `Design, evaluate, and present a comprehensive solution integrating ${subject.title} concepts.`,
        ciloMapping: ['2'],
        assessment: 'Final Case Study Report & Oral Presentation',
        teachingLearningActivities: 'Collaborative Design Studio & Technical Presentation',
        learningContent: `Integrated Engineering Applications, Ethics, and Final Synthesis for ${subject.title}`,
        resources: 'USJ-R LMS Module 3, CHED Reference Guides & Industry Manuals',
      },
    ],
    integrationSchemes: [
      {
        coreValue: 'Integrity & Reliability',
        description: 'Integrity and reliability of technical data gathered will be developed as students validate and collate engineering information to come up with sound decisions.',
      },
      {
        coreValue: 'Excellence',
        description: 'Students are expected to embody excellence in their respective technical outputs, case studies, and oral presentations.',
      },
    ],
    owatGrading: [
      {
        outcome: `CILO 1 — Foundational Concepts & Analysis in ${subject.title}`,
        totalWeight: 50,
        items: [
          { points: 100, tool: 'Synthesis Reports (1A–4A)' },
          { points: 200, tool: 'Case Study Reports (1A–2A)' },
          { points: 300, tool: 'Midterm Case Study / Examination' },
        ],
      },
      {
        outcome: `CILO 2 — Applied Problem Solving & Synthesis in ${subject.title}`,
        totalWeight: 50,
        items: [
          { points: 100, tool: 'Applied Exercises & Technical Reports' },
          { points: 300, tool: 'Final Case Study / Capstone Examination' },
        ],
      },
    ],
    references: [
      'Spady, W. G., & Uy, F. A. A. Outcome-Based Education: Critical Issues and Answers.',
      `USJ-R School of Engineering Official Reference Manual for ${subject.code}: ${subject.title} (Curriculum 2022).`,
    ],
    coursePolicies: DEFAULT_POLICIES,
    remarks: `Pre-existing institutional electronic syllabus template assigned to ${subject.code} (Version 1).`,
    learningOutcomes: [
      `CILO 1: Explain the fundamental concepts, theories, and professional engineering standards of ${subject.title}.`,
      `CILO 2: Apply analytical methods, modern tools, and design principles to solve structured ${deptName.toLowerCase()} problems in ${subject.title}.`,
    ],
    topics: [
      { week: 1, topic: `Weeks 1–3: Introduction and Core Foundations of ${subject.title}` },
      { week: 2, topic: `Weeks 4–9: Analytical Methods and Applied Techniques in ${subject.title}` },
      { week: 3, topic: `Weeks 10–18: Integrated Engineering Applications and Final Synthesis` },
    ],
    gradingSystem: [
      { component: 'CILO 1 — Foundational Concepts & Analysis', weight: 50 },
      { component: 'CILO 2 — Applied Problem Solving & Synthesis', weight: 50 },
    ],
  };
}

async function main() {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ departmentId: 'asc' }, { code: 'asc' }],
    include: { syllabi: { include: { versions: true } } },
  });

  const users = await prisma.user.findMany({
    where: { accountStatus: 'Active' },
    select: { id: true, fullName: true, role: true, departmentId: true },
  });

  const now = new Date();
  let createdCount = 0;
  let upgradedCount = 0;
  let skippedCount = 0;

  for (const subj of subjects) {
    const deptCode = String(subj.departmentId).toUpperCase();
    const deptHead = users.find((u) => u.role === 'DepartmentHead' && u.departmentId === deptCode);
    const matchedFaculty =
      (subj.professorName
        ? users.find(
            (u) =>
              (u.role === 'Educator' || u.role === 'Faculty') &&
              u.fullName.trim().toLowerCase() === subj.professorName.trim().toLowerCase()
          )
        : null) ||
      users.find((u) => (u.role === 'Educator' || u.role === 'Faculty') && u.departmentId === deptCode) ||
      deptHead ||
      users[0];

    const reviewerId = deptHead ? deptHead.id : matchedFaculty.id;
    const templateContent = buildElectronicTemplate(subj);
    const validSem =
      subj.semester === '2nd Semester' || subj.semester === 'Summer' ? subj.semester : '1st Semester';

    if (!subj.syllabi || subj.syllabi.length === 0) {
      await prisma.syllabus.create({
        data: {
          subjectId: subj.id,
          instructorId: matchedFaculty.id,
          departmentId: deptCode,
          academicYear: '2026-2027',
          semester: validSem,
          section: 'A',
          status: 'APPROVED',
          currentVersionNumber: 1,
          submittedAt: now,
          reviewedAt: now,
          reviewedByUserId: reviewerId,
          reviewerRemarks: 'Initial pre-existing institutional syllabus template (Version 1)',
          versions: {
            create: {
              versionNumber: 1,
              editorId: matchedFaculty.id,
              changeSummary: `Pre-existing institutional USJ-R syllabus template assigned to ${subj.code} (Version 1)`,
              changeType: 'Create',
              statusAtSave: 'APPROVED',
              approvalStatus: 'APPROVED',
              content: templateContent,
              submittedById: matchedFaculty.id,
              submittedAt: now,
              reviewedById: reviewerId,
              reviewedAt: now,
            },
          },
        },
      });
      createdCount++;
    } else {
      const existingSyl = subj.syllabi[0];
      const hasApprovedV1 = existingSyl.versions.some((v) => v.approvalStatus === 'APPROVED');
      if (!hasApprovedV1) {
        const v1 = existingSyl.versions.find((v) => v.versionNumber === 1) || existingSyl.versions[0];
        if (v1) {
          await prisma.syllabusVersion.update({
            where: { id: v1.id },
            data: {
              versionNumber: 1,
              approvalStatus: 'APPROVED',
              statusAtSave: 'APPROVED',
              content: templateContent,
              changeSummary: `Pre-existing institutional USJ-R syllabus template assigned to ${subj.code} (Version 1)`,
              reviewedById: reviewerId,
              reviewedAt: now,
            },
          });
        }
        await prisma.syllabus.update({
          where: { id: existingSyl.id },
          data: {
            status: 'APPROVED',
            currentVersionNumber: 1,
            reviewedByUserId: reviewerId,
            reviewedAt: now,
            reviewerRemarks: 'Initial pre-existing institutional syllabus template (Version 1)',
          },
        });
        upgradedCount++;
      } else {
        skippedCount++;
      }
    }
  }

  console.log(
    `Pre-existing Version 1 Electronic Syllabi Seed Complete: created=${createdCount}, upgraded=${upgradedCount}, already_approved=${skippedCount}, total_subjects=${subjects.length}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

