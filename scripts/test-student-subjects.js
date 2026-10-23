/**
 * Database-level tests for the many-to-many student <-> subject relationship:
 *   users (Student) 1 ──< student_subjects >── 1 subjects
 *
 * Verifies against the real PostgreSQL constraints (not application checks):
 *   1. One student can be associated with multiple subjects.
 *   2. One subject can have multiple students — without duplicating the subject row.
 *   3. Duplicate (studentId, subjectId) is rejected by uq_student_subjects.
 *   4. Non-existent studentId / subjectId are rejected by the foreign keys.
 *   5. Only users with role 'Student' can be associated (trigger).
 *   6. A subject that still has students cannot be deleted (ON DELETE NO ACTION).
 *   7. Names / titles come from users / subjects via joins (not stored on student_subjects).
 *   8. status / academicYear / semester / enrolledById: defaults, CHECK constraints and foreign key.
 *   9. Nothing is persisted — every write runs in a transaction that is rolled back.
 *
 * Usage: node scripts/test-student-subjects.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLLBACK = Symbol('rollback');

let passed = 0;
let failed = 0;
function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name} ${details}`);
    failed++;
  }
}

/** Runs `fn` inside a savepoint and returns "<code> <message>" of the error it throws (or null). */
async function expectError(tx, fn) {
  await tx.$executeRawUnsafe('SAVEPOINT expect_error');
  try {
    await fn();
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT expect_error');
    return null;
  } catch (err) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT expect_error');
    return `${err.code || ''} ${err.message}`.trim();
  }
}
const short = (s) => (s ? s.replace(/\s+/g, ' ').slice(0, 140) : s);

