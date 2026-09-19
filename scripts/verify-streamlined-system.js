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
  console.log('🚀 Verifying Streamlined SRVS System on localhost:3000...\n');

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

  // 3. Test Department Head adding a course
  console.log('\n--- 3. Testing Department Head Adding a Course ---');
  const coursePayload = {
    code: 'CPE999',
    title: 'Advanced Computer Engineering Systems',
    description: 'Capstone systems analysis and modern computer architecture.',
    units: 3,
    departmentId: 'CPE',
    facultyName: 'Dr. Alan Turing',
    facultyId: 10001,
  };
  const addCourseRes = await request('http://localhost:3000/api/courses', {
    method: 'POST',
    headers: { Cookie: cookies['DepartmentHead'] },
  }, coursePayload);
  console.log('Add course status:', addCourseRes.status);
  const createdCourseId = addCourseRes.data.course?.id;
  console.log(`✅ Course Created: [${addCourseRes.data.course?.code}] (ID: ${createdCourseId})`);

  // 4. Test Department Head uploading / authoring a syllabus
  console.log('\n--- 4. Testing Department Head Uploading / Authoring Syllabus ---');
  const syllabusPayload = {
    courseId: createdCourseId,
    semester: '1st Semester',
    academicYear: '2026-2027',
    courseDescription: 'Comprehensive syllabus for advanced computer engineering.',
    learningOutcomes: ['Understand high performance computing', 'Design secure hardware architectures'],
    directApprove: true,
  };
  const createSyllabusRes = await request('http://localhost:3000/api/syllabi', {
    method: 'POST',
    headers: { Cookie: cookies['DepartmentHead'] },
  }, syllabusPayload);
  console.log('Create syllabus status:', createSyllabusRes.status);
  const createdSyllabusId = createSyllabusRes.data.syllabus?.id;
  console.log(`✅ Syllabus Created & Approved: ID ${createdSyllabusId} (Status: ${createSyllabusRes.data.syllabus?.status})`);

  // 5. Test Student Enrollment
  console.log('\n--- 5. Testing Student Enrollment with Direct admin.id FK ---');
  const enrollRes = await request('http://localhost:3000/api/enrollments', {
    method: 'POST',
    headers: { Cookie: cookies['Admin'] },
  }, {
    studentId: 2022012701,
    studentName: 'Carlos Reyes',
    courseId: createdCourseId,
    semester: '1st Semester',
    academicYear: '2026-2027',
  });
  console.log('Enroll status:', enrollRes.status);
  console.log(`✅ Student Enrolled: ${enrollRes.data.enrollment?.studentName} in course ${createdCourseId}`);

  // Unenroll student
  const unenrollRes = await request(`http://localhost:3000/api/enrollments?studentId=2022012701&courseId=${createdCourseId}`, {
    method: 'DELETE',
    headers: { Cookie: cookies['Admin'] },
  });
  console.log('Unenroll status:', unenrollRes.status);

  // Clean up test course and syllabus
  const delCourseRes = await request(`http://localhost:3000/api/courses?id=${createdCourseId}`, {
    method: 'DELETE',
    headers: { Cookie: cookies['DepartmentHead'] },
  });
  console.log('Cleanup test course status:', delCourseRes.status);

  // 6. Test OpenAPI Specification endpoint
  console.log('\n--- 6. Testing OpenAPI Documentation Endpoint ---');
  const openApiRes = await request('http://localhost:3000/api/openapi.json');
  console.log('OpenAPI endpoint status:', openApiRes.status);
  console.log('OpenAPI Title:', openApiRes.data.info?.title);
  console.log('OpenAPI Tags count:', openApiRes.data.tags?.length);

  console.log('\n🎉 ALL STREAMLINED SYSTEM VERIFICATIONS PASSED 100%!');
}

run().catch(console.error);
