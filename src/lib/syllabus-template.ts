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
  generatedFromSubject?: boolean;
  subjectSnapshot?: SubjectDetailsSnapshot;
  curriculumYear: string;
  coRequisites: string;
  programs: string;
  schedule: string;
  courseDescription: string;
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
  school: 'ACADEMIC DEPARTMENTS',
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
    'Imbued with the spirit of "Caritas et Scientia", we provide the highest level of Quality Christian Community-oriented Education.',
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

export const USJR_EVALUATION_RATING_SCALE = [
  { score: '0–21.4', fg: '5.0', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '21.5–23.4', fg: '4.9', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '23.5–25.4', fg: '4.8', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '25.5–27.4', fg: '4.7', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '27.5–29.4', fg: '4.6', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '29.5–31.4', fg: '4.5', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '31.5–33.4', fg: '4.4', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '33.5–35.4', fg: '4.3', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '35.5–37.4', fg: '4.2', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '37.5–39.4', fg: '4.1', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '39.5–41.4', fg: '4.0', qualitative: 'Failed', proficiency: 'POOR', rubric: '1' },
  { score: '41.5–43.4', fg: '3.9', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '43.5–45.4', fg: '3.8', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '45.5–47.4', fg: '3.7', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '47.5–49.4', fg: '3.6', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '49.5–51.4', fg: '3.5', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '51.5–53.4', fg: '3.4', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '53.5–55.4', fg: '3.3', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '55.5–57.4', fg: '3.2', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '57.5–59.4', fg: '3.1', qualitative: 'Failed', proficiency: 'FAMILIAR', rubric: '2' },
  { score: '59.5–61.4', fg: '3.0', qualitative: 'Passing', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '61.5–63.4', fg: '2.9', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '63.5–64.4', fg: '2.8', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '65.5–67.4', fg: '2.7', qualitative: 'Fairly Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '67.5–69.4', fg: '2.6', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '69.5–71.4', fg: '2.5', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '71.5–73.4', fg: '2.4', qualitative: 'Satisfactory', proficiency: 'KNOWLEDGEABLE', rubric: '3' },
  { score: '73.5–75.4', fg: '2.3', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '75.5–77.4', fg: '2.2', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '77.5–79.4', fg: '2.1', qualitative: 'Very Satisfactory', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '79.5–81.4', fg: '2.0', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '81.5–83.4', fg: '1.9', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '83.5–85.4', fg: '1.8', qualitative: 'Meritorious', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '85.5–87.4', fg: '1.7', qualitative: 'Good', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '87.5–89.4', fg: '1.6', qualitative: 'Good', proficiency: 'PROFICIENT', rubric: '4' },
  { score: '89.5–91.4', fg: '1.5', qualitative: 'Very Good', proficiency: 'EXPERT', rubric: '5' },
  { score: '91.5–92.4', fg: '1.4', qualitative: 'Very Good', proficiency: 'EXPERT', rubric: '5' },
  { score: '93.5–95.4', fg: '1.3', qualitative: 'Superior', proficiency: 'EXPERT', rubric: '5' },
  { score: '95.5–97.4', fg: '1.2', qualitative: 'Superior', proficiency: 'EXPERT', rubric: '5' },
  { score: '97.5–99.4', fg: '1.1', qualitative: 'Excellent', proficiency: 'EXPERT', rubric: '5' },
  { score: '99.5–100', fg: '1.0', qualitative: 'Excellent', proficiency: 'EXPERT', rubric: '5' },
];

export function getProgramNameForDepartment(deptCode?: string | null, deptName?: string | null): string {
  if (deptName && deptName.trim()) return deptName.trim();
  switch ((deptCode || '').toUpperCase()) {
    case 'CE':
      return 'Civil Engineering Department';
    case 'CPE':
      return 'Computer Engineering Department';
    case 'EE':
      return 'Electrical Engineering Department';
    case 'ECE':
      return 'Electronics Engineering Department';
    case 'IE':
      return 'Industrial Engineering Department';
    case 'ME':
      return 'Mechanical Engineering Department';
    default:
      return deptCode ? `${deptCode} Department` : 'Academic Department';
  }
}

/**
 * Generates an initial Version 1 electronic syllabus strictly from the subject's
 * actual catalog details — works across ALL departments without injecting fabricated boilerplate.
 */
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
  const deptLabel = getProgramNameForDepartment(subject?.departmentId, departmentName);
  const code = (subject?.code || '').trim();
  const title = (subject?.title || 'Course Syllabus').trim();
  const units = Number(subject?.units ?? 3);
  const lecHours = Number(subject?.lecHours ?? 3);
  const labHours = Number(subject?.labHours ?? 0);
  const prerequisite = (subject?.prerequisite || 'None').trim() || 'None';
  const yearLevel = (subject?.yearLevel || '1st Year').trim();
  const semester = (subject?.semester || '1st Semester').trim();
  const rawDescription = (subject?.description || '').trim();

  const factualDescription =
    rawDescription ||
    (code
      ? `${code} (${title}) is a ${units}-unit course (${lecHours} hr${lecHours === 1 ? '' : 's'} lecture, ${labHours} hr${labHours === 1 ? '' : 's'} laboratory) offered under ${deptLabel} for ${yearLevel} (${semester}). Prerequisite: ${prerequisite}.`
      : `Official electronic course syllabus under ${deptLabel}.`);

  return {
    generatedFromSubject: true,
    subjectSnapshot: {
      code,
      title,
      departmentId: subject?.departmentId,
      departmentName: deptLabel,
      units,
      lecHours,
      labHours,
      prerequisite,
      yearLevel,
      semester,
      professorName: subject?.professorName || null,
      description: rawDescription || null,
    },
    curriculumYear: '',
    coRequisites: 'None',
    programs: deptLabel,
    schedule: '',
    courseDescription: factualDescription,
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

/**
 * Normalizes any stored syllabus version JSON into a complete ElectronicSyllabusContent object.
 * Strictly preserves empty optional arrays instead of injecting fabricated boilerplate.
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

  // Map cilos or legacy learningOutcomes without fabricating defaults
  let cilos: CiloRow[] = [];
  if (Array.isArray(src.cilos)) {
    cilos = src.cilos
      .filter((c: any) => c && (String(c.code || '').trim() || String(c.description || '').trim()))
      .map((c: any, idx: number) => ({
        code: c.code || `CLO ${idx + 1}`,
        description: c.description || '',
        mappedPilo: c.mappedPilo || '',
        peo1: Boolean(c.peo1),
        peo2: Boolean(c.peo2),
        peo3: Boolean(c.peo3),
      }));
  } else if (Array.isArray(src.learningOutcomes) && src.learningOutcomes.length > 0) {
    cilos = src.learningOutcomes
      .filter((d: any) => String(d || '').trim())
      .map((desc: string, idx: number) => ({
        code: `CLO ${idx + 1}`,
        description: String(desc || ''),
        mappedPilo: '',
        peo1: false,
        peo2: false,
        peo3: false,
      }));
  }

  // Map weeklyPlan or legacy topics without fabricating defaults
  let weeklyPlan: WeeklyPlanRow[] = [];
  if (Array.isArray(src.weeklyPlan)) {
    weeklyPlan = src.weeklyPlan
      .filter(
        (w: any) =>
          w &&
          (String(w.timeFrame || '').trim() ||
            String(w.learningContent || '').trim() ||
            String(w.intendedLearningOutcome || '').trim())
      )
      .map((w: any) => ({
        timeFrame: w.timeFrame || '',
        intendedLearningOutcome: w.intendedLearningOutcome || '',
        ciloMapping: Array.isArray(w.ciloMapping) ? w.ciloMapping.map(String) : [],
        assessment: w.assessment || '',
        teachingLearningActivities: w.teachingLearningActivities || '',
        learningContent: w.learningContent || '',
        resources: w.resources || '',
      }));
  } else if (Array.isArray(src.topics) && src.topics.length > 0) {
    weeklyPlan = src.topics
      .filter((t: any) => t && String(t.topic || t.title || '').trim())
      .map((t: any, idx: number) => ({
        timeFrame: t.week ? `Week ${t.week}` : `Unit ${idx + 1}`,
        intendedLearningOutcome: t.description || '',
        ciloMapping: [],
        assessment: t.assessments || '',
        teachingLearningActivities: t.activities || '',
        learningContent: t.topic || t.title || '',
        resources: '',
      }));
  }

  // Map owatGrading or legacy gradingSystem without fabricating defaults
  let owatGrading: OwatOutcomeGroup[] = [];
  if (Array.isArray(src.owatGrading)) {
    owatGrading = src.owatGrading
      .filter((g: any) => g && (String(g.outcome || '').trim() || Number(g.totalWeight) > 0))
      .map((g: any) => ({
        outcome: g.outcome || '',
        totalWeight: Number(g.totalWeight) || 0,
        items: Array.isArray(g.items)
          ? g.items.map((it: any) => ({ points: Number(it.points) || 0, tool: it.tool || '' }))
          : [],
      }));
  } else if (Array.isArray(src.gradingSystem) && src.gradingSystem.length > 0) {
    owatGrading = src.gradingSystem
      .filter((g: any) => g && String(g.component || '').trim())
      .map((g: any) => ({
        outcome: g.component || 'Assessment Component',
        totalWeight: Number(g.weight ?? g.percentage) || 0,
        items: g.description ? [{ points: 100, tool: g.description }] : [],
      }));
  }

  const references: string[] = Array.isArray(src.references)
    ? src.references.map((r: any) => String(r || '').trim()).filter(Boolean)
    : [];

  const coursePolicies: CoursePolicySection[] = Array.isArray(src.coursePolicies)
    ? src.coursePolicies
        .filter((p: any) => p && (String(p.section || '').trim() || (Array.isArray(p.items) && p.items.length > 0)))
        .map((p: any) => ({
          section: String(p.section || '').trim(),
          items: Array.isArray(p.items) ? p.items.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
        }))
    : [];

  return {
    generatedFromSubject: Boolean(src.generatedFromSubject),
    subjectSnapshot: src.subjectSnapshot || defaults.subjectSnapshot,
    curriculumYear: typeof src.curriculumYear === 'string' ? src.curriculumYear : defaults.curriculumYear,
    coRequisites: typeof src.coRequisites === 'string' ? src.coRequisites : defaults.coRequisites,
    programs: typeof src.programs === 'string' && src.programs.trim() ? src.programs : defaults.programs,
    schedule: typeof src.schedule === 'string' ? src.schedule : defaults.schedule,
    courseDescription:
      typeof src.courseDescription === 'string' && src.courseDescription.trim()
        ? src.courseDescription
        : defaults.courseDescription,
    peos: Array.isArray(src.peos) ? src.peos : [],
    missionPeoMapping: Array.isArray(src.missionPeoMapping) ? src.missionPeoMapping : [],
    piloPeoMapping: Array.isArray(src.piloPeoMapping) ? src.piloPeoMapping : [],
    piloStandards: Array.isArray(src.piloStandards) ? src.piloStandards : [],
    cilos,
    assessmentOfOutcomes: typeof src.assessmentOfOutcomes === 'string' ? src.assessmentOfOutcomes : '',
    criteriaStandards: typeof src.criteriaStandards === 'string' ? src.criteriaStandards : '',
    weeklyPlan,
    integrationSchemes: Array.isArray(src.integrationSchemes) ? src.integrationSchemes : [],
    owatGrading,
    references,
    coursePolicies,
    remarks: typeof src.remarks === 'string' ? src.remarks : defaults.remarks,
    learningOutcomes: cilos.map((c) => `${c.code}: ${c.description}`),
    topics: weeklyPlan.map((w, idx) => ({ week: idx + 1, topic: `${w.timeFrame}: ${w.learningContent}` })),
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
  return list.map((x, i) => `${i + 1}. ${x}`).join('\n');
}

function formatCilos(cilos: CiloRow[]): string {
  return cilos
    .map((c) => `${c.code}: ${c.description}${c.mappedPilo ? ` [Aligned: ${c.mappedPilo}]` : ''}`)
    .join('\n');
}

function formatWeeklyPlan(rows: WeeklyPlanRow[]): string {
  return rows
    .map((r) => {
      const parts = [
        `[${r.timeFrame || 'Unit'}] ${r.learningContent}`,
        r.intendedLearningOutcome ? `Outcome: ${r.intendedLearningOutcome}` : '',
        r.assessment ? `Assessment: ${r.assessment}` : '',
        r.teachingLearningActivities ? `Activities: ${r.teachingLearningActivities}` : '',
        r.resources ? `Resources: ${r.resources}` : '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');
}

function formatOwat(groups: OwatOutcomeGroup[]): string {
  return groups
    .map((g) => {
      const sub =
        g.items.length > 0 ? `: ${g.items.map((i) => `${i.tool} (${i.points} pts)`).join('; ')}` : '';
      return `${g.outcome} (${g.totalWeight}%)${sub}`;
    })
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

  const pairs: { id: string; section: string; label: string; before: string; after: string; alwaysShow?: boolean }[] = [
    {
      id: 'metadata',
      section: 'Course Details',
      label: 'Department / Program, Co-Requisites & Schedule',
      before: `Program/Dept: ${a.programs}\nCo-Requisites: ${a.coRequisites || 'None'}\nSchedule: ${a.schedule || '—'}${a.curriculumYear ? `\nCurriculum: ${a.curriculumYear}` : ''}`,
      after: `Program/Dept: ${b.programs}\nCo-Requisites: ${b.coRequisites || 'None'}\nSchedule: ${b.schedule || '—'}${b.curriculumYear ? `\nCurriculum: ${b.curriculumYear}` : ''}`,
      alwaysShow: true,
    },
    {
      id: 'overview',
      section: 'Course Description',
      label: 'Course Description / Overview',
      before: a.courseDescription,
      after: b.courseDescription,
      alwaysShow: true,
    },
    {
      id: 'cilos',
      section: 'Course Learning Outcomes',
      label: 'Learning Outcomes',
      before: formatCilos(a.cilos),
      after: formatCilos(b.cilos),
    },
    {
      id: 'weeklyPlan',
      section: 'Course Outline',
      label: 'Topics, Time Frame, Outcomes & Activities',
      before: formatWeeklyPlan(a.weeklyPlan),
      after: formatWeeklyPlan(b.weeklyPlan),
    },
    {
      id: 'owat',
      section: 'Grading & Assessment',
      label: 'Grading Components & Weights',
      before: formatOwat(a.owatGrading),
      after: formatOwat(b.owatGrading),
    },
    {
      id: 'assessment',
      section: 'Assessment Criteria',
      label: 'Assessment Methods & Standards',
      before: [a.assessmentOfOutcomes, a.criteriaStandards].filter(Boolean).join('\n'),
      after: [b.assessmentOfOutcomes, b.criteriaStandards].filter(Boolean).join('\n'),
    },
    {
      id: 'references',
      section: 'References',
      label: 'Textbooks & Learning Resources',
      before: formatStringList(a.references),
      after: formatStringList(b.references),
    },
    {
      id: 'policies',
      section: 'Course Policies',
      label: 'Classroom Guidelines & Policies',
      before: formatPolicies(a.coursePolicies),
      after: formatPolicies(b.coursePolicies),
    },
    {
      id: 'remarks',
      section: 'Remarks',
      label: 'Revision Remarks',
      before: a.remarks,
      after: b.remarks,
      alwaysShow: true,
    },
  ];

  const items: SectionDiffItem[] = pairs
    .filter((p) => p.alwaysShow || p.before.trim() || p.after.trim())
    .map((p) => ({
      id: p.id,
      section: p.section,
      label: p.label,
      before: p.before,
      after: p.after,
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