async function counts() {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM student_subjects)::int AS student_subjects, (SELECT count(*) FROM subjects)::int AS subjects`
  );
  return row;
}

async function main() {
  console.log('🧪 student_subjects relationship tests (all writes rolled back)\n');

  const before = await counts();
  console.log(`Before: ${before.student_subjects} student_subjects rows, ${before.subjects} subjects\n`);

  // Pick students and subjects that are NOT yet associated with each other.
  const students = await prisma.user.findMany({ where: { role: 'Student' }, orderBy: { id: 'asc' }, take: 2 });
  if (students.length < 2) throw new Error('Need at least 2 Student users.');
  const [s1, s2] = students;
  const taken = await prisma.studentSubject.findMany({ where: { studentId: { in: [s1.id, s2.id] } }, select: { subjectId: true } });
  const takenIds = taken.map((t) => t.subjectId);
  const subjects = await prisma.subject.findMany({ where: { id: { notIn: takenIds } }, orderBy: { id: 'asc' }, take: 2 });
  if (subjects.length < 2) throw new Error('Need at least 2 subjects that the test students are not enrolled in.');
  const [subjA, subjB] = subjects;
  const educator = await prisma.user.findFirst({ where: { role: 'Educator' }, orderBy: { id: 'asc' } });
  const maxUser = await prisma.user.aggregate({ _max: { id: true } });
  const maxSubject = await prisma.subject.aggregate({ _max: { id: true } });
  const missingStudentId = (maxUser._max.id || 0) + 1;
  const missingSubjectId = (maxSubject._max.id || 0) + 1000;

  try {
    await prisma.$transaction(async (tx) => {
      console.log('1. One student → multiple subjects');
      await tx.studentSubject.create({ data: { studentId: s1.id, subjectId: subjA.id } });
      await tx.studentSubject.create({ data: { studentId: s1.id, subjectId: subjB.id } });
      const s1Rows = await tx.studentSubject.findMany({
        where: { studentId: s1.id, subjectId: { in: [subjA.id, subjB.id] } },
        include: { subject: { select: { code: true } } },
      });
      assert(s1Rows.length === 2, `Student ${s1.id} associated with 2 subjects (${s1Rows.map((r) => r.subject.code).join(', ')})`);

      console.log('\n2. One subject → multiple students (no duplicate subject rows)');
      await tx.studentSubject.create({ data: { studentId: s2.id, subjectId: subjA.id } });
      const subjectView = await tx.subject.findUnique({
        where: { id: subjA.id },
        include: { studentSubjects: { where: { studentId: { in: [s1.id, s2.id] } } } },
      });
      assert(subjectView.studentSubjects.length === 2, `Subject ${subjA.code} has 2 students associated`);
      const [sc] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM subjects WHERE code = $1`, subjA.code);
      assert(sc.n === 1, `Subject ${subjA.code} still exists exactly once in subjects`);

      console.log('\n3. Duplicate association blocked by the database');
      const dup = await expectError(tx, () => tx.studentSubject.create({ data: { studentId: s1.id, subjectId: subjA.id } }));
      assert(dup?.startsWith('P2002') && /studentId|uq_student_subjects/.test(dup), 'Duplicate (studentId, subjectId) rejected by uq_student_subjects', `(got: ${short(dup)})`);
      const rawDup = await expectError(tx, () =>
        tx.$executeRawUnsafe(`INSERT INTO student_subjects ("studentId", "subjectId") VALUES ($1, $2)`, s1.id, subjA.id)
      );
      assert(/23505|uq_student_subjects/.test(rawDup || ''), 'Duplicate rejected even for raw SQL bypassing the app', `(got: ${short(rawDup)})`);

      console.log('\n4. Invalid foreign keys rejected by the database');
      const badStudent = await expectError(tx, () => tx.studentSubject.create({ data: { studentId: missingStudentId, subjectId: subjA.id } }));
      assert(badStudent?.startsWith('P2003') && /fk_student_subjects_student/.test(badStudent), `Non-existent studentId ${missingStudentId} rejected (fk_student_subjects_student)`, `(got: ${short(badStudent)})`);
      const badSubject = await expectError(tx, () => tx.studentSubject.create({ data: { studentId: s1.id, subjectId: missingSubjectId } }));
      assert(badSubject?.startsWith('P2003') && /fk_student_subjects_subject/.test(badSubject), `Non-existent subjectId ${missingSubjectId} rejected (fk_student_subjects_subject)`, `(got: ${short(badSubject)})`);

      console.log('\n5. Only Students can be associated');
      if (educator) {
        const notStudent = await expectError(tx, () => tx.studentSubject.create({ data: { studentId: educator.id, subjectId: subjA.id } }));
        assert(/ENROLL_NOT_STUDENT/.test(notStudent || ''), `Educator ${educator.id} rejected by trigger`, `(got: ${short(notStudent)})`);
      } else {
        console.log('  (skipped: no Educator user found)');
      }

      console.log('\n6. Subject with students cannot be deleted (ON DELETE NO ACTION)');
      const delSubject = await expectError(tx, () => tx.subject.delete({ where: { id: subjA.id } }));
      assert(delSubject !== null && /P2003|fk_student_subjects_subject|foreign key/i.test(delSubject), `Deleting ${subjA.code} while students are associated is rejected`, `(got: ${short(delSubject)})`);

      console.log('\n7. Names and titles via joins');
      const joined = await tx.studentSubject.findMany({
        where: { subjectId: subjA.id, studentId: { in: [s1.id, s2.id] } },
        include: { student: { select: { fullName: true } }, subject: { select: { code: true, title: true } } },
        orderBy: { studentId: 'asc' },
      });
      assert(joined[0]?.student.fullName === s1.fullName && joined[1]?.student.fullName === s2.fullName,
        `Student names from users.fullName: ${joined.map((j) => j.student.fullName).join(', ')}`);
      assert(joined.every((j) => j.subject.code === subjA.code && j.subject.title === subjA.title), `Subject title from subjects: [${subjA.code}] ${subjA.title}`);
      const cols = await tx.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_subjects' ORDER BY ordinal_position`
      );
      const colNames = cols.map((c) => c.column_name);
      assert(!colNames.some((c) => /name|title/i.test(c)),
        `student_subjects stores no names or titles (${colNames.join(', ')})`);

      console.log('\n8. Enrollment detail columns (status / academicYear / semester / enrolledById)');
      const defaults = await tx.studentSubject.findUnique({ where: { studentId_subjectId: { studentId: s2.id, subjectId: subjA.id } } });
      assert(defaults.status === 'ENROLLED' && defaults.academicYear === '2026-2027' && defaults.semester === '1st Semester' && defaults.enrolledById === null,
        `Defaults: status=${defaults.status}, ${defaults.semester} ${defaults.academicYear}, enrolledById=${defaults.enrolledById}`);
      const withDetails = await tx.studentSubject.create({
        data: { studentId: s2.id, subjectId: subjB.id, status: 'COMPLETED', academicYear: '2025-2026', semester: 'Summer', enrolledById: educator?.id ?? null },
        include: { enrolledBy: { select: { fullName: true } } },
      });
      assert(withDetails.status === 'COMPLETED' && withDetails.semester === 'Summer' && withDetails.academicYear === '2025-2026',
        `Stores explicit values (COMPLETED, Summer 2025-2026, enrolled by ${withDetails.enrolledBy?.fullName ?? 'n/a'})`);
      const badStatus = await expectError(tx, () => tx.studentSubject.update({ where: { id: withDetails.id }, data: { status: 'PASSED' } }));
      assert(/student_subjects_status_check|23514|check constraint/i.test(badStatus || ''), "status 'PASSED' rejected by CHECK constraint", `(got: ${short(badStatus)})`);
      const badSemester = await expectError(tx, () => tx.studentSubject.update({ where: { id: withDetails.id }, data: { semester: 'Summer Term' } }));
      assert(/student_subjects_semester_check|23514|check constraint/i.test(badSemester || ''), "semester 'Summer Term' rejected by CHECK constraint", `(got: ${short(badSemester)})`);
      const badYear = await expectError(tx, () => tx.studentSubject.update({ where: { id: withDetails.id }, data: { academicYear: '2026' } }));
      assert(/student_subjects_academic_year_check|23514|check constraint/i.test(badYear || ''), "academicYear '2026' rejected by CHECK constraint", `(got: ${short(badYear)})`);
      const badEnroller = await expectError(tx, () => tx.studentSubject.update({ where: { id: withDetails.id }, data: { enrolledById: missingStudentId } }));
      assert(/P2003|fk_student_subjects_enrolled_by/.test(badEnroller || ''), `Non-existent enrolledById ${missingStudentId} rejected (fk_student_subjects_enrolled_by)`, `(got: ${short(badEnroller)})`);
      const dupOtherTerm = await expectError(tx, () =>
        tx.studentSubject.create({ data: { studentId: s2.id, subjectId: subjB.id, academicYear: '2027-2028', semester: '2nd Semester' } })
      );
      assert(dupOtherTerm?.startsWith('P2002'), 'Same student + subject in a different term is still rejected (one row per student per subject)', `(got: ${short(dupOtherTerm)})`);

      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }

  console.log('\n9. Nothing persisted');
  const after = await counts();
  assert(after.student_subjects === before.student_subjects && after.subjects === before.subjects,
    `Counts unchanged (${after.student_subjects} student_subjects rows, ${after.subjects} subjects)`);

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('❌ Test run aborted:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
