const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
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
      port: parsedUrl.port,
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

async function run() {
  console.log('1. Testing /api/system/db-status...');
  const dbStatus = await get('http://127.0.0.1:3000/api/system/db-status');
  console.log('DB Status:', dbStatus.status, dbStatus.data?.tables ? 'OK' : dbStatus.data);

  console.log('\n2. Logging in as Admin (00000)...');
  const loginRes = await post('http://127.0.0.1:3000/api/auth/login', {
    idNumber: '00000',
    password: 'Giangwapo123?',
  });
  console.log('Login Status:', loginRes.status, 'User:', loginRes.data?.user?.fullName);

  const cookie = loginRes.cookie;

  console.log('\n3. Fetching /api/students as Admin...');
  const studentsRes = await new Promise((resolve) => {
    http.get('http://127.0.0.1:3000/api/students', { headers: { Cookie: cookie } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });
  console.log('Students Status:', studentsRes.status);
  console.table(studentsRes.data?.students || []);

  console.log('\n4. Fetching /api/users?role=Student as Admin...');
  const usersRes = await new Promise((resolve) => {
    http.get('http://127.0.0.1:3000/api/users?role=Student', { headers: { Cookie: cookie } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });
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
}

run().catch(console.error);
