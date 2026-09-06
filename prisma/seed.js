const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SRVS database seeding with Integer IDs, Segregated Role Tables, and Subjects...');

  // 1. Seed Engineering Departments
  const departmentsData = [
    { code: 'CE', name: 'Civil Engineering', description: 'Department of Civil Engineering' },
    { code: 'CPE', name: 'Computer Engineering', description: 'Department of Computer Engineering' },
    { code: 'ECE', name: 'Electronics Engineering', description: 'Department of Electronics Engineering' },
    { code: 'IE', name: 'Industrial Engineering', description: 'Department of Industrial Engineering' },
    { code: 'ME', name: 'Mechanical Engineering', description: 'Department of Mechanical Engineering' },
    { code: 'EE', name: 'Electrical Engineering', description: 'Department of Electrical Engineering' },
  ];

  const deptMap = {};
  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
    deptMap[dept.code] = record;
    console.log(`✓ Seeded Department: [${record.code}] ${record.name} (PK ID: ${record.id})`);
  }

  // 2. Hash default passwords
  const defaultPasswordHash = await bcrypt.hash('Giangwapo123?', 10);
  const adminPasswordHash = await bcrypt.hash('Giangwapo123?', 10);

  // 3. Seed Users and Segregated Role Records
  // Admin: 00000 (5 digits)
  // Dept Head: 10001 (5 digits)
  // Faculty / Educator: 10002, 10003 (5 digits)
  // Student: 2022012708, 2022012709 (10 digits)
  const usersToSeed = [
    {
      idNumber: '00000',
      email: 'admin@srvs.local',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      fullName: 'System Administrator',
      role: 'Admin',
      deptCode: 'CPE',
      accountStatus: 'Active',
    },
    {
      idNumber: '10001',
      email: 'depthead.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Engr. Roberto',
      lastName: 'Del Rosario',
      fullName: 'Engr. Roberto Del Rosario',
      role: 'DepartmentHead',
      deptCode: 'CPE',
      accountStatus: 'Active',
    },
    {
      idNumber: '10002',
      email: 'faculty.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Prof. Maria',
      lastName: 'Santos',
      fullName: 'Prof. Maria Santos',
      role: 'Educator',
      deptCode: 'CPE',
      accountStatus: 'Active',
    },
    {
      idNumber: '10003',
      email: 'faculty.ce@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Engr. Manuel',
      lastName: 'Reyes',
      fullName: 'Engr. Manuel Reyes',
      role: 'Educator',
      deptCode: 'CE',
      accountStatus: 'Active',
    },
    {
      idNumber: '2022012708',
      email: 'student.gian@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Gian Carlo',
      lastName: 'Tuquib',
      fullName: 'Gian Carlo Tuquib',
      role: 'Student',
      deptCode: 'CPE',
      accountStatus: 'Active',
    },
    {
      idNumber: '2022012709',
      email: 'student.cpe@srvs.local',
      passwordHash: defaultPasswordHash,
      firstName: 'Bea',
      lastName: 'Alonzo',
      fullName: 'Bea Alonzo',
      role: 'Student',
      deptCode: 'CPE',
      accountStatus: 'Active',
    },
  ];

  const userMap = {};
  for (const u of usersToSeed) {
    const deptId = u.deptCode && deptMap[u.deptCode] ? deptMap[u.deptCode].id : null;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        idNumber: u.idNumber,
        fullName: u.fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        departmentId: deptId,
        accountStatus: u.accountStatus,
        passwordHash: u.passwordHash,
      },
      create: {
        idNumber: u.idNumber,
        email: u.email,
        passwordHash: u.passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: u.fullName,
        role: u.role,
        departmentId: deptId,
        accountStatus: u.accountStatus,
      },
    });

    userMap[u.idNumber] = user;
    console.log(`✓ Seeded User: [ID: ${user.id} | ID Number: ${user.idNumber}] ${user.fullName} (${user.role})`);

    // Segregate into role tables
    if (user.role === 'Admin') {
      await prisma.admin.upsert({
        where: { userId: user.id },
        update: { fullName: user.fullName, email: user.email, adminNumber: user.idNumber },
        create: {
          userId: user.id,
          adminNumber: user.idNumber,
          fullName: user.fullName,
          email: user.email,
        },
      });
      console.log(`  └─ Created srvs_admins profile for Admin ${user.idNumber}`);
    } else if (user.role === 'DepartmentHead') {
      await prisma.departmentHead.upsert({
        where: { userId: user.id },
        update: { fullName: user.fullName, email: user.email, employeeId: user.idNumber, department: u.deptCode || 'CPE' },
        create: {
          userId: user.id,
          employeeId: user.idNumber,
          fullName: user.fullName,
          email: user.email,
          department: u.deptCode || 'CPE',
          title: 'Department Chairperson',
          officeLocation: 'Engineering Complex Room 302',
        },
      });
      console.log(`  └─ Created srvs_department_heads profile for Dept Head ${user.idNumber} [Dept: ${u.deptCode || 'CPE'}]`);
    } else if (user.role === 'Educator') {
      await prisma.faculty.upsert({
        where: { userId: user.id },
        update: { fullName: user.fullName, email: user.email, employeeId: user.idNumber, department: u.deptCode || 'CPE' },
        create: {
          userId: user.id,
          employeeId: user.idNumber,
          fullName: user.fullName,
          email: user.email,
          department: u.deptCode || 'CPE',
          academicRank: 'Assistant Professor',
        },
      });
      console.log(`  └─ Created srvs_faculties profile for Faculty ${user.idNumber} [Dept: ${u.deptCode || 'CPE'}]`);
    } else if (user.role === 'Student') {
      await prisma.student.upsert({
        where: { userId: user.id },
        update: { fullName: user.fullName, email: user.email, studentIdNumber: user.idNumber, department: u.deptCode || 'CPE' },
        create: {
          userId: user.id,
          studentIdNumber: user.idNumber,
          fullName: user.fullName,
          email: user.email,
          department: u.deptCode || 'CPE',
          enrolledSubjects: '',
          yearLevel: user.idNumber === '2022012708' ? '3rd Year' : '1st Year',
        },
      });
      console.log(`  └─ Created srvs_students profile for Student ${user.idNumber} [Dept: ${u.deptCode || 'CPE'}]`);
    }
  }

  // 4. Seed Academic Curriculum Subjects
  const subjectsData = [
    {
      code: 'CPE101',
      title: 'Introduction to Computer Engineering',
      deptCode: 'CPE',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      description: 'Foundations of computer engineering, digital logic, ethics, and computing paradigms.',
    },
    {
      code: 'CPE102',
      title: 'Computer Programming 1',
      deptCode: 'CPE',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      description: 'Fundamental concepts of programming, algorithms, structured code, and problem solving.',
    },
    {
      code: 'CPE201',
      title: 'Data Structures and Algorithms',
      deptCode: 'CPE',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'CPE102',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      description: 'Design, analysis, and implementation of fundamental data structures and algorithmic efficiency.',
    },
    {
      code: 'CE101',
      title: 'Fundamentals of Surveying',
      deptCode: 'CE',
      units: 3,
      lecHours: 2,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '1st Year',
      semester: '1st Semester',
      description: 'Theory and practice of measurement of distances, elevations, directions, and topographic mapping.',
    },
    {
      code: 'ECE101',
      title: 'Electronic Devices and Circuits',
      deptCode: 'ECE',
      units: 4,
      lecHours: 3,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      description: 'Solid state electronic physics, semiconductor diodes, BJT and FET characteristics, and power circuits.',
    },
    {
      code: 'IE101',
      title: 'Engineering Economics',
      deptCode: 'IE',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      description: 'Concepts of economic equivalence, time value of money, capital financing, and depreciation models.',
    },
    {
      code: 'ME101',
      title: 'Thermodynamics 1',
      deptCode: 'ME',
      units: 3,
      lecHours: 3,
      labHours: 0,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      description: 'First and second laws of thermodynamics, ideal gas processes, and heat engine cycles.',
    },
    {
      code: 'EE101',
      title: 'Electric Circuit Theory 1',
      deptCode: 'EE',
      units: 4,
      lecHours: 3,
      labHours: 3,
      prerequisite: 'None',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      description: 'DC circuit analysis, Kirchhoff laws, node and mesh methods, Thevenin and Norton theorems.',
    },
  ];

  const subjectMap = {};
  for (const s of subjectsData) {
    const departmentId = deptMap[s.deptCode].id;
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: {
        title: s.title,
        description: s.description,
        units: s.units,
        lecHours: s.lecHours,
        labHours: s.labHours,
        prerequisite: s.prerequisite,
        yearLevel: s.yearLevel,
        semester: s.semester,
        departmentId,
      },
      create: {
        code: s.code,
        title: s.title,
        description: s.description,
        units: s.units,
        lecHours: s.lecHours,
        labHours: s.labHours,
        prerequisite: s.prerequisite,
        yearLevel: s.yearLevel,
        semester: s.semester,
        departmentId,
      },
    });

    subjectMap[s.code] = subject;
    console.log(`✓ Seeded Subject: [PK ID: ${subject.id} | ${subject.code}] ${subject.title} (${subject.units} Units)`);
  }

  // 5. Seed Student Enrolled Subjects
  const studentGian = userMap['2022012708'];
  const studentMaria = userMap['2022012709'];

  const enrollmentsToSeed = [];
  if (studentGian && subjectMap['CPE101'] && subjectMap['CPE201']) {
    enrollmentsToSeed.push(
      {
        studentId: studentGian.id,
        subjectId: subjectMap['CPE101'].id,
        semester: '1st Semester',
        academicYear: '2026-2027',
        section: 'A',
        status: 'ENROLLED',
      },
      {
        studentId: studentGian.id,
        subjectId: subjectMap['CPE201'].id,
        semester: '1st Semester',
        academicYear: '2026-2027',
        section: 'A',
        status: 'ENROLLED',
      }
    );
  }

  if (studentMaria && subjectMap['CPE101']) {
    enrollmentsToSeed.push({
      studentId: studentMaria.id,
      subjectId: subjectMap['CPE101'].id,
      semester: '1st Semester',
      academicYear: '2026-2027',
      section: 'B',
      status: 'ENROLLED',
    });
  }

  for (const enr of enrollmentsToSeed) {
    await prisma.enrollment.upsert({
      where: {
        studentId_subjectId_semester_academicYear: {
          studentId: enr.studentId,
          subjectId: enr.subjectId,
          semester: enr.semester,
          academicYear: enr.academicYear,
        },
      },
      update: { section: enr.section, status: enr.status },
      create: enr,
    });
  }
  console.log(`✓ Seeded student subject enrollments`);

  // Synchronize enrolled subjects code-only list in srvs_students
  const allStudents = await prisma.student.findMany({
    include: {
      user: {
        include: {
          enrollments: {
            where: { status: 'ENROLLED' },
            include: { subject: true },
          },
        },
      },
    },
  });

  for (const s of allStudents) {
    const codes = Array.from(new Set(s.user.enrollments.map((e) => e.subject.code))).join(', ');
    await prisma.student.update({
      where: { id: s.id },
      data: { enrolledSubjects: codes },
    });
    console.log(`✓ Synchronized Student ${s.studentIdNumber} enrolled subjects codes: [${codes || 'None'}]`);
  }

  // 6. Seed Official Active Syllabus for CPE101
  const deptHeadUser = userMap['10001'];
  const cpe101 = subjectMap['CPE101'];

  if (deptHeadUser && cpe101) {
    const existingSyllabus = await prisma.syllabus.findFirst({
      where: { subjectId: cpe101.id },
    });

    let syllabus = existingSyllabus;
    if (!syllabus) {
      syllabus = await prisma.syllabus.create({
        data: {
          subjectId: cpe101.id,
          instructorId: deptHeadUser.id,
          createdById: deptHeadUser.id,
          uploadedByUserId: '10001', // Stored by University ID Number, NOT name
          departmentId: deptMap['CPE'].id,
          academicYear: '2026-2027',
          semester: '1st Semester',
          section: 'A',
          status: 'ACTIVE',
          currentVersionNumber: 1,
          reviewedAt: new Date(),
          reviewerRemarks: 'Approved official syllabus version for 1st Semester 2026-2027',
        },
      });
      console.log(`✓ Created Active Syllabus (PK ID: ${syllabus.id}) for CPE101 (Uploaded by User ID: 10001)`);
    }

    const existingVersion = await prisma.syllabusVersion.findFirst({
      where: { syllabusId: syllabus.id, versionNumber: 1 },
    });

    if (!existingVersion) {
      await prisma.syllabusVersion.create({
        data: {
          syllabusId: syllabus.id,
          versionNumber: 1,
          editorId: deptHeadUser.id,
          uploadedByUserId: '10001',
          changeSummary: 'Initial curriculum-approved syllabus release for academic year 2026-2027',
          changeType: 'Create',
          statusAtSave: 'APPROVED',
          approvalStatus: 'APPROVED',
          content: {
            courseDescription: cpe101.description,
            learningOutcomes: [
              'Understand computer engineering principles and hardware architecture fundamentals.',
              'Analyze basic digital logic circuits, number representations, and memory units.',
              'Adhere to professional and ethical standards in computer engineering practice.',
            ],
            topics: [
              'Week 1: Orientation, USJ-R Vision/Mission, and Introduction to Computer Engineering',
              'Week 2-4: Fundamentals of Number Systems, Boolean Algebra, and Logic Gates',
              'Week 5-7: Combinational Logic Circuits and Adders',
              'Week 8-9: Midterm Examinations and System Architecture Overviews',
              'Week 10-14: Sequential Logic, Latches, Flip-Flops, and Memory Registers',
              'Week 15-17: Ethical Paradigms, Microprocessors, and Emerging Technologies',
              'Week 18: Final Course Project Presentation and Evaluation',
            ],
            references: [
              'Patterson, D. A., & Hennessy, J. L. Computer Organization and Design (6th ed.).',
              'Mano, M. M., & Ciletti, M. D. Digital Design: With an Introduction to the Verilog HDL (6th ed.).',
              'USJ-R Department of Computer Engineering Syllabus Guidelines (2026).',
            ],
            gradingSystem: [
              'Major Examinations: 40%',
              'Laboratory / Technical Projects: 30%',
              'Quizzes & Homework: 20%',
              'Class Participation & Ethics: 10%',
            ],
            schedule: 'MWF 09:00 AM - 10:00 AM / Engineering Lab 201',
          },
          submittedById: deptHeadUser.id,
          submittedAt: new Date(),
          reviewedById: deptHeadUser.id,
          reviewedAt: new Date(),
        },
      });
      console.log(`✓ Created Approved Syllabus Version 1 for Syllabus ID: ${syllabus.id}`);
    }
  }

  console.log('\n🎉 Database seeding completed successfully with all Integer PK IDs and Segregated Tables!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
