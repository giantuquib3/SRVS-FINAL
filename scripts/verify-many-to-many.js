const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  VERIFYING SRVS MANY-TO-MANY RELATIONSHIP & NO-DUPLICATE COURSE RULE   ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  // ─── 0. VERIFY SCHEMA CONSTRAINTS & DATA INTEGRITY ─────────────────────────
  console.log('--- Step 0: Checking Database Primary Key & Existing Data ---');
  const existingCount = await prisma.enrollment.count();
  assert(existingCount === 18, 'All 18 pre-existing enrollments remain intact', `Count is ${existingCount}`);

  const pkConstraint = await prisma.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = 'public' AND cl.relname = 'enrollments' AND c.contype = 'p';
  `);
  console.log('Enrollments PK constraint:', pkConstraint[0]?.def);
  assert(
    pkConstraint[0]?.def.includes('PRIMARY KEY ("studentId", "courseId")'),
    'Database constraint is PRIMARY KEY (studentId, courseId)',
    pkConstraint[0]?.def
  );

  // Get test student accounts
  // Student A: 2026999001 (Juan Dela Cruz)
  // Student B: 2026999002 (Pedro Penduko)
  const studentA = await prisma.user.findUnique({ where: { id: 2026999001 } });
  const studentB = await prisma.user.findUnique({ where: { id: 2026999002 } });
  assert(studentA && studentB, 'Test students A and B exist');

  // Get test courses
  const testCourses = await prisma.course.findMany({
    where: { departmentId: 'CPE' },
    orderBy: { id: 'asc' },
    take: 3,
  });
  assert(testCourses.length >= 3, 'Found at least 3 courses for testing');
  const [progCourse, netCourse, mathCourse] = testCourses;
  console.log(`Course 1 (Programming): [${progCourse.code}] ${progCourse.title} (ID: ${progCourse.id})`);
  console.log(`Course 2 (Networking):  [${netCourse.code}] ${netCourse.title} (ID: ${netCourse.id})`);
  console.log(`Course 3 (Mathematics): [${mathCourse.code}] ${mathCourse.title} (ID: ${mathCourse.id})`);

  // Clean any test enrollments for Student A & B
  await prisma.enrollment.deleteMany({
    where: {
      studentId: { in: [studentA.id, studentB.id] },
    },
  });

  // ─── 1. MULTIPLE COURSES PER STUDENT ───────────────────────────────────────
  console.log('\n--- Step 1: Testing Multiple Courses per Student ---');
  // Student A enrolls in Programming -> Allowed
  const enrA1 = await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      studentName: studentA.fullName,
      courseId: progCourse.id,
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'A',
      status: 'ENROLLED',
    },
  });
  assert(enrA1 !== null, 'Expected Behavior: Student A enrolls in Programming -> Allowed');

  // Student A enrolls in Networking -> Allowed
  const enrA2 = await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      studentName: studentA.fullName,
      courseId: netCourse.id,
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'A',
      status: 'ENROLLED',
    },
  });
  assert(enrA2 !== null, 'Expected Behavior: Student A enrolls in Networking -> Allowed');

  // Student A enrolls in Mathematics -> Allowed
  const enrA3 = await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      studentName: studentA.fullName,
      courseId: mathCourse.id,
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'B',
      status: 'ENROLLED',
    },
  });
  assert(enrA3 !== null, 'Expected Behavior: Student A enrolls in Mathematics -> Allowed');

  const studentAEnrollments = await prisma.enrollment.findMany({
    where: { studentId: studentA.id },
  });
  assert(
    studentAEnrollments.length === 3,
    'Requirement 1: Student A is enrolled in 3 different courses without arbitrary limit',
    `Found ${studentAEnrollments.length} enrollments`
  );

  // ─── 2. MULTIPLE STUDENTS PER COURSE ───────────────────────────────────────
  console.log('\n--- Step 2: Testing Multiple Students per Course ---');
  // Student B enrolls in Programming -> Allowed
  const enrB1 = await prisma.enrollment.create({
    data: {
      studentId: studentB.id,
      studentName: studentB.fullName,
      courseId: progCourse.id,
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'A',
      status: 'ENROLLED',
    },
  });
  assert(enrB1 !== null, 'Expected Behavior: Student B enrolls in Programming -> Allowed');

  const progEnrollments = await prisma.enrollment.findMany({
    where: { courseId: progCourse.id },
  });
  const enrolledStudentIds = progEnrollments.map(e => e.studentId);
  assert(
    enrolledStudentIds.includes(studentA.id) && enrolledStudentIds.includes(studentB.id),
    'Requirement 2: Multiple students (A and B) enrolled in Programming without arbitrary limit',
    `Enrolled students: ${enrolledStudentIds.join(', ')}`
  );

  // ─── 3. NO DUPLICATE COURSES PER STUDENT ───────────────────────────────────
  console.log('\n--- Step 3: Testing No Duplicate Courses per Student ---');
  // Student A enrolls in Programming again in same term -> Rejected
  let dupSameTermRejected = false;
  try {
    await prisma.enrollment.create({
      data: {
        studentId: studentA.id,
        studentName: studentA.fullName,
        courseId: progCourse.id,
        semester: '1st Semester',
        academicYear: '2026-2027',
        section: 'A',
      },
    });
  } catch (err) {
    dupSameTermRejected = true;
    console.log('✓ Rejected by DB constraint (same term duplicate):', err.message.slice(0, 75) + '...');
  }
  assert(dupSameTermRejected, 'Expected Behavior: Student A enrolls in Programming again -> Rejected');

  // Student A attempts to enroll in Programming again in another semester or section or academic year -> Rejected
  let dupDiffTermRejected = false;
  try {
    await prisma.enrollment.create({
      data: {
        studentId: studentA.id,
        studentName: studentA.fullName,
        courseId: progCourse.id,
        semester: '2nd Semester',        // Different semester
        academicYear: '2027-2028',       // Different academic year
        section: 'Z',                    // Different section
      },
    });
  } catch (err) {
    dupDiffTermRejected = true;
    console.log('✓ Rejected by DB constraint (different semester/AY/section):', err.message.slice(0, 75) + '...');
  }
  assert(
    dupDiffTermRejected,
    'Expected Behavior: Student A attempts to enroll in Programming again in another semester/year/section -> Rejected'
  );

  // ─── CLEANUP TEST ROWS (Preserve 18 pre-existing seed records) ───────────────
  console.log('\n--- Cleaning up temporary test rows ---');
  await prisma.enrollment.deleteMany({
    where: {
      studentId: { in: [studentA.id, studentB.id] },
    },
  });

  const finalCount = await prisma.enrollment.count();
  assert(finalCount === 18, 'Final enrollment count matches exact pre-migration count (18 records)', `Count: ${finalCount}`);

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runTestSuite()
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
