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

async function runTestSuite() {
  console.log('🧪 ===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END API TEST SUITE (SRVS BACKEND)');
  console.log('🧪 ===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details}`);
      failed++;
    }
  }

  // 1. Health & Database Diagnostics
  console.log('1. System & Database Health');
  const dbRes = await request('http://localhost:3000/api/system/db-status');
  assert(dbRes.status === 200, 'GET /api/system/db-status (200 OK)');
  assert(dbRes.data.database?.includes('PostgreSQL'), 'Database reports PostgreSQL connection pooler');
  assert(dbRes.data.tables?.admin >= 20, `Users table has records: ${dbRes.data.tables?.admin}`);

  // 2. Departments
  console.log('\n2. Academic Departments');
  const deptsRes = await request('http://localhost:3000/api/departments');
  assert(deptsRes.status === 200, 'GET /api/departments (200 OK)');
  assert(deptsRes.data.departments?.length === 6, 'Contains all 6 Engineering departments');

  // 3. User Authentication for All 4 Roles
  console.log('\n3. Authentication Workflow');
  const roles = [
    { role: 'Admin', id: '00000', pass: 'Giangwapo123?' },
    { role: 'DepartmentHead', id: '10001', pass: 'Giangwapo123?' },
    { role: 'Educator', id: '10002', pass: 'Giangwapo123?' },
    { role: 'Student', id: '2022012701', pass: 'Giangwapo123?' },
  ];

  const sessions = {};
  for (const r of roles) {
    const loginRes = await request('http://localhost:3000/api/auth/login', { method: 'POST' }, {
      idNumber: r.id,
      password: r.pass,
    });
    assert(loginRes.status === 200, `POST /api/auth/login [${r.role}] (200 OK)`);
    sessions[r.role] = getCookie(loginRes.headers);

    // Verify /api/auth/me
    const meRes = await request('http://localhost:3000/api/auth/me', {
      headers: { Cookie: sessions[r.role] },
    });
    assert(meRes.status === 200 && meRes.data.user?.role === r.role, `GET /api/auth/me [${r.role}] returns valid user profile`);
  }

  // 4. Role Dashboard Stats
  console.log('\n4. Role Dashboard Stats');
  for (const r of roles) {
    const statsRes = await request('http://localhost:3000/api/dashboard/stats', {
      headers: { Cookie: sessions[r.role] },
    });
    assert(statsRes.status === 200 && statsRes.data.role === r.role, `GET /api/dashboard/stats [${r.role}]`);
  }

  // 5. User Directory & Student Catalog
  console.log('\n5. User Directory & Students');
  const usersRes = await request('http://localhost:3000/api/users', {
    headers: { Cookie: sessions['Admin'] },
  });
  assert(usersRes.status === 200 && usersRes.data.users?.length > 0, 'GET /api/users (Admin access)');

  const studentsRes = await request('http://localhost:3000/api/students', {
    headers: { Cookie: sessions['DepartmentHead'] },
  });
  assert(studentsRes.status === 200 && Array.isArray(studentsRes.data.students), 'GET /api/students (Department Head scoped)');

  // 6. Course & Curriculum Management
  console.log('\n6. Courses & Curriculum');
  const coursesRes = await request('http://localhost:3000/api/courses', {
    headers: { Cookie: sessions['Admin'] },
  });
  assert(coursesRes.status === 200 && coursesRes.data.courses?.length > 0, 'GET /api/courses');

  const subjectsRes = await request('http://localhost:3000/api/subjects', {
    headers: { Cookie: sessions['Student'] },
  });
  assert(subjectsRes.status === 200 && Array.isArray(subjectsRes.data.subjects), 'GET /api/subjects (Student view)');

  // Department Head adds course
  const newCourseCode = 'TEST' + Math.floor(100 + Math.random() * 899);
  const addCourseRes = await request('http://localhost:3000/api/courses', {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, {
    code: newCourseCode,
    title: 'Testing Automated Systems',
    description: 'Course added by Department Head to test course addition functionality.',
    units: 3,
    departmentId: 'CPE',
    facultyName: 'Dr. Alan Turing',
    facultyId: 10001,
  });
  assert(addCourseRes.status === 201, `POST /api/courses (DeptHead adds course [${newCourseCode}])`);
  const createdCourseId = addCourseRes.data.course?.id;

  // 7. Syllabus Lifecycle (Direct Department Head Upload, Drafting, Approvals)
  console.log('\n7. Syllabus Lifecycle & Review');
  const createSyllabusRes = await request('http://localhost:3000/api/syllabi', {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, {
    courseId: createdCourseId,
    semester: '1st Semester',
    academicYear: '2026-2027',
    courseDescription: 'Syllabus uploaded and authored directly by Department Head.',
    learningOutcomes: ['Outcome 1: Mastery', 'Outcome 2: Innovation'],
    directApprove: true,
  });
  assert(createSyllabusRes.status === 201, 'POST /api/syllabi (DeptHead creates and direct-approves)');
  const createdSyllabusId = createSyllabusRes.data.syllabus?.id;

  const syllabusDetailRes = await request(`http://localhost:3000/api/syllabi/${createdSyllabusId}`, {
    headers: { Cookie: sessions['DepartmentHead'] },
  });
  assert(syllabusDetailRes.status === 200, `GET /api/syllabi/${createdSyllabusId}`);

  const versionsRes = await request(`http://localhost:3000/api/syllabi/${createdSyllabusId}/versions`, {
    headers: { Cookie: sessions['DepartmentHead'] },
  });
  assert(versionsRes.status === 200 && versionsRes.data.versions?.length > 0, `GET /api/syllabi/${createdSyllabusId}/versions`);

  // Restore version test
  const restoreRes = await request(`http://localhost:3000/api/syllabi/${createdSyllabusId}/restore`, {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, { versionNumber: 1 });
  assert(restoreRes.status === 200, `POST /api/syllabi/${createdSyllabusId}/restore`);

  // Submit syllabus test
  const submitRes = await request(`http://localhost:3000/api/syllabi/${createdSyllabusId}/submit`, {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, { notes: 'Ready for review' });
  assert(submitRes.status === 200, `POST /api/syllabi/${createdSyllabusId}/submit`);

  // Review & Approve test
  const reviewRes = await request(`http://localhost:3000/api/syllabi/${createdSyllabusId}/review`, {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, { action: 'Approve', remarks: 'Meets academic standards' });
  assert(reviewRes.status === 200, `POST /api/syllabi/${createdSyllabusId}/review (Approve)`);

  // Syllabus Approvals queue test
  const approvalsRes = await request('http://localhost:3000/api/syllabus-approvals?status=ALL', {
    headers: { Cookie: sessions['DepartmentHead'] },
  });
  assert(approvalsRes.status === 200 && Array.isArray(approvalsRes.data.approvals), 'GET /api/syllabus-approvals');

  // 8. Student Enrollment Workflow
  console.log('\n8. Student Course Enrollments');
  const enrollRes = await request('http://localhost:3000/api/enrollments', {
    method: 'POST',
    headers: { Cookie: sessions['Admin'] },
  }, {
    studentId: 2022012701,
    studentName: 'Carlos Reyes',
    courseId: createdCourseId,
    semester: '1st Semester',
    academicYear: '2026-2027',
  });
  assert(enrollRes.status === 201, `POST /api/enrollments (Enrolling student 2022012701 in course ${createdCourseId})`);

  const listEnrollRes = await request(`http://localhost:3000/api/enrollments?studentId=2022012701`, {
    headers: { Cookie: sessions['Student'] },
  });
  assert(listEnrollRes.status === 200 && listEnrollRes.data.enrollments?.length > 0, 'GET /api/enrollments (Student queries enrolled courses)');

  const unenrollRes = await request(`http://localhost:3000/api/enrollments?studentId=2022012701&courseId=${createdCourseId}`, {
    method: 'DELETE',
    headers: { Cookie: sessions['Admin'] },
  });
  assert(unenrollRes.status === 200, 'DELETE /api/enrollments (Unenroll student)');

  // 9. Notifications & Announcements
  console.log('\n9. Notifications & Department Announcements');
  const notifRes = await request('http://localhost:3000/api/notifications', {
    headers: { Cookie: sessions['Student'] },
  });
  assert(notifRes.status === 200, 'GET /api/notifications');

  const notifPatchRes = await request('http://localhost:3000/api/notifications', {
    method: 'PATCH',
    headers: { Cookie: sessions['Student'] },
  });
  assert(notifPatchRes.status === 200, 'PATCH /api/notifications (Mark as read)');

  const announceRes = await request('http://localhost:3000/api/announcements', {
    method: 'POST',
    headers: { Cookie: sessions['DepartmentHead'] },
  }, {
    title: 'Midterm Submission Reminder',
    message: 'Please review and finalize all pending syllabi before the deadline.',
    departmentId: 'CPE',
  });
  assert(announceRes.status === 200, 'POST /api/announcements (DeptHead broadcasts announcement)');

  // 10. Audit Logging
  console.log('\n10. Security Audit Trail');
  const auditRes = await request('http://localhost:3000/api/audit-logs?limit=10', {
    headers: { Cookie: sessions['Admin'] },
  });
  assert(auditRes.status === 200 && auditRes.data.logs?.length > 0, 'GET /api/audit-logs');

  // 11. OpenAPI Specification Document
  console.log('\n11. OpenAPI 3.0.3 Specification Document');
  const openApiRes = await request('http://localhost:3000/api/openapi.json');
  assert(openApiRes.status === 200, 'GET /api/openapi.json (200 OK)');
  assert(openApiRes.data.openapi === '3.0.3', 'OpenAPI version 3.0.3');
  assert(Object.keys(openApiRes.data.paths).length >= 25, `OpenAPI paths registered: ${Object.keys(openApiRes.data.paths).length}`);

  // 12. Cleanup
  console.log('\n12. Cleanup Test Course');
  const delCourseRes = await request(`http://localhost:3000/api/courses?id=${createdCourseId}`, {
    method: 'DELETE',
    headers: { Cookie: sessions['DepartmentHead'] },
  });
  assert(delCourseRes.status === 200, `DELETE /api/courses?id=${createdCourseId}`);

  // 13. Logout
  console.log('\n13. Session Termination');
  const logoutRes = await request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: sessions['Admin'] },
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout');

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================');

  if (failed === 0) {
    console.log('🎉 ALL ENDPOINTS ARE FULLY FUNCTIONAL AND CONSISTENT WITH THE DATABASE!');
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(console.error);
