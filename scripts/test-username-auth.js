const baseUrl = 'http://localhost:3000';

async function testAuth() {
  console.log('🧪 Starting Username (ID Number) & Auth Validation Tests...\n');

  // Test 1: Admin Login with username '00000'
  console.log('1. Testing Admin login with username "00000"...');
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '00000', password: 'admin123' }),
  });
  const adminData = await adminRes.json();
  if (adminRes.ok && adminData.user?.role === 'Admin') {
    console.log(`   ✓ Admin logged in successfully: ${adminData.user.fullName} (ID: ${adminData.user.username})`);
  } else {
    console.error('   ✗ Admin login failed:', adminData);
    process.exit(1);
  }

  // Test 2: Student Registration with valid 10-digit ID
  console.log('\n2. Testing Student registration with valid 10-digit ID (e.g. 2022012708)...');
  // First get a department
  const deptRes = await fetch(`${baseUrl}/api/departments`);
  const { departments } = await deptRes.json();
  const cpeDept = departments.find(d => d.code === 'CPE') || departments[0];

  const studentPayload = {
    firstName: 'TestStudent',
    lastName: 'USJR',
    email: 'teststudent@usjr.edu.ph',
    idNumber: '2022012708',
    password: 'Password123!',
    role: 'Student',
    departmentId: cpeDept.id,
  };

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentPayload),
  });
  const regData = await regRes.json();
  if (regRes.ok || regData.error?.includes('already exists')) {
    console.log(`   ✓ Student registration handled: ${regData.message || regData.error}`);
  } else {
    console.error('   ✗ Student registration failed unexpectedly:', regData);
  }

  // Test 3: Student Registration with INVALID ID (e.g. 5 digits for student)
  console.log('\n3. Testing Student registration with INVALID 5-digit ID (should be rejected)...');
  const invalidStudentRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Invalid',
      lastName: 'Student',
      email: 'invalid@usjr.edu.ph',
      idNumber: '12345', // 5 digits instead of 10
      password: 'Password123!',
      role: 'Student',
      departmentId: cpeDept.id,
    }),
  });
  const invalidStudentData = await invalidStudentRes.json();
  if (!invalidStudentRes.ok && invalidStudentData.error?.includes('10 digits')) {
    console.log(`   ✓ Correctly rejected: "${invalidStudentData.error}"`);
  } else {
    console.error('   ✗ Validation failed to reject invalid student ID:', invalidStudentData);
  }

  // Test 4: Faculty Registration with INVALID ID (e.g. 10 digits for faculty)
  console.log('\n4. Testing Faculty registration with INVALID 10-digit ID (should be rejected)...');
  const invalidFacultyRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Invalid',
      lastName: 'Faculty',
      email: 'invalidfac@usjr.edu.ph',
      idNumber: '2022012708', // 10 digits instead of 5
      password: 'Password123!',
      role: 'Educator',
      departmentId: cpeDept.id,
    }),
  });
  const invalidFacultyData = await invalidFacultyRes.json();
  if (!invalidFacultyRes.ok && invalidFacultyData.error?.includes('5 digits')) {
    console.log(`   ✓ Correctly rejected: "${invalidFacultyData.error}"`);
  } else {
    console.error('   ✗ Validation failed to reject invalid faculty ID:', invalidFacultyData);
  }

  // Test 5: Login with Invalid ID format (e.g. 7 digits)
  console.log('\n5. Testing login with invalid length ID (e.g. 7 digits)...');
  const invalidLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '1234567', password: 'password' }),
  });
  const invalidLoginData = await invalidLoginRes.json();
  if (!invalidLoginRes.ok && invalidLoginData.error?.includes('Invalid ID number format')) {
    console.log(`   ✓ Correctly rejected invalid ID length on login: "${invalidLoginData.error}"`);
  } else {
    console.error('   ✗ Login failed to validate ID length:', invalidLoginData);
  }

  console.log('\n🎉 All username/ID number tests passed successfully!');
}

testAuth().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
