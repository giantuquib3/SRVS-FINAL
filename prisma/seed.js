const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SRVS database seeding with Subjects, Segregated Users, and Enrolled Subjects...');

  // 1. Seed Engineering Departments
  const departmentsData = [
    { id: 'CE', code: 'CE', name: 'Civil Engineering', description: 'Department of Civil Engineering' },
    { id: 'CPE', code: 'CPE', name: 'Computer Engineering', description: 'Department of Computer Engineering' },
    { id: 'ECE', code: 'ECE', name: 'Electronics Engineering', description: 'Department of Electronics Engineering' },
    { id: 'IE', code: 'IE', name: 'Industrial Engineering', description: 'Department of Industrial Engineering' },
    { id: 'ME', code: 'ME', name: 'Mechanical Engineering', description: 'Department of Mechanical Engineering' },
    { id: 'EE', code: 'EE', name: 'Electrical Engineering', description: 'Department of Electrical Engineering' },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
    console.log(`✓ Seeded Department: [${dept.code}] ${dept.name}`);
  }

  // 2. Hash default passwords
  const defaultPasswordHash = await bcrypt.hash('Giangwapo123?', 10);
  const adminPasswordHash = await bcrypt.hash('Giangwapo123?', 10);

  // 3. Seed Segregated Users by Role
  // Admin: 00000 (5 digits)
  // Dept Head: 10001 (5 digits)
  // Faculty / Educator: 10002, 10003 (5 digits)
  // Student: 2022012708, 2022012709 (10 digits)
  const usersData = [
    {
      id: '00000',
      email: 'admin@srvs.local',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      fullName: 'System Administrator',
      role: 'Admin',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
    {
      id: '10001',
      email: 'depthead.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Engr. Roberto',
      lastName: 'Del Rosario',
      fullName: 'Engr. Roberto Del Rosario',
      role: 'DepartmentHead',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
    {
      id: '10002',
      email: 'faculty.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Prof. Maria',
      lastName: 'Santos',
      fullName: 'Prof. Maria Santos',
      role: 'Educator',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
    {
      id: '10003',
      email: 'faculty.ce@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Engr. Manuel',
      lastName: 'Reyes',
      fullName: 'Engr. Manuel Reyes',
      role: 'Educator',
      departmentId: 'CE',
      accountStatus: 'Active',
    },
    {
      id: '2022012708',
      email: 'student.gian@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Gian Carlo',
      lastName: 'Tuquib',
      fullName: 'Gian Carlo Tuquib',
      role: 'Student',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
    {
      id: '2022012709',
      email: 'student.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Bea',
      lastName: 'Alonzo',
      fullName: 'Bea Alonzo',
      role: 'Student',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
  ];

  for (const user of usersData) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id,
        role: user.role,
        departmentId: user.departmentId,
        accountStatus: user.accountStatus,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash,
      },
      create: user,
    });
    console.log(`✓ Seeded User: [${user.role}] ID: ${user.id} | ${user.fullName} (${user.email})`);
  }

  // 4. Seed Subjects & Courses with Full Academic Columns (units, lecHours, labHours, prerequisite, yearLevel, semester)
  const subjectsData = [
    {
      id: 'CPE101',
      code: 'CPE101',
      title: 'Introduction to Computer Engineering',
      description: 'Foundations of computer engineering, digital logic, ethics, and computing paradigms.',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      departmentId: 'CPE',
    },
    {
      id: 'CPE102',
      code: 'CPE102',
      title: 'Computer Programming 1',
      description: 'Fundamental concepts of programming, algorithms, structured code, and problem solving.',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      departmentId: 'CPE',
    },
    {
      id: 'CPE201',
      code: 'CPE201',
      title: 'Data Structures and Algorithms',
      description: 'Design, analysis, and implementation of fundamental data structures and algorithmic efficiency.',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'CPE102',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      departmentId: 'CPE',
    },
    {
      id: 'CE101',
      code: 'CE101',
      title: 'Fundamentals of Surveying',
      description: 'Theory and practice of measurement of distances, elevations, directions, and topographic mapping.',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      departmentId: 'CE',
    },
    {
      id: 'ECE101',
      code: 'ECE101',
      title: 'Electronic Devices and Circuits',
      description: 'Solid state electronic physics, semiconductor diodes, BJT and FET characteristics, and power circuits.',
      units: 4,
      lecHours: 3,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      departmentId: 'ECE',
    },
    {
      id: 'IE101',
      code: 'IE101',
      title: 'Engineering Economics',
      description: 'Concepts of economic equivalence, time value of money, capital financing, and depreciation models.',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      departmentId: 'IE',
    },
    {
      id: 'ME101',
      code: 'ME101',
      title: 'Thermodynamics 1',
      description: 'First and second laws of thermodynamics, ideal gas processes, and heat engine cycles.',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      departmentId: 'ME',
    },
    {
      id: 'EE101',
      code: 'EE101',
      title: 'Electric Circuit Theory 1',
      description: 'DC circuit analysis, Kirchhoff laws, node and mesh methods, Thevenin and Norton theorems.',
      units: 4,
      lecHours: 3,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      departmentId: 'EE',
    },
  ];

  for (const s of subjectsData) {
    // Upsert into srvs_subjects
    await prisma.subject.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    // Also upsert into srvs_courses for backward compatibility
    await prisma.course.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    console.log(`✓ Seeded Subject [${s.code}] ${s.title} (${s.units} Units, Lec: ${s.lecHours}h, Lab: ${s.labHours}h, Pre: ${s.prerequisite})`);
  }

  // 5. Seed Student Enrollments for Student 2022012708 (Enrolled in CPE101 and CPE201)
  const enrollmentsData = [
    {
      studentId: '2022012708',
      courseId: 'CPE101',
      subjectId: 'CPE101',
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'A',
      status: 'ENROLLED',
    },
    {
      studentId: '2022012708',
      courseId: 'CPE201',
      subjectId: 'CPE201',
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'A',
      status: 'ENROLLED',
    },
  ];

  for (const enroll of enrollmentsData) {
    const existing = await prisma.enrollment.findFirst({
      where: {
        studentId: enroll.studentId,
        courseId: enroll.courseId,
        semester: enroll.semester,
        academicYear: enroll.academicYear,
      },
    });

    if (!existing) {
      await prisma.enrollment.create({ data: enroll });
    }
    console.log(`✓ Seeded Enrollment: Student ${enroll.studentId} enrolled in ${enroll.courseId} (AY ${enroll.academicYear})`);
  }

  // 6. Seed Approved Syllabus for CPE101 with uploadedByUserId = '10001' (UserID, NOT string name)
  const cpe101Syllabus = await prisma.syllabus.upsert({
    where: { id: 'cpe101-approved-syllabus' },
    update: {
      status: 'ACTIVE',
      currentVersionNumber: 1,
      uploadedByUserId: '10001', // User ID of Dept Head
      createdById: '10001',
      instructorId: '10002', // Faculty User ID
    },
    create: {
      id: 'cpe101-approved-syllabus',
      courseId: 'CPE101',
      subjectId: 'CPE101',
      instructorId: '10002', // User ID of Faculty
      createdById: '10001',  // User ID of Creator
      uploadedByUserId: '10001', // User ID of Uploader (NOT string name)
      departmentId: 'CPE',
      academicYear: '2026-2027',
      semester: '1st Semester',
      section: 'A',
      status: 'ACTIVE',
      currentVersionNumber: 1,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: '10001',
      reviewerRemarks: 'Approved official syllabus for academic year 2026-2027.',
    },
  });

  await prisma.syllabusVersion.upsert({
    where: {
      syllabusId_versionNumber: {
        syllabusId: cpe101Syllabus.id,
        versionNumber: 1,
      },
    },
    update: {
      approvalStatus: 'APPROVED',
      uploadedByUserId: '10001', // User ID
    },
    create: {
      syllabusId: cpe101Syllabus.id,
      versionNumber: 1,
      editorId: '10001',
      uploadedByUserId: '10001', // User ID of Uploader
      changeSummary: 'Official curriculum syllabus upload and approval',
      changeType: 'Approve',
      statusAtSave: 'APPROVED',
      approvalStatus: 'APPROVED',
      fileName: 'CPE101_Official_Syllabus_2026.pdf',
      fileType: 'PDF',
      fileSize: 2048576,
      submittedById: '10001',
      submittedAt: new Date(),
      reviewedById: '10001',
      reviewedAt: new Date(),
      content: {
        courseDescription: 'Foundations of computer engineering, digital logic, ethics, and computing paradigms.',
        learningOutcomes: [
          'Understand fundamental computer engineering disciplines and career pathways.',
          'Analyze basic combinational and sequential digital logic systems.',
          'Formulate and execute problem-solving methodologies using computing tools.',
        ],
        topics: [
          { week: 1, topic: 'Introduction to Computer Engineering & Professional Ethics' },
          { week: 2, topic: 'Number Systems, Binary Arithmetic, and Codes' },
          { week: 3, topic: 'Boolean Algebra and Logic Gates' },
          { week: 4, topic: 'Combinational Logic Circuit Design' },
        ],
        references: [
          'Mano, M. M. (2020). Digital Design: With an Introduction to the Verilog HDL.',
          'Patterson, D. A., & Hennessy, J. L. (2021). Computer Organization and Design.',
        ],
        gradingSystem: [
          { component: 'Major Exams (Prelim, Midterm, Semi, Final)', weight: 50 },
          { component: 'Quizzes & Assignments', weight: 25 },
          { component: 'Laboratory & Mini-Projects', weight: 25 },
        ],
        schedule: 'MWF 09:00 AM - 10:00 AM',
      },
    },
  });
  console.log(`✓ Seeded Approved Syllabus for CPE101 (uploadedByUserId: 10001)`);

  // 7. Seed Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: '00000',
      userDisplayName: 'System Administrator',
      actionType: 'SystemInitialization',
      resultStatus: 'Success',
      description: 'Database initialized with Subject table, segregated users (Admin, DeptHead, Faculty, Students), and student enrolled subjects.',
      entityType: 'System',
      entityId: 'Init',
    },
  });
  console.log('✓ Seeded Initial Audit Log');

  console.log('✅ SRVS database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
