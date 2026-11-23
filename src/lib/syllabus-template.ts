export interface PeoItem {
  code: string;
  statement: string;
}

export interface MissionPeoRow {
  mission: string;
  peo: string;
}

export interface PiloPeoRow {
  letter: string;
  outcome: string;
  peo1: boolean;
  peo2: boolean;
  peo3: boolean;
}

export interface PiloStandardRow {
  pilo: string;
  standard: string;
}

export interface CiloRow {
  code: string;
  description: string;
  mappedPilo: string;
  peo1: boolean;
  peo2: boolean;
  peo3: boolean;
}

export interface WeeklyPlanRow {
  timeFrame: string;
  intendedLearningOutcome: string;
  ciloMapping: string[];
  assessment: string;
  teachingLearningActivities: string;
  learningContent: string;
  resources: string;
}

export interface IntegrationSchemeItem {
  coreValue: string;
  description: string;
}

export interface OwatAssessmentItem {
  points: number;
  tool: string;
}

export interface OwatOutcomeGroup {
  outcome: string;
  totalWeight: number;
  items: OwatAssessmentItem[];
}

export interface CoursePolicySection {
  section: string;
  items: string[];
}

export interface SubjectDetailsSnapshot {
  code?: string;
  title?: string;
  departmentId?: string;
  departmentName?: string;
  units?: number;
  lecHours?: number;
  labHours?: number;
  prerequisite?: string | null;
  yearLevel?: string | null;
  semester?: string | null;
  professorName?: string | null;
  description?: string | null;
}

export interface ElectronicSyllabusContent {
  curriculumYear: string;
  coRequisites: string;
  termOffered?: string;
  programs: string;
  schedule: string;
  courseDescription: string;
  peoStatement?: string;
  peos: PeoItem[];
  missionPeoMapping: MissionPeoRow[];
  piloPeoMapping: PiloPeoRow[];
  piloStandards: PiloStandardRow[];
  cilos: CiloRow[];
  assessmentOfOutcomes: string;
  criteriaStandards: string;
  weeklyPlan: WeeklyPlanRow[];
  integrationSchemes: IntegrationSchemeItem[];
  owatGrading: OwatOutcomeGroup[];
  references: string[];
  coursePolicies: CoursePolicySection[];
  remarks: string;
  subjectSnapshot?: SubjectDetailsSnapshot;
  // Backward-compatible mirrors for legacy endpoints/exports
  learningOutcomes?: string[];
  topics?: { week: number; topic: string }[];
  gradingSystem?: { component: string; weight: number }[];
  _reviewMeta?: {
    reviewComments?: string | null;
    reviewerName?: string | null;
    reviewerRole?: string | null;
    reviewedAt?: string | null;
  };
  _proposalMeta?: {
    proposalNumber: number;
    baseVersionNumber: number;
    targetVersionNumber: number;
  };
}

export const USJR_INSTITUTIONAL_HEADER = {
  university: 'University of San Jose-Recoletos',
  location: 'Cebu City, Philippines',
  status: 'CHED Autonomous Status',
  school: 'SCHOOL OF ENGINEERING',
  catholicAttributes: [
    '❶ Orthodoxy in Catholic Doctrine',
    '❷ Integrity in Moral Life',
    '❸ Dynamism in Prayer Life',
  ],
  augustinianAttributes: [
    '❶ Contemplative',
    '❷ Communitarian',
    '❸ Apostolic',
    '❹ Marian',
  ],
  vision:
    'A Recoletos University renowned for Education Excellence, Research Impact, and Community Transformation.',
  mission:
    'Imbued with the spirit of “Caritas et Scientia”, we provide the highest level of Quality Christian Community-oriented Education.',
  coreValues: [
    '❶ Interiority',
    '❷ Nationalism',
    '❸ Service',
    '❹ Pioneerism',
    '❺ Integrity',
    '❻ Reliability',
    '❼ Excellence',
  ],
  qualityStatement:
    'USJ-R stands for quality Christian Community-oriented education. In pursuit of this commitment, we continually enliven the curriculum with Gospel values, hybridize programs for value innovation, engage in interdisciplinary approach to integral formation, exemplify the Augustinian Recollect charism and core values, and leverage resources for optimal results.',
  graduateAttributes: [
    '❶ Socially Responsible Communitarian',
    '❷ God-Centered Individual',
    '❸ Highly Competent Professional',
    '❹ Effective Communicator',
    '❺ Adaptive Life-Long Learner',
  ],
};

