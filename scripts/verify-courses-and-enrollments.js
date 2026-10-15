const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('  SRVS COURSES AND ENROLLMENTS COMPREHENSIVE VERIFICATION SUITE ');
  console.log('================================================================\n');

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

  // ─── 0. VERIFY SCHEMA CONSTRAINTS & EXISTING DATA INTACT ────────────────────
  console.log('--- Step 0: Inspecting Schema Constraints & Existing Data ---');
  const existingCount = await prisma.enrollment.count();
  assert(existingCount >= 18, '6. Existing enrollments remain intact after migration', `Count is ${existingCount}`);

  const pkConstraint = await prisma.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = 'public' AND cl.relname = 'enrollments' AND c.contype = 'p';
  `);
  console.log('Enrollments PK constraint:', pkConstraint[0]?.def);
  assert(
    pkConstraint[0]?.def.includes('"studentId"') &&
    pkConstraint[0]?.def.includes('"courseId"') &&
    pkConstraint[0]?.def.includes('semester') &&
    pkConstraint[0]?.def.includes('"academicYear"'),
    'Enrollments PK includes (studentId, courseId, semester, academicYear)',
    pkConstraint[0]?.def
  );

  // Setup test student and course IDs
  // We'll use 2026999001 (Juan Dela Cruz) and 2026999002 (Pedro Penduko)
  // And create a 3rd test student if needed: 2026999003
  let testStudent3 = await prisma.user.findUnique({ where: { id: 2026999003 } });
  if (!testStudent3) {
    testStudent3 = await prisma.user.create({
      data: {
        id: 2026999003,
        email: 'test.student3@usjr.edu.ph',
        fullName: 'Maria Clara',
        role: 'Student',
        departmentId: 'CPE',
        passwordHash: '$2a$10$0G4oW3f6eHwJpZqT6W5R1.l5s7H1yW1s4Xz9yOq1m7h2F9V4hVf6e',
        accountStatus: 'Active',
      },
    });
  }

  const s1 = 2026999001; // Juan Dela Cruz
  const s2 = 2026999002; // Pedro Penduko
  const s3 = 2026999003; // Maria Clara

  // Ensure test courses exist (CPE courses)
  const courses = await prisma.course.findMany({
    where: { departmentId: 'CPE' },
    orderBy: { id: 'asc' },
    take: 3,
  });
  assert(courses.length >= 3, 'Found at least 3 CPE test courses', `Found ${courses.length}`);
  const [c1, c2, c3] = courses;
  console.log(`Test Courses: C1=[${c1.code}] ID:${c1.id}, C2=[${c2.code}] ID:${c2.id}, C3=[${c3.code}] ID:${c3.id}`);

  // Clean any leftovers from previous test runs
  await prisma.enrollment.deleteMany({
    where: {
      studentId: { in: [s1, s2, s3] },
      academicYear: { in: ['2026-2027', '2027-2028', '2028-2029'] },
    },
  });

  // ─── 1. ONE STUDENT ENROLLS IN 3 DIFFERENT COURSES IN SAME SEMESTER ─────────
  console.log('\n--- Step 1: Testing 1 Student Enrolls in 3 Different Courses (Same Semester) ---');
  const testAY = '2026-2027';
  const testTerm = '1st Semester';

  const enr1_1 = await prisma.enrollment.create({
    data: {
      studentId: s1,
      studentName: 'Juan Dela Cruz',
      courseId: c1.id,
      semester: testTerm,
      academicYear: testAY,
      section: 'A',
      status: 'ENROLLED',
    },
  });

  const enr1_2 = await prisma.enrollment.create({
    data: {
      studentId: s1,
      studentName: 'Juan Dela Cruz',
      courseId: c2.id,
      semester: testTerm,
      academicYear: testAY,
      section: 'B',
      status: 'ENROLLED',
    },
  });

  const enr1_3 = await prisma.enrollment.create({
    data: {
      studentId: s1,
      studentName: 'Juan Dela Cruz',
      courseId: c3.id,
      semester: testTerm,
      academicYear: testAY,
      section: 'C',
      status: 'ENROLLED',
    },
  });

  const s1Enrollments = await prisma.enrollment.findMany({
    where: { studentId: s1, semester: testTerm, academicYear: testAY },
  });

  assert(
    s1Enrollments.length === 3,
    '1. One student can enroll in three different courses',
    `Found ${s1Enrollments.length} enrollments`
  );

  assert(
    s1Enrollments.some(e => e.courseId === c1.id) &&
    s1Enrollments.some(e => e.courseId === c2.id) &&
    s1Enrollments.some(e => e.courseId === c3.id),
    '3. A student can enroll in different courses during the same semester',
    `Course IDs: ${s1Enrollments.map(e => e.courseId).join(', ')}`
  );

  // ─── 2. THREE STUDENTS ENROLL IN THE SAME COURSE ────────────────────────────
  console.log('\n--- Step 2: Testing 3 Students Enroll in the Same Course ---');
  // c1 already has s1 enrolled. Now enroll s2 and s3 in c1
  const enr2_1 = await prisma.enrollment.create({
    data: {
      studentId: s2,
      studentName: 'Pedro Penduko',
      courseId: c1.id,
      semester: testTerm,
      academicYear: testAY,
      section: 'A',
      status: 'ENROLLED',
    },
  });

  const enr2_2 = await prisma.enrollment.create({
    data: {
      studentId: s3,
      studentName: 'Maria Clara',
      courseId: c1.id,
      semester: testTerm,
      academicYear: testAY,
      section: 'A',
      status: 'ENROLLED',
    },
  });

  const c1Enrollments = await prisma.enrollment.findMany({
    where: { courseId: c1.id, semester: testTerm, academicYear: testAY },
  });

  const enrolledStudentsInC1 = c1Enrollments.map(e => e.studentId);
  assert(
    enrolledStudentsInC1.includes(s1) &&
    enrolledStudentsInC1.includes(s2) &&
    enrolledStudentsInC1.includes(s3),
    '2. Three students can enroll in the same course during the same term',
    `Students enrolled in ${c1.code}: ${enrolledStudentsInC1.join(', ')}`
  );

  // ─── 3. SAME STUDENT ENROLLS IN SAME COURSE IN DIFFERENT ACADEMIC YEAR ──────
  console.log('\n--- Step 3: Testing Student Enrolls in Same Course in Different Academic Year ---');
  const nextAY = '2027-2028';
  const enrNextYear = await prisma.enrollment.create({
    data: {
      studentId: s1,
      studentName: 'Juan Dela Cruz',
      courseId: c1.id,
      semester: testTerm,
      academicYear: nextAY,
      section: 'A',
      status: 'ENROLLED',
    },
  });

  const s1C1AllEnrollments = await prisma.enrollment.findMany({
    where: { studentId: s1, courseId: c1.id },
  });

  assert(
    s1C1AllEnrollments.length >= 2 &&
    s1C1AllEnrollments.some(e => e.academicYear === testAY) &&
    s1C1AllEnrollments.some(e => e.academicYear === nextAY),
    '4. A student can enroll in the same course in a different academic year',
    `Academic years found: ${s1C1AllEnrollments.map(e => e.academicYear).join(', ')}`
  );

  // ─── 4. DUPLICATE ENROLLMENT IN SAME TERM REJECTED BY DATABASE CONSTRAINT ───
  console.log('\n--- Step 4: Testing Duplicate Enrollment Rejection ---');
  let duplicateCaught = false;
  try {
    await prisma.enrollment.create({
      data: {
        studentId: s1,
        studentName: 'Juan Dela Cruz',
        courseId: c1.id,
        semester: testTerm,
        academicYear: testAY,
        section: 'B',
        status: 'ENROLLED',
      },
    });
  } catch (err) {
    duplicateCaught = true;
    console.log('✓ Database constraint properly rejected duplicate enrollment:', err.message.slice(0, 80) + '...');
  }

  assert(
    duplicateCaught,
    '5. A duplicate enrollment for the same student, course, semester, and academic year is rejected by DB constraint',
    `Duplicate caught: ${duplicateCaught}`
  );

  // ─── 5. VERIFY DATA RETRIEVAL (NAMES, SECTIONS, STATUSES, PERIODS) ──────────
  console.log('\n--- Step 5: Testing Retrieval of Student Details & Enrollments ---');
  const detailedCourse = await prisma.course.findUnique({
    where: { id: c1.id },
    include: {
      enrollments: {
        where: { academicYear: testAY, semester: testTerm },
        include: {
          student: {
            select: { id: true, fullName: true, email: true, departmentId: true }
          }
        }
      }
    }
  });

  assert(
    detailedCourse.enrollments.length >= 3,
    'Course can retrieve its enrolled students with student relation',
    `Retrieved ${detailedCourse.enrollments.length} enrolled students`
  );

  const sampleEnr = detailedCourse.enrollments.find(e => e.studentId === s1);
  assert(
    sampleEnr &&
    sampleEnr.studentName === 'Juan Dela Cruz' &&
    sampleEnr.student?.fullName === 'Juan Dela Cruz' &&
    sampleEnr.section === 'A' &&
    sampleEnr.status === 'ENROLLED' &&
    sampleEnr.semester === testTerm &&
    sampleEnr.academicYear === testAY,
    '7. Student names, sections, statuses, and academic periods are retrieved correctly',
    JSON.stringify(sampleEnr)
  );

  // ─── 6. STUDENT ROLE VALIDATION CHECK ───────────────────────────────────────
  console.log('\n--- Step 6: Testing Role and Foreign Key Validation ---');
  // Attempt with non-student user ID (e.g. 0 is Admin)
  const adminUser = await prisma.user.findUnique({ where: { id: 0 } });
  assert(adminUser && adminUser.role === 'Admin', 'Admin user ID 0 exists with role Admin');

  // Verify that an unknown user ID fails FK constraint
  let fkErrorCaught = false;
  try {
    await prisma.enrollment.create({
      data: {
        studentId: 999999999, // Non-existent user ID
        studentName: 'Ghost Student',
        courseId: c1.id,
        semester: '1st Semester',
        academicYear: '2028-2029',
        section: 'A',
      }
    });
  } catch (e) {
    fkErrorCaught = true;
    console.log('✓ Foreign key constraint properly rejected non-existent studentId:', e.message.slice(0, 80) + '...');
  }
  assert(fkErrorCaught, 'Foreign key constraint enforces studentId must reference an existing users.id');

  // ─── CLEANUP TEST ROWS (Preserve pre-existing 18 seed records) ───────────────
  console.log('\n--- Cleaning up temporary test rows ---');
  await prisma.enrollment.deleteMany({
    where: {
      studentId: { in: [s1, s2, s3] },
      academicYear: { in: ['2026-2027', '2027-2028', '2028-2029'] },
    },
  });

  const finalCount = await prisma.enrollment.count();
  assert(finalCount === existingCount, 'Final enrollment count matches pre-migration count', `Expected ${existingCount}, got ${finalCount}`);

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests()
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
