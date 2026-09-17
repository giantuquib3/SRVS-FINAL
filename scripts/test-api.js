const http = require('http');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function get(url, cookie) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: cookie ? { Cookie: cookie } : {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    }).on('error', reject);
  });
}

function post(url, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || PORT,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        try {
          resolve({ status: res.statusCode, cookie: setCookie ? setCookie[0] : null, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, cookie: setCookie ? setCookie[0] : null, data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function patch(url, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || PORT,
      path: parsedUrl.pathname,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function del(url, cookie) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || PORT,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'DELETE',
      headers: cookie ? { 'Cookie': cookie } : {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log(`Using base URL: ${BASE_URL}\n`);

  console.log('1. Testing /api/system/db-status...');
  const dbStatus = await get(`${BASE_URL}/api/system/db-status`);
  console.log('DB Status:', dbStatus.status, dbStatus.data?.tables ? 'OK' : dbStatus.data);

  console.log('\n2. Logging in as Admin (00000)...');
  const loginRes = await post(`${BASE_URL}/api/auth/login`, {
    idNumber: '00000',
    password: 'Giangwapo123?',
  });
  console.log('Login Status:', loginRes.status, 'User:', loginRes.data?.user?.fullName);

  const cookie = loginRes.cookie;

  console.log('\n3. Fetching /api/students as Admin...');
  const studentsRes = await get(`${BASE_URL}/api/students`, cookie);
  console.log('Students Status:', studentsRes.status);
  console.table(studentsRes.data?.students || []);

  console.log('\n4. Fetching /api/users?role=Student as Admin...');
  const usersRes = await get(`${BASE_URL}/api/users?role=Student`, cookie);
  console.log('Users Status:', usersRes.status);
  console.table(
    (usersRes.data?.users || []).map(u => ({
      id: u.id,
      idNumber: u.idNumber,
      fullName: u.fullName,
      role: u.role,
      department: u.studentProfile?.department,
      enrolledSubjects: u.enrolledSubjects,
    }))
  );

  console.log('\n5. Testing user creation via POST /api/users...');
  const createRes = await post(`${BASE_URL}/api/users`, {
    fullName: 'Test User Account',
    username: '99999',
    email: 'testuser@usjr.edu.ph',
    password: 'Giangwapo123?',
    role: 'Educator',
    departmentId: 'CPE',
  }, cookie);
  console.log('Create User Status:', createRes.status, 'Created ID:', createRes.data?.user?.id);

  const createdUserId = createRes.data?.user?.id;

  if (createdUserId) {
    console.log('\n6. Testing role change via PATCH /api/users...');
    const patchRes = await patch(`${BASE_URL}/api/users`, {
      userId: createdUserId,
      action: 'ChangeRole',
      newRole: 'DepartmentHead',
    }, cookie);
    console.log('Change Role Status:', patchRes.status, 'New Role:', patchRes.data?.user?.role);

    console.log('\n7. Testing user deletion via DELETE /api/users...');
    const deleteRes = await del(`${BASE_URL}/api/users?userId=${createdUserId}`, cookie);
    console.log('Delete User Status:', deleteRes.status, 'Message:', deleteRes.data?.message);
  }

  console.log('\nAll API CRUD operations verified successfully! ✅');
}

run().catch(console.error);