export const DEFAULT_PILO_LIST: PiloPeoRow[] = [
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

export const DEFAULT_INTEGRATION_SCHEMES: IntegrationSchemeItem[] = [
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

export const DEFAULT_COURSE_POLICIES: CoursePolicySection[] = [
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

export const USJR_EVALUATION_RATING_SCALE = [
  { score: '0-21.4', fg: '5.0', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '21.5-23.4', fg: '4.9', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '23.5-25.4', fg: '4.8', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '25.5-27.4', fg: '4.7', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '27.5-29.4', fg: '4.6', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '29.5-31.4', fg: '4.5', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '31.5-33.4', fg: '4.4', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '33.5-35.4', fg: '4.3', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '35.5-37.4', fg: '4.2', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '37.5-39.4', fg: '4.1', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '39.5-41.4', fg: '4.0', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '41.5-43.4', fg: '3.9', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '43.5-45.4', fg: '3.8', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '45.5-47.4', fg: '3.7', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '47.5-49.4', fg: '3.6', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '49.5-51.4', fg: '3.5', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '51.5-53.4', fg: '3.4', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '53.5-55.4', fg: '3.3', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '55.5-57.4', fg: '3.2', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '57.5-59.4', fg: '3.1', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '59.5-61.4', fg: '3.0', qualitative: 'Passing', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '61.5-63.4', fg: '2.9', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '63.5-64.4', fg: '2.8', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '65.5-67.4', fg: '2.7', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '67.5-69.4', fg: '2.6', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '69.5-71.4', fg: '2.5', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '71.5-73.4', fg: '2.4', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '73.5-75.4', fg: '2.3', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '75.5-77.4', fg: '2.2', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '77.5-79.4', fg: '2.1', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '79.5-81.4', fg: '2.0', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '81.5-83.4', fg: '1.9', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '83.5-85.4', fg: '1.8', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '85.5-87.4', fg: '1.7', qualitative: 'Good', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '87.5-89.4', fg: '1.6', qualitative: 'Good', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '89.5-91.4', fg: '1.5', qualitative: 'Very Good', proficiency: 'EXPERT', rubric: '5' },
  { score: '91.5-92.4', fg: '1.4', qualitative: 'Very Good', proficiency: 'EXPERT', rubric: '5' },
  { score: '93.5-95.4', fg: '1.3', qualitative: 'Superior', proficiency: 'EXPERT', rubric: '5' },
  { score: '95.5-97.4', fg: '1.2', qualitative: 'Superior', proficiency: 'EXPERT', rubric: '5' },
  { score: '97.5-99.4', fg: '1.1', qualitative: 'Excellent', proficiency: 'EXPERT', rubric: '5' },
  { score: '99.5 -100', fg: '1.0', qualitative: 'Excellent', proficiency: 'EXPERT', rubric: '5' },
];

export function getDepartmentHeaderName(deptCode?: string | null, deptName?: string | null): string {
  const code = (deptCode || '').trim().toUpperCase();
  switch (code) {
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

export function getDisciplineName(deptCode?: string | null, deptName?: string | null): string {
  switch ((deptCode || '').trim().toUpperCase()) {
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
      return (deptName || 'Engineering').replace(/^Department of\s+/i, '').replace(/\s*Department$/i, '').trim();
  }
}

export function getProgramNameForDepartment(deptCode?: string | null, deptName?: string | null): string {
  switch ((deptCode || '').trim().toUpperCase()) {
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
      return deptName?.trim() || 'BS Engineering';
  }
}

export function getDefaultOwatGrading(deptCode?: string | null, deptName?: string | null): OwatOutcomeGroup[] {
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

export function createDefaultSyllabusContent(
  subject?: {
    code?: string;
    title?: string;
    description?: string | null;
    departmentId?: string;
    units?: number;
    lecHours?: number;
    labHours?: number;
    prerequisite?: string | null;
    yearLevel?: string | null;
    semester?: string | null;
    professorName?: string | null;
  } | null,
  departmentName?: string
): ElectronicSyllabusContent {
  const discipline = getDisciplineName(subject?.departmentId, departmentName);
  const program = getProgramNameForDepartment(subject?.departmentId, departmentName);
  const termOffered = [subject?.semester || '1st Semester', subject?.yearLevel || '']
    .filter(Boolean)
    .join(' — ');

  return {
    curriculumYear: 'Curriculum 2022',
    coRequisites: 'None',
    termOffered,
    programs: program,
    schedule: '',
    courseDescription: (subject?.description || '').trim(),
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
    owatGrading: getDefaultOwatGrading(subject?.departmentId, departmentName),
    references: [],
    coursePolicies: DEFAULT_COURSE_POLICIES.map((p) => ({ section: p.section, items: [...p.items] })),
    remarks: '',
    subjectSnapshot: {
      code: subject?.code,
      title: subject?.title,
      departmentId: subject?.departmentId,
      departmentName: getDepartmentHeaderName(subject?.departmentId, departmentName),
      units: subject?.units ?? 3,
      lecHours: subject?.lecHours ?? 3,
      labHours: subject?.labHours ?? 0,
      prerequisite: subject?.prerequisite || 'None',
      yearLevel: subject?.yearLevel || '1st Year',
      semester: subject?.semester || '1st Semester',
      professorName: subject?.professorName || null,
      description: subject?.description || null,
    },
    learningOutcomes: [],
    topics: [],
    gradingSystem: getDefaultOwatGrading(subject?.departmentId, departmentName).map((g) => ({
      component: g.outcome,
      weight: g.totalWeight,
    })),
  };
}

/**
 * Normalizes any syllabus version JSON into the exact official 11-page USJ-R syllabus format.
 */
export function normalizeSyllabusContent(
  raw: any,
  subject?: {
    code?: string;
    title?: string;
    description?: string | null;
    departmentId?: string;
    units?: number;
    lecHours?: number;
    labHours?: number;
    prerequisite?: string | null;
    yearLevel?: string | null;
    semester?: string | null;
    professorName?: string | null;
  } | null,
  departmentName?: string
): ElectronicSyllabusContent {
  const defaults = createDefaultSyllabusContent(subject, departmentName);
  const src = raw && typeof raw === 'object' ? raw : {};

  // PEO statement text (supports both peoStatement string and legacy peos array)
  const peos: PeoItem[] = Array.isArray(src.peos) ? src.peos : [];
  const peoStatement =
    typeof src.peoStatement === 'string'
      ? src.peoStatement
      : peos.length > 0
      ? peos.map((p) => `${p.code ? `${p.code}: ` : ''}${p.statement}`).join('\n')
      : '';

  const missionPeoMapping: MissionPeoRow[] =
    Array.isArray(src.missionPeoMapping) && src.missionPeoMapping.length > 0
      ? src.missionPeoMapping.map((r: any) => ({
          mission: String(r?.mission || ''),
          peo: String(r?.peo || ''),
        }))
      : defaults.missionPeoMapping;

  const piloPeoMapping: PiloPeoRow[] =
    Array.isArray(src.piloPeoMapping) && src.piloPeoMapping.length > 0
      ? src.piloPeoMapping.map((r: any, idx: number) => ({
          letter: String(r?.letter || String.fromCharCode(97 + idx)),
          outcome: String(r?.outcome || ''),
          peo1: Boolean(r?.peo1),
          peo2: Boolean(r?.peo2),
          peo3: Boolean(r?.peo3),
        }))
      : defaults.piloPeoMapping;

  const piloStandards: PiloStandardRow[] =
    Array.isArray(src.piloStandards) && src.piloStandards.length > 0
      ? src.piloStandards.map((r: any) => ({
          pilo: String(r?.pilo || ''),
          standard: String(r?.standard || ''),
        }))
      : defaults.piloStandards;

  let cilos: CiloRow[] = defaults.cilos;
  if (Array.isArray(src.cilos) && src.cilos.length > 0) {
    cilos = src.cilos.map((c: any, idx: number) => ({
      code: c.code || `CILO ${idx + 1}`,
      description: c.description || '',
      mappedPilo: c.mappedPilo || '',
      peo1: Boolean(c.peo1),
      peo2: Boolean(c.peo2),
      peo3: Boolean(c.peo3),
    }));
  } else if (Array.isArray(src.learningOutcomes) && src.learningOutcomes.length > 0) {
    cilos = src.learningOutcomes.map((desc: string, idx: number) => ({
      code: `CILO ${idx + 1}`,
      description: String(desc || ''),
      mappedPilo: '',
      peo1: false,
      peo2: true,
      peo3: true,
    }));
  }

  let weeklyPlan: WeeklyPlanRow[] = defaults.weeklyPlan;
  if (Array.isArray(src.weeklyPlan) && src.weeklyPlan.length > 0) {
    weeklyPlan = src.weeklyPlan.map((w: any) => ({
      timeFrame: String(w?.timeFrame || ''),
      intendedLearningOutcome: String(w?.intendedLearningOutcome || ''),
      ciloMapping: Array.isArray(w?.ciloMapping) ? w.ciloMapping.map(String) : [],
      assessment: String(w?.assessment || ''),
      teachingLearningActivities: String(w?.teachingLearningActivities || ''),
      learningContent: String(w?.learningContent || ''),
      resources: String(w?.resources || ''),
    }));
  }

  const integrationSchemes: IntegrationSchemeItem[] =
    Array.isArray(src.integrationSchemes) && src.integrationSchemes.length > 0
      ? src.integrationSchemes.map((i: any) => ({
          coreValue: String(i?.coreValue || ''),
          description: String(i?.description || ''),
        }))
      : defaults.integrationSchemes;

  const owatGrading: OwatOutcomeGroup[] =
    Array.isArray(src.owatGrading) && src.owatGrading.length > 0
      ? src.owatGrading.map((g: any) => ({
          outcome: String(g?.outcome || ''),
          totalWeight: Number(g?.totalWeight) || 0,
          items: Array.isArray(g?.items)
            ? g.items.map((it: any) => ({ points: Number(it?.points) || 0, tool: String(it?.tool || '') }))
            : [],
        }))
      : defaults.owatGrading;

  const references: string[] = Array.isArray(src.references)
    ? src.references.map((r: any) => String(r || ''))
    : [];

  const coursePolicies: CoursePolicySection[] =
    Array.isArray(src.coursePolicies) && src.coursePolicies.length > 0
      ? src.coursePolicies.map((p: any) => ({
          section: String(p?.section || ''),
          items: Array.isArray(p?.items) ? p.items.map((x: any) => String(x || '')) : [],
        }))
      : defaults.coursePolicies;

  return {
    curriculumYear: typeof src.curriculumYear === 'string' && src.curriculumYear.trim() ? src.curriculumYear : defaults.curriculumYear,
    coRequisites: typeof src.coRequisites === 'string' ? src.coRequisites : defaults.coRequisites,
    termOffered: typeof src.termOffered === 'string' && src.termOffered.trim() ? src.termOffered : defaults.termOffered,
    programs: typeof src.programs === 'string' && src.programs.trim() ? src.programs : defaults.programs,
    schedule: typeof src.schedule === 'string' ? src.schedule : '',
    courseDescription: typeof src.courseDescription === 'string' ? src.courseDescription : defaults.courseDescription,
    peoStatement,
    peos,
    missionPeoMapping,
    piloPeoMapping,
    piloStandards,
    cilos,
    assessmentOfOutcomes: typeof src.assessmentOfOutcomes === 'string' ? src.assessmentOfOutcomes : '',
    criteriaStandards: typeof src.criteriaStandards === 'string' ? src.criteriaStandards : '',
    weeklyPlan,
    integrationSchemes,
    owatGrading,
    references,
    coursePolicies,
    remarks: typeof src.remarks === 'string' ? src.remarks : '',
    subjectSnapshot: src.subjectSnapshot || defaults.subjectSnapshot,
    learningOutcomes: cilos.filter((c) => c.description.trim()).map((c) => `${c.code}: ${c.description}`),
    topics: weeklyPlan
      .filter((w) => w.learningContent.trim() || w.timeFrame.trim())
      .map((w, idx) => ({ week: idx + 1, topic: `${w.timeFrame}: ${w.learningContent}` })),
    gradingSystem: owatGrading.map((g) => ({ component: g.outcome, weight: g.totalWeight })),
    _reviewMeta: src._reviewMeta,
    _proposalMeta: src._proposalMeta,
  };
}

export function extractReviewComments(version: any): string | null {
  if (!version) return null;
  if (version.rejectionReason) return version.rejectionReason;
  if (version.reviewComments) return version.reviewComments;
  if (version.content?._reviewMeta?.reviewComments) return version.content._reviewMeta.reviewComments;
  return null;
}

export type DiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';

export interface SectionDiffItem {
  id: string;
  section: string;
  label: string;
  status: DiffStatus;
  before: string;
  after: string;
}

export interface StructuredSyllabusDiff {
  items: SectionDiffItem[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
}

function formatStringList(list: string[]): string {
  return list
    .filter((x) => x.trim())
    .map((x, i) => `${i + 1}. ${x}`)
    .join('\n');
}

function formatMissionPeo(rows: MissionPeoRow[]): string {
  return rows.map((r) => `${r.mission}: ${r.peo || '—'}`).join('\n');
}

function formatPiloMap(rows: PiloPeoRow[]): string {
  return rows
    .map((r) => {
      const checks = [r.peo1 ? 'PEO1' : '', r.peo2 ? 'PEO2' : '', r.peo3 ? 'PEO3' : ''].filter(Boolean).join(', ');
      return `${r.letter}. ${r.outcome} [${checks || '—'}]`;
    })
    .join('\n');
}

function formatPiloStandards(rows: PiloStandardRow[]): string {
  return rows
    .filter((r) => r.pilo.trim() || r.standard.trim())
    .map((r) => `PILO: ${r.pilo} → Standard: ${r.standard}`)
    .join('\n');
}

function formatCilos(cilos: CiloRow[]): string {
  return cilos
    .filter((c) => c.description.trim() || c.mappedPilo.trim() || c.peo1 || c.peo2 || c.peo3)
    .map(
      (c) =>
        `${c.code}: ${c.description || '—'} [PILO: ${c.mappedPilo || '—'} | PEO: ${
          [c.peo1 ? '1' : '', c.peo2 ? '2' : '', c.peo3 ? '3' : ''].filter(Boolean).join(',') || '—'
        }]`
    )
    .join('\n');
}

function formatWeeklyPlan(rows: WeeklyPlanRow[]): string {
  return rows
    .filter(
      (r) =>
        r.timeFrame.trim() ||
        r.intendedLearningOutcome.trim() ||
        r.assessment.trim() ||
        r.teachingLearningActivities.trim() ||
        r.learningContent.trim() ||
        r.resources.trim()
    )
    .map(
      (r) =>
        `[${r.timeFrame || '—'}] ILO: ${r.intendedLearningOutcome || '—'} | CILO: ${r.ciloMapping.join(',') || '—'} | Assessment: ${r.assessment || '—'} | TLA: ${r.teachingLearningActivities || '—'} | Content: ${r.learningContent || '—'} | Resources: ${r.resources || '—'}`
    )
    .join('\n');
}

function formatIntegration(items: IntegrationSchemeItem[]): string {
  return items.map((i) => `${i.coreValue} ${i.description}`).join('\n');
}

function formatOwat(groups: OwatOutcomeGroup[]): string {
  return groups
    .map((g) => `${g.outcome} (${g.totalWeight}%): ${g.items.map((i) => `${i.tool} (${i.points})`).join('; ')}`)
    .join('\n');
}

function formatPolicies(sections: CoursePolicySection[]): string {
  return sections
    .map((s) => `${s.section}:\n${s.items.map((it, i) => `  ${i + 1}. ${it}`).join('\n')}`)
    .join('\n\n');
}

function classifyDiff(before: string, after: string): DiffStatus {
  const a = (before || '').trim();
  const b = (after || '').trim();
  if (a === b) return 'unchanged';
  if (!a && b) return 'added';
  if (a && !b) return 'removed';
  return 'modified';
}

export function computeStructuredSyllabusDiff(
  rawA: any,
  rawB: any,
  subject?: {
    code?: string;
    title?: string;
    description?: string | null;
    departmentId?: string;
    units?: number;
    lecHours?: number;
    labHours?: number;
    prerequisite?: string | null;
    yearLevel?: string | null;
    semester?: string | null;
    professorName?: string | null;
  } | null,
  departmentName?: string
): StructuredSyllabusDiff {
  const a = normalizeSyllabusContent(rawA, subject, departmentName);
  const b = normalizeSyllabusContent(rawB, subject, departmentName);

  const pairs = [
    {
      id: 'course-info',
      section: 'Course Details',
      label: 'Curriculum, Co-Requisites, Term Offered & Program/s',
      before: `Curriculum: ${a.curriculumYear}\nCo-Requisites: ${a.coRequisites}\nTerm Offered: ${a.termOffered || '—'}\nProgram/s: ${a.programs}`,
      after: `Curriculum: ${b.curriculumYear}\nCo-Requisites: ${b.coRequisites}\nTerm Offered: ${b.termOffered || '—'}\nProgram/s: ${b.programs}`,
    },
    {
      id: 'peo',
      section: 'Program Educational Objectives (PEO)',
      label: 'PEO Statements & Mission Mapping',
      before: `${a.peoStatement || ''}\n${formatMissionPeo(a.missionPeoMapping)}`.trim(),
      after: `${b.peoStatement || ''}\n${formatMissionPeo(b.missionPeoMapping)}`.trim(),
    },
    {
      id: 'pilo-peo',
      section: 'PILO – PEO Mapping',
      label: 'Program Intended Learning Outcomes (a–l)',
      before: formatPiloMap(a.piloPeoMapping),
      after: formatPiloMap(b.piloPeoMapping),
    },
    {
      id: 'overview',
      section: 'Course Overview',
      label: 'Course Overview',
      before: a.courseDescription,
      after: b.courseDescription,
    },
    {
      id: 'pilo-standards',
      section: 'PILO & Standards for New Engineering Graduates',
      label: 'Standards Mapping',
      before: formatPiloStandards(a.piloStandards),
      after: formatPiloStandards(b.piloStandards),
    },
    {
      id: 'cilos',
      section: 'Course Intended Learning Outcomes',
      label: 'CILOs, Mapped PILO & Mapped PEO',
      before: formatCilos(a.cilos),
      after: formatCilos(b.cilos),
    },
    {
      id: 'assessment',
      section: 'Assessment of Outcomes & Criteria Standards',
      label: 'Assessment & Criteria',
      before: `Assessment of Outcomes: ${a.assessmentOfOutcomes || '—'}\nCriteria Standards: ${a.criteriaStandards || '—'}`,
      after: `Assessment of Outcomes: ${b.assessmentOfOutcomes || '—'}\nCriteria Standards: ${b.criteriaStandards || '—'}`,
    },
    {
      id: 'weekly-plan',
      section: 'Course Learning Plan',
      label: 'Time Frame, ILO, Topic–CILO Mapping, Assessment, TLA, Content & Resources',
      before: formatWeeklyPlan(a.weeklyPlan),
      after: formatWeeklyPlan(b.weeklyPlan),
    },
    {
      id: 'integration',
      section: 'Integration Schemes',
      label: 'Core Values Integration',
      before: formatIntegration(a.integrationSchemes),
      after: formatIntegration(b.integrationSchemes),
    },
    {
      id: 'owat',
      section: 'OWAT Grading System',
      label: 'Outcome Weight Assessment Table',
      before: formatOwat(a.owatGrading),
      after: formatOwat(b.owatGrading),
    },
    {
      id: 'references',
      section: 'References',
      label: 'References',
      before: formatStringList(a.references),
      after: formatStringList(b.references),
    },
    {
      id: 'policies',
      section: 'Course Policies and Standards',
      label: 'Policies & Classroom Guidelines',
      before: formatPolicies(a.coursePolicies),
      after: formatPolicies(b.coursePolicies),
    },
    {
      id: 'remarks',
      section: 'Remarks Section',
      label: 'Remarks',
      before: a.remarks,
      after: b.remarks,
    },
  ];

  const items: SectionDiffItem[] = pairs.map((p) => ({
    ...p,
    status: classifyDiff(p.before, p.after),
  }));

  return {
    items,
    addedCount: items.filter((i) => i.status === 'added').length,
    removedCount: items.filter((i) => i.status === 'removed').length,
    modifiedCount: items.filter((i) => i.status === 'modified').length,
    unchangedCount: items.filter((i) => i.status === 'unchanged').length,
  };
}
