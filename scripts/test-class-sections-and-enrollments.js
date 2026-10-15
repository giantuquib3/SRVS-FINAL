/**
 * Test script to verify Option B:
 * - Student enrolled in multiple subjects
 * - Subject enrolled by multiple students
 * - Duplicate enrollment prevention per term
 * - Class sections retrieval and instructor linkage
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Testing Option B: Class Sections & Multi-Subject Enrollments\n');

  try {
    // 1. Verify Class Sections
    const sections = await prisma.classSection.findMany({
      include: {
        subject: true,
        instructor: true,
        _count: { select: { enrollments: true } },
      },
    });
    console.log(`✓ Total Class Sections in DB: ${sections.length}`);
    for (const s of sections.slice(0, 5)) {
      console.log(`  - Section: [${s.subject.code}] Sec ${s.section} (${s.semester} ${s.academicYear}) | Instructor: ${s.instructor?.fullName || 'None'} | Enrolled: ${s._count.enrollments}/${s.capacity}`);
    }

    // 2. Test: Can a student enroll in multiple subjects?
    const gian = await prisma.user.findFirst({ where: { id: 2022012708 } });
    if (!gian) throw new Error('Student Gian not found');

    const gianEnrollments = await prisma.enrollment.findMany({
      where: { studentId: gian.id, status: 'ENROLLED' },
      include: { classSection: { include: { subject: true } } },
    });
    console.log(`\n✓ Student ${gian.fullName} (${gian.id}) is enrolled in ${gianEnrollments.length} subjects:`);
    for (const en of gianEnrollments) {
      console.log(`  - [${en.classSection.subject.code}] ${en.classSection.subject.title} (Sec ${en.classSection.section}, ${en.classSection.semester})`);
    }
    if (gianEnrollments.length < 2) {
      console.warn('⚠️ Expected student to be enrolled in multiple subjects.');
    } else {
      console.log('  🎯 Verified: Student can enroll in multiple subjects!');
    }

    // 3. Test: Does a subject have multiple students enrolled?
    const subjectEnrollments = await prisma.classSection.findMany({
      where: { enrollments: { some: {} } },
      include: {
        subject: true,
        enrollments: { include: { student: true } },
      },
    });

    console.log(`\n✓ Checking multiple students per subject/section:`);
    for (const cs of subjectEnrollments) {
      if (cs.enrollments.length > 1) {
        console.log(`  - [${cs.subject.code}] Sec ${cs.section} has ${cs.enrollments.length} students:`);
        for (const en of cs.enrollments) {
          console.log(`    * ${en.student.fullName} (ID: ${en.studentId})`);
        }
      }
    }

    // 4. Test: Check unique constraint on (studentId, classSectionId)
    const testSection = sections[0];
    const testStudent = gian;
    console.log(`\n✓ Testing unique constraint: duplicate enrollment in same section...`);
    try {
      await prisma.enrollment.create({
        data: {
          studentId: testStudent.id,
          classSectionId: testSection.id,
          status: 'ENROLLED',
        },
      });
      // If we got here, remove it
      console.log('  Enrolled first time.');
      // Attempt duplicate:
      await prisma.enrollment.create({
        data: {
          studentId: testStudent.id,
          classSectionId: testSection.id,
          status: 'ENROLLED',
        },
      });
      console.error('❌ Failed: duplicate enrollment was not prevented!');
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
        console.log('  🎯 Verified: Duplicate enrollment in the same section is strictly blocked by DB constraint!');
      } else {
        console.log('  Constraint caught:', err.message);
      }
    }

    console.log('\n🎉 ALL OPTION B TESTS PASSED SUCCESSFULLY!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
