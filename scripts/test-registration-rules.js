const baseUrl = 'http://localhost:3000';

async function post(path, body, cookie) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { res, data };
}

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) { passed++; console.log(`   ✓ PASS: ${label}`); }
  else { failed++; console.error(`   ✗ FAIL: ${label}`, detail ?? ''); }
}

async function main() {
  console.log('====================================================');
  console.log('   REGISTRATION RULES: STUDENTS ONLY                ');
  console.log('====================================================\n');

  const base = { firstName: 'Test', lastName: 'User', password: 'Password123!', departmentId: 'CPE' };

  for (const role of ['Admin', 'DepartmentHead', 'Educator']) {
    console.log(`Self-register as "${role}" (expect 403)...`);
    const { res, data } = await post('/api/auth/register', { ...base, role, idNumber: '99991', email: `selfreg-${role.toLowerCase()}@usjr.edu.ph` });
    check(`${role} self-registration rejected`, res.status === 403, { status: res.status, data });
  }

  console.log('\nStudent with 5-digit ID (expect 400)...');
  {
    const { res, data } = await post('/api/auth/register', { ...base, role: 'Student', idNumber: '12345', email: 'badstud@usjr.edu.ph' });
    check('Student 5-digit ID rejected', res.status === 400 && /10 digits/.test(data.error || ''), { status: res.status, data });
  }

  const testStudentId = 2099000001;
  console.log('\nValid Student registration (expect 201, PendingApproval)...');
  {
    const { res, data } = await post('/api/auth/register', { ...base, idNumber: String(testStudentId), email: 'regrule-student@usjr.edu.ph' });
    check('Student registered as PendingApproval', res.status === 201 && data.user?.role === 'Student' && data.user?.accountStatus === 'PendingApproval', { status: res.status, data });
  }

  console.log('\nAdmin creates Educator / DepartmentHead / Admin via POST /api/users (expect 201)...');
  const login = await post('/api/auth/login', { idNumber: 0, password: 'admin123' });
  const cookie = login.res.headers.get('set-cookie');
  check('Admin login', !!cookie, login.data);

  const staff = [
    { idNumber: 98761, role: 'Educator', email: 'regrule-educator@usjr.edu.ph', fullName: 'Test Educator', departmentId: 'CPE' },
    { idNumber: 98762, role: 'DepartmentHead', email: 'regrule-head@usjr.edu.ph', fullName: 'Test Head', departmentId: 'ME' },
    { idNumber: 98763, role: 'Admin', email: 'regrule-admin@usjr.edu.ph', fullName: 'Test Admin' },
  ];
  if (cookie) {
    for (const s of staff) {
      const { res, data } = await post('/api/users', { ...s, password: 'Password123!' }, cookie);
      check(`Admin created ${s.role}`, res.status === 201, { status: res.status, data });
    }
  }

  console.log('\nCleaning up test records...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ids = [testStudentId, ...staff.map((s) => s.idNumber)];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids.map(String) } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  console.log('   ✓ Test users removed.');

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
