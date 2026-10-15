const { PrismaClient } = require('@prisma/client');
const { SignJWT } = require('jose');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'srvs-default-super-secret-key-2026';
const key = new TextEncoder().encode(JWT_SECRET);

async function signToken(payload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('================================================================');
  console.log('  SRVS DEPARTMENT HEAD ADMINISTRATOR END-TO-END VERIFICATION  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      if (detail) console.error('         Detail:', detail);
      failed++;
    }
  }

  // Generate tokens for testing
  // 1. Admin (id 0)
  const adminToken = await signToken({
    id: '0',
    idNumber: '0',
    email: 'admin@usjr.edu.ph',
    fullName: 'System Administrator',
    role: 'Admin',
    departmentId: null,
  });

  // 2. CPE Department Head (id 10001)
  const cpeDeptHeadToken = await signToken({
    id: '10001',
    idNumber: '10001',
    email: 'cpe.head@usjr.edu.ph',
    fullName: 'Engr. CPE Chairperson',
    role: 'DepartmentHead',
    departmentId: 'CPE',
    departmentCode: 'CPE',
  });

  // 3. CE Department Head (id 10002)
  const ceDeptHeadToken = await signToken({
    id: '10002',
    idNumber: '10002',
    email: 'ce.head@usjr.edu.ph',
    fullName: 'Engr. CE Chairperson',
    role: 'DepartmentHead',
    departmentId: 'CE',
    departmentCode: 'CE',
  });

  // Clean up any leftovers from previous test runs
  const testIds = [10091, 10092, 2026019901, 2026099991, 2026099992];
  await prisma.user.deleteMany({ where: { id: { in: testIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: testIds.map(String) } } });

  // --------------------------------------------------------------------------
  console.log('\n--- 1. DEPARTMENT HEAD CREATING FACULTY ---');
  // --------------------------------------------------------------------------
  // A. CPE Dept Head creates CPE Faculty (PASS)
  const createCpeFacRes = await fetch(`${BASE_URL}/api/department-head/faculty`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      idNumber: 10091,
      fullName: 'Prof. Test CPE Faculty',
      email: 'test.cpe.faculty@usjr.edu.ph',
      academicRank: 'Assistant Professor',
    }),
  });
  const createCpeFacData = await createCpeFacRes.json();
  assert(
    createCpeFacRes.status === 201 &&
    createCpeFacData.user?.departmentId === 'CPE' &&
    createCpeFacData.user?.mustChangePassword === true,
    'CPE Dept Head can create CPE Faculty with mustChangePassword = true',
    createCpeFacData
  );

  // B. CPE Dept Head tries to create CE Faculty (FAIL - 403 Forbidden)
  const createCrossFacRes = await fetch(`${BASE_URL}/api/department-head/faculty`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      idNumber: 10092,
      fullName: 'Prof. Cross Dept Faculty',
      email: 'test.cross.faculty@usjr.edu.ph',
      departmentId: 'CE',
    }),
  });
  const createCrossFacData = await createCrossFacRes.json();
  assert(
    createCrossFacRes.status === 403,
    'CPE Dept Head is BLOCKED (403) from creating faculty under CE',
    createCrossFacData
  );

  // C. CPE Dept Head tries to create Admin (FAIL - 403)
  const createAdminByDeptHead = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      idNumber: 10099,
      fullName: 'Illegal Admin',
      email: 'illegal.admin@usjr.edu.ph',
      role: 'Admin',
      password: 'Password123!',
    }),
  });
  assert(
    createAdminByDeptHead.status === 403,
    'CPE Dept Head is BLOCKED (403) from creating Admin accounts'
  );

  // --------------------------------------------------------------------------
  console.log('\n--- 2. DEPARTMENT HEAD CREATING STUDENTS ---');
  // --------------------------------------------------------------------------
  // A. CPE Dept Head creates CPE Student (PASS)
  const createCpeStuRes = await fetch(`${BASE_URL}/api/department-head/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      idNumber: '2026019901',
      fullName: 'Test CPE Student',
      email: 'test.cpe.student@usjr.edu.ph',
      yearLevel: '1st Year',
      program: 'BS Computer Engineering',
    }),
  });
  const createCpeStuData = await createCpeStuRes.json();
  assert(
    createCpeStuRes.status === 201 &&
    createCpeStuData.user?.departmentId === 'CPE' &&
    createCpeStuData.user?.mustChangePassword === true,
    'CPE Dept Head can create CPE Student with mustChangePassword = true',
    createCpeStuData
  );

  // B. CPE Dept Head tries to create CE Student (FAIL - 403)
  const createCrossStuRes = await fetch(`${BASE_URL}/api/department-head/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      idNumber: '2026019902',
      fullName: 'Cross Dept Student',
      email: 'test.cross.student@usjr.edu.ph',
      departmentId: 'CE',
    }),
  });
  assert(
    createCrossStuRes.status === 403,
    'CPE Dept Head is BLOCKED (403) from creating student under CE'
  );

  // --------------------------------------------------------------------------
  console.log('\n--- 3. DEPARTMENT USER DIRECTORY & ACTIVATION ---');
  // --------------------------------------------------------------------------
  // A. CPE Dept Head queries faculty -> returns only CPE faculty
  const getCpeFacRes = await fetch(`${BASE_URL}/api/department-head/faculty`, {
    headers: { Authorization: `Bearer ${cpeDeptHeadToken}` },
  });
  const getCpeFacData = await getCpeFacRes.json();
  const allCpeFac = getCpeFacData.faculty?.every((f) => f.departmentId === 'CPE');
  assert(
    getCpeFacRes.status === 200 && allCpeFac && getCpeFacData.faculty?.length > 0,
    'GET /api/department-head/faculty returns strictly CPE faculty members',
    { count: getCpeFacData.faculty?.length }
  );

  // B. Deactivate Faculty member (PASS)
  const deactFacRes = await fetch(`${BASE_URL}/api/department-head/faculty/10091`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({ accountStatus: 'Deactivated' }),
  });
  const deactFacData = await deactFacRes.json();
  assert(
    deactFacRes.status === 200 && deactFacData.user?.accountStatus === 'Deactivated',
    'CPE Dept Head can deactivate CPE faculty member',
    deactFacData
  );

  // C. Reactivate Faculty member (PASS)
  const reactFacRes = await fetch(`${BASE_URL}/api/department-head/faculty/10091`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({ accountStatus: 'Active' }),
  });
  const reactFacData = await reactFacRes.json();
  assert(
    reactFacRes.status === 200 && reactFacData.user?.accountStatus === 'Active',
    'CPE Dept Head can reactivate CPE faculty member',
    reactFacData
  );

  // --------------------------------------------------------------------------
  console.log('\n--- 4. STUDENT SELF-REGISTRATION & APPROVAL WORKFLOW ---');
  // --------------------------------------------------------------------------
  // A. Student self-registers under CPE
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: '2026099991',
      firstName: 'Applicant',
      lastName: 'Student',
      email: 'applicant.student@usjr.edu.ph',
      departmentId: 'CPE',
      password: 'Password123!',
      program: 'BS Computer Engineering',
    }),
  });
  const regData = await regRes.json();
  assert(
    regRes.status === 201 && regData.user?.accountStatus === 'PendingApproval',
    'Student self-registers with PendingApproval status',
    regData
  );

  // B. Student attempts to log in before approval (FAIL - 403)
  const loginBeforeApproval = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: '2026099991',
      password: 'Password123!',
    }),
  });
  const loginBeforeApprovalData = await loginBeforeApproval.json();
  assert(
    loginBeforeApproval.status === 403 &&
    loginBeforeApprovalData.error?.includes('pending approval'),
    'Student CANNOT log in while accountStatus is PendingApproval',
    loginBeforeApprovalData
  );

  // C. CE Dept Head checks registration requests -> does NOT see CPE student!
  const ceRegRes = await fetch(`${BASE_URL}/api/department-head/student-registrations`, {
    headers: { Authorization: `Bearer ${ceDeptHeadToken}` },
  });
  const ceRegData = await ceRegRes.json();
  const ceSeesCpeStudent = ceRegData.registrations?.some((r) => r.id === 2026099991);
  assert(
    !ceSeesCpeStudent,
    'CE Dept Head CANNOT see CPE student registration requests (Strict isolation)'
  );

  // D. CPE Dept Head checks registration requests -> SEES the CPE student!
  const cpeRegRes = await fetch(`${BASE_URL}/api/department-head/student-registrations`, {
    headers: { Authorization: `Bearer ${cpeDeptHeadToken}` },
  });
  const cpeRegData = await cpeRegRes.json();
  const cpeSeesStudent = cpeRegData.registrations?.some((r) => r.id === 2026099991);
  assert(
    cpeSeesStudent,
    'CPE Dept Head SEES CPE student registration request'
  );

  // E. CE Dept Head tries to approve CPE student -> BLOCKED (403)
  const ceTryApprove = await fetch(`${BASE_URL}/api/department-head/student-registrations/2026099991/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ceDeptHeadToken}` },
  });
  assert(
    ceTryApprove.status === 403,
    'CE Dept Head is BLOCKED (403) from approving CPE student registration'
  );

  // F. CPE Dept Head rejects CPE student with reason
  const cpeReject = await fetch(`${BASE_URL}/api/department-head/student-registrations/2026099991/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cpeDeptHeadToken}`,
    },
    body: JSON.stringify({
      reason: 'ID does not match official enrollment list. Please report to the CPE Department Office.',
    }),
  });
  const cpeRejectData = await cpeReject.json();
  assert(
    cpeReject.status === 200 && cpeRejectData.student?.accountStatus === 'Rejected',
    'CPE Dept Head can reject registration with reason',
    cpeRejectData
  );

  // G. Student attempts to log in after rejection -> BLOCKED with rejection reason displayed
  const loginAfterReject = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: '2026099991',
      password: 'Password123!',
    }),
  });
  const loginAfterRejectData = await loginAfterReject.json();
  assert(
    loginAfterReject.status === 403 &&
    loginAfterRejectData.error?.includes('ID does not match official enrollment list'),
    'Student login error displays rejection reason to student',
    loginAfterRejectData
  );

  // H. CPE Dept Head approves student
  const cpeApprove = await fetch(`${BASE_URL}/api/department-head/student-registrations/2026099991/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cpeDeptHeadToken}` },
  });
  const cpeApproveData = await cpeApprove.json();
  assert(
    cpeApprove.status === 200 && cpeApproveData.student?.accountStatus === 'Active',
    'CPE Dept Head approves student (PendingApproval -> Active)',
    cpeApproveData
  );

  // I. Student logs in after approval -> SUCCESS (200)
  const loginAfterApproval = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: '2026099991',
      password: 'Password123!',
    }),
  });
  const loginAfterApprovalData = await loginAfterApproval.json();
  assert(
    loginAfterApproval.status === 200 && loginAfterApprovalData.user?.role === 'Student',
    'Student CAN log in successfully after Department Head approval',
    loginAfterApprovalData
  );

  // --------------------------------------------------------------------------
  console.log('\n--- 5. COURSE & FACULTY ASSIGNMENT CHECKS ---');
  // --------------------------------------------------------------------------
  // A. CPE Dept Head updates CPE course and assigns faculty (PASS)
  const cpeCourse = await prisma.course.findFirst({ where: { departmentId: 'CPE' } });
  if (cpeCourse) {
    const updateCourseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cpeDeptHeadToken}`,
      },
      body: JSON.stringify({
        id: cpeCourse.id,
        professorName: 'Engr. Assigned CPE Faculty',
      }),
    });
    const updateCourseData = await updateCourseRes.json();
    assert(
      updateCourseRes.status === 200 && updateCourseData.course?.professorName === 'Engr. Assigned CPE Faculty',
      `CPE Dept Head can manage courses and assign faculty to CPE course [${cpeCourse.code}]`,
      updateCourseData
    );
  }

  // B. CPE Dept Head tries to modify CE course (FAIL - 403)
  const ceCourse = await prisma.course.findFirst({ where: { departmentId: 'CE' } });
  if (ceCourse) {
    const updateCrossCourseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cpeDeptHeadToken}`,
      },
      body: JSON.stringify({
        id: ceCourse.id,
        professorName: 'Hacker Faculty',
      }),
    });
    assert(
      updateCrossCourseRes.status === 403,
      `CPE Dept Head is BLOCKED (403) from modifying CE course [${ceCourse.code}]`
    );
  }

  // --------------------------------------------------------------------------
  console.log('\n--- 6. AUDIT LOG VERIFICATION ---');
  // --------------------------------------------------------------------------
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      actionType: {
        in: [
          'FacultyCreated',
          'StudentCreated',
          'StudentRegistrationApproved',
          'StudentRegistrationRejected',
          'FacultyDeactivated',
          'FacultyActivated',
          'FacultyAssigned',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const actionsFound = auditLogs.map((l) => l.actionType);
  console.log('  Recent Department Head Audit Actions Recorded:');
  actionsFound.forEach((a) => console.log(`    - ${a}`));

  assert(actionsFound.includes('FacultyCreated'), 'Audit log includes FacultyCreated');
  assert(actionsFound.includes('StudentCreated'), 'Audit log includes StudentCreated');
  assert(actionsFound.includes('StudentRegistrationApproved'), 'Audit log includes StudentRegistrationApproved');
  assert(actionsFound.includes('StudentRegistrationRejected'), 'Audit log includes StudentRegistrationRejected');

  // Clean up test records
  await prisma.user.deleteMany({ where: { id: { in: testIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: testIds.map(String) } } });

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
