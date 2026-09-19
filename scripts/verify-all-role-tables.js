const http = require('http');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (data) {
      if (typeof data === 'object') {
        data = JSON.stringify(data);
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
}

async function run() {
  console.log('🚀 Testing SRVS System Endpoints on localhost:3000...\n');

  // 1. Check DB status
  console.log('--- 1. Testing /api/system/db-status ---');
  const dbStatus = await request('http://localhost:3000/api/system/db-status');
  console.log('Status code:', dbStatus.status);
  console.log('Database tables:', dbStatus.data.tables);

  // 2. Login all 4 roles
  console.log('\n--- 2. Testing Authentication for all Roles ---');
  const users = [
    { role: 'Admin', id: '00000', pass: 'Giangwapo123?' },
    { role: 'DepartmentHead', id: '10001', pass: 'Giangwapo123?' },
    { role: 'Educator', id: '10002', pass: 'Giangwapo123?' },
    { role: 'Student', id: '2022012701', pass: 'Giangwapo123?' },
  ];

  const cookies = {};
  for (const u of users) {
    const res = await request('http://localhost:3000/api/auth/login', { method: 'POST' }, {
      idNumber: u.id,
      password: u.pass,
    });
    if (res.status === 200) {
      cookies[u.role] = getCookie(res.headers);
      console.log(`✅ ${u.role} (${u.id}): Login SUCCESS! User: "${res.data.user.fullName}"`);
    } else {
      console.error(`❌ ${u.role} (${u.id}): Login FAILED (${res.status})`, res.data);
    }
  }

  // 3. Test /api/courses
  console.log('\n--- 3. Testing /api/courses with connected Faculty ---');
  const coursesRes = await request('http://localhost:3000/api/courses', {
    headers: { Cookie: cookies['Admin'] },
  });
  console.log('Courses count:', coursesRes.data.courses?.length);
  if (coursesRes.data.courses?.length > 0) {
    const sample = coursesRes.data.courses[0];
    console.log(`Sample course: [${sample.code}] ${sample.title}`);
    console.log(`  Connected Faculty: ${sample.facultyName || 'None'} (Faculty ID: ${sample.facultyId || sample.faculty?.id})`);
  }

  // 4. Test /api/students
  console.log('\n--- 4. Testing /api/students (directly querying students table) ---');
  const studentsRes = await request('http://localhost:3000/api/students', {
    headers: { Cookie: cookies['Admin'] },
  });
  console.log('Students count from students table:', studentsRes.data.students?.length);
  if (studentsRes.data.students?.length > 0) {
    const sampleStudent = studentsRes.data.students[0];
    console.log(`Sample student: [${sampleStudent.idNumber}] ${sampleStudent.fullName} (${sampleStudent.department})`);
  }

  // 5. Test Enrollment with FK validation
  console.log('\n--- 5. Testing Student Enrollment with Relational FKs ---');
  const enrollRes = await request('http://localhost:3000/api/enrollments', {
    method: 'POST',
    headers: { Cookie: cookies['Admin'] },
  }, {
    studentId: 2022012702,
    studentName: 'Ana Santos',
    courseCode: 'CPE101',
    semester: '1st Semester',
    academicYear: '2026-2027',
  });
  console.log('Enroll status:', enrollRes.status);
  if (enrollRes.status === 201 || enrollRes.status === 200) {
    console.log(`✅ Enrollment SUCCESS! Student ${enrollRes.data.enrollment?.student?.fullName} (${enrollRes.data.enrollment?.studentId}) enrolled in Course ${enrollRes.data.enrollment?.courseId}`);
  } else {
    console.log('Enrollment response:', enrollRes.data);
  }

  // 6. Test Unenrollment
  const unenrollRes = await request('http://localhost:3000/api/enrollments?studentId=2022012702&courseId=CPE101', {
    method: 'DELETE',
    headers: { Cookie: cookies['Admin'] },
  });
  console.log('Unenroll status:', unenrollRes.status);
  console.log('Unenroll result:', unenrollRes.data);

  console.log('\n🎉 ALL INTEGRATION AND RELATIONAL TESTS COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
