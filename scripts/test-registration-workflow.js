/**
 * COMPREHENSIVE AUTOMATED VERIFICATION SUITE
 * SRVS User Registration and Approval Workflow (Section 24 Requirements)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

let testPassCount = 0;
let testFailCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${message}`);
    testPassCount++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${message}`);
    testFailCount++;
  }
}

async function loginUser(idNumber, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idNumber, password }),
  });
  const data = await res.json();
  const cookieHeader = res.headers.get('set-cookie');
  let tokenCookie = '';
  if (cookieHeader) {
    const match = cookieHeader.match(/srvs_token=[^;]+/);
    if (match) tokenCookie = match[0];
  }
  return { status: res.status, data, cookie: tokenCookie };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('  SRVS USER REGISTRATION & APPROVAL WORKFLOW VERIFICATION (SEC 24)');
  console.log('================================================================\n');

  // Pre-cleanup of any prior test artifacts
  const testStudentId = 2026999001;
  const testStudentId2 = 2026999002;
  const testFacultyId = 99001;
  const testAdminId = 99002;
  const testDeptHeadId = 99003;

  await prisma.user.deleteMany({
    where: {
      id: { in: [testStudentId, testStudentId2, testFacultyId, testAdminId, testDeptHeadId] },
    },
  });

  // Log in as System Admin (id: 0, password: admin123)
  const adminLogin = await loginUser('0', 'admin123');
  assert(adminLogin.status === 200, 'Admin can log in successfully');

  // 1. ADMIN USER CREATION RESTRICTIONS
  console.log('\n--- 1. ADMIN USER CREATION RESTRICTIONS ---');

  // Admin can create Admin account
  const createAdminRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({
      idNumber: testAdminId,
      email: 'test.admin99@usjr.edu.ph',
      fullName: 'SecAdmin Tester',
      role: 'Admin',
      password: 'AdminPassword123!',
    }),
  });
  assert(createAdminRes.status === 201, 'Admin can create Admin accounts (201 Created)');

  // Admin can create Department Head account with department assignment
  const createDeptHeadRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({
      idNumber: testDeptHeadId,
      email: 'test.depthead99@usjr.edu.ph',
      fullName: 'Dr. Test CPE Chair',
      role: 'DepartmentHead',
      departmentId: 'CPE',
      password: 'DeptHeadPassword123!',
    }),
  });
  assert(createDeptHeadRes.status === 201, 'Admin can create Department Head accounts with department assignment');

  // Admin CANNOT directly create Student accounts
  const createStudentByAdmin = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({
      idNumber: testStudentId,
      email: 'bad.student@usjr.edu.ph',
      fullName: 'Manual Admin Student',
      role: 'Student',
      departmentId: 'CPE',
      password: 'Password123!',
    }),
  });
  assert(
    createStudentByAdmin.status === 403,
    `Admin cannot directly create Student accounts (Blocked with 403 Forbidden: ${(await createStudentByAdmin.json()).error})`
  );

  // Admin CANNOT directly create Faculty accounts
  const createFacultyByAdmin = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({
      idNumber: testFacultyId,
      email: 'bad.faculty@usjr.edu.ph',
      fullName: 'Manual Admin Faculty',
      role: 'Educator',
      departmentId: 'CPE',
      password: 'Password123!',
    }),
  });
  assert(
    createFacultyByAdmin.status === 403,
    `Admin cannot directly create Faculty accounts (Blocked with 403 Forbidden: ${(await createFacultyByAdmin.json()).error})`
  );

  // 2. STUDENT & FACULTY SELF-REGISTRATION
  console.log('\n--- 2. STUDENT & FACULTY SELF-REGISTRATION ---');

  // Student self-registers via POST /api/auth/register/student
  const studentRegRes = await fetch(`${BASE_URL}/api/auth/register/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: testStudentId,
      fullName: 'Juan Dela Cruz',
      email: 'juan.delacruz99@usjr.edu.ph',
      password: 'StudentSecure123!',
      departmentId: 'CPE',
      program: 'BS Computer Engineering',
    }),
  });
  const studentRegData = await studentRegRes.json();
  assert(studentRegRes.status === 201, 'Student can self-register via POST /api/auth/register/student');
  assert(studentRegData.user?.accountStatus === 'PendingApproval', 'Student account is saved with PendingApproval status');
  assert(studentRegData.user?.departmentId === 'CPE', 'Student department is saved correctly as CPE');

  // Second Student for rejection test
  const student2RegRes = await fetch(`${BASE_URL}/api/auth/register/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: testStudentId2,
      fullName: 'Pedro Penduko',
      email: 'pedro.penduko99@usjr.edu.ph',
      password: 'StudentSecure123!',
      departmentId: 'CPE',
      program: 'BS Computer Engineering',
    }),
  });
  assert(student2RegRes.status === 201, 'Second student self-registers successfully');

  // Faculty self-registers via POST /api/auth/register/faculty
  const facultyRegRes = await fetch(`${BASE_URL}/api/auth/register/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber: testFacultyId,
      fullName: 'Engr. Ralph Lima',
      email: 'ralph.lima99@usjr.edu.ph',
      password: 'FacultySecure123!',
      departmentId: 'CPE',
      academicRank: 'Assistant Professor',
    }),
  });
  const facultyRegData = await facultyRegRes.json();
  assert(facultyRegRes.status === 201, 'Faculty can self-register via POST /api/auth/register/faculty');
  assert(facultyRegData.user?.accountStatus === 'PendingApproval', 'Faculty account is saved with PendingApproval status');
  assert(facultyRegData.user?.departmentId === 'CPE', 'Faculty department is saved correctly as CPE');

  // 3. LOGIN RESTRICTIONS FOR PENDING ACCOUNTS
  console.log('\n--- 3. LOGIN RESTRICTIONS FOR PENDING ACCOUNTS ---');

  const pendingStudentLogin = await loginUser(testStudentId, 'StudentSecure123!');
  assert(pendingStudentLogin.status === 403, 'Pending Student cannot log in (403 Forbidden)');
  assert(
    pendingStudentLogin.data.error.includes('pending approval from your Department Head'),
    `Student receives pending approval message: "${pendingStudentLogin.data.error}"`
  );

  const pendingFacultyLogin = await loginUser(testFacultyId, 'FacultySecure123!');
  assert(pendingFacultyLogin.status === 403, 'Pending Faculty cannot log in (403 Forbidden)');
  assert(
    pendingFacultyLogin.data.error.includes('pending approval from your Department Head'),
    `Faculty receives pending approval message: "${pendingFacultyLogin.data.error}"`
  );

  // 4. DEPARTMENT HEAD DASHBOARD QUERY & STRICT DEPARTMENT ISOLATION
  console.log('\n--- 4. DEPARTMENT HEAD DASHBOARD QUERY & STRICT DEPARTMENT ISOLATION ---');

  // Log in as CPE Department Head (id: 10001, password: admin123)
  const cpeDeptHeadLogin = await loginUser('10001', 'admin123');
  assert(cpeDeptHeadLogin.status === 200, 'CPE Department Head logs in successfully');

  // Log in as CE Department Head (id: 10003, password: admin123)
  const ceDeptHeadLogin = await loginUser('10003', 'admin123');
  assert(ceDeptHeadLogin.status === 200, 'CE Department Head logs in successfully');

  // CPE Department Head calls GET /api/department-head/pending-users
  const cpePendingRes = await fetch(`${BASE_URL}/api/department-head/pending-users`, {
    headers: { Cookie: cpeDeptHeadLogin.cookie },
  });
  const cpePendingData = await cpePendingRes.json();
  assert(cpePendingRes.status === 200, 'CPE Department Head can query GET /api/department-head/pending-users');
  assert(Array.isArray(cpePendingData), 'Endpoint returns an array of pending users by default');

  const cpeHasStudent = cpePendingData.some((u) => u.id === testStudentId);
  const cpeHasFaculty = cpePendingData.some((u) => u.id === testFacultyId);
  assert(cpeHasStudent, 'CPE Department Head sees newly registered CPE Student automatically');
  assert(cpeHasFaculty, 'CPE Department Head sees newly registered CPE Faculty automatically');

  // CE Department Head calls GET /api/department-head/pending-users (Isolation test!)
  const cePendingRes = await fetch(`${BASE_URL}/api/department-head/pending-users`, {
    headers: { Cookie: ceDeptHeadLogin.cookie },
  });
  const cePendingData = await cePendingRes.json();
  const ceHasCpeStudent = cePendingData.some((u) => u.id === testStudentId);
  const ceHasCpeFaculty = cePendingData.some((u) => u.id === testFacultyId);
  assert(!ceHasCpeStudent, 'CE Department Head CANNOT see CPE Student registration (Strict isolation enforced)');
  assert(!ceHasCpeFaculty, 'CE Department Head CANNOT see CPE Faculty registration (Strict isolation enforced)');

  // 5. CROSS-DEPARTMENT APPROVAL & REJECTION PROTECTION
  console.log('\n--- 5. CROSS-DEPARTMENT PROTECTION ---');

  // CE Department Head attempts to approve CPE Student -> MUST FAIL with 403
  const crossApproveRes = await fetch(`${BASE_URL}/api/department-head/users/${testStudentId}/approve`, {
    method: 'POST',
    headers: { Cookie: ceDeptHeadLogin.cookie },
  });
  assert(crossApproveRes.status === 403, 'Cross-department approval is BLOCKED with 403 Forbidden');

  // CE Department Head attempts to reject CPE Student -> MUST FAIL with 403
  const crossRejectRes = await fetch(`${BASE_URL}/api/department-head/users/${testStudentId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ceDeptHeadLogin.cookie },
    body: JSON.stringify({ reason: 'Malicious cross-dept attempt' }),
  });
  assert(crossRejectRes.status === 403, 'Cross-department rejection is BLOCKED with 403 Forbidden');

  // 6. REJECTION WORKFLOW & REJECTION REASON DISPLAY
  console.log('\n--- 6. REJECTION WORKFLOW ---');

  // CPE Department Head rejects Student 2
  const rejectRes = await fetch(`${BASE_URL}/api/department-head/users/${testStudentId2}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cpeDeptHeadLogin.cookie },
    body: JSON.stringify({ reason: 'Student ID not in official departmental enrollment list.' }),
  });
  const rejectData = await rejectRes.json();
  assert(rejectRes.status === 200, 'CPE Department Head can reject Student registration with reason');
  assert(rejectData.user?.accountStatus === 'Rejected', 'Student status updated to Rejected');

  // Rejected student attempts login
  const rejectedStudentLogin = await loginUser(testStudentId2, 'StudentSecure123!');
  assert(rejectedStudentLogin.status === 403, 'Rejected student cannot log in (403 Forbidden)');
  assert(
    rejectedStudentLogin.data.error.includes('Student ID not in official departmental enrollment list'),
    `Rejected student error shows rejection reason: "${rejectedStudentLogin.data.error}"`
  );

  // 7. APPROVAL WORKFLOW FOR FACULTY & STUDENT
  console.log('\n--- 7. APPROVAL WORKFLOW ---');

  // CPE Department Head approves Faculty
  const approveFacultyRes = await fetch(`${BASE_URL}/api/department-head/users/${testFacultyId}/approve`, {
    method: 'POST',
    headers: { Cookie: cpeDeptHeadLogin.cookie },
  });
  const approveFacultyData = await approveFacultyRes.json();
  assert(approveFacultyRes.status === 200, 'CPE Department Head approves Faculty registration');
  assert(approveFacultyData.user?.accountStatus === 'Active', 'Faculty accountStatus becomes Active');

  // Approved Faculty can now log in normally!
  const approvedFacultyLogin = await loginUser(testFacultyId, 'FacultySecure123!');
  assert(approvedFacultyLogin.status === 200, 'Approved Faculty can log in normally (200 OK)');
  assert(approvedFacultyLogin.data.user?.role === 'Educator', 'Approved Faculty session profile has Educator/Faculty role');

  // CPE Department Head approves Student
  const approveStudentRes = await fetch(`${BASE_URL}/api/department-head/users/${testStudentId}/approve`, {
    method: 'POST',
    headers: { Cookie: cpeDeptHeadLogin.cookie },
  });
  const approveStudentData = await approveStudentRes.json();
  assert(approveStudentRes.status === 200, 'CPE Department Head approves Student registration');
  assert(approveStudentData.user?.accountStatus === 'Active', 'Student accountStatus becomes Active');

  // Approved Student can now log in normally!
  const approvedStudentLogin = await loginUser(testStudentId, 'StudentSecure123!');
  assert(approvedStudentLogin.status === 200, 'Approved Student can log in normally (200 OK)');
  assert(approvedStudentLogin.data.user?.role === 'Student', 'Approved Student session profile has Student role');

  // 8. AUDIT LOG VERIFICATION
  console.log('\n--- 8. AUDIT LOG VERIFICATION ---');

  const recentLogs = await prisma.auditLog.findMany({
    where: {
      actionType: {
        in: [
          'StudentRegistered',
          'FacultyRegistered',
          'StudentApproved',
          'StudentRejected',
          'FacultyApproved',
          'FacultyRejected',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  const loggedActions = new Set(recentLogs.map((l) => l.actionType));
  console.log('  Recorded Audit Log Actions:', Array.from(loggedActions));

  assert(loggedActions.has('StudentRegistered'), 'Audit log records StudentRegistered');
  assert(loggedActions.has('FacultyRegistered'), 'Audit log records FacultyRegistered');
  assert(loggedActions.has('StudentApproved'), 'Audit log records StudentApproved');
  assert(loggedActions.has('StudentRejected'), 'Audit log records StudentRejected');
  assert(loggedActions.has('FacultyApproved'), 'Audit log records FacultyApproved');

  // Post-test cleanup
  await prisma.user.deleteMany({
    where: {
      id: { in: [testStudentId, testStudentId2, testFacultyId, testAdminId, testDeptHeadId] },
    },
  });

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${testPassCount} PASSED, ${testFailCount} FAILED`);
  console.log('================================================================\n');

  if (testFailCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
