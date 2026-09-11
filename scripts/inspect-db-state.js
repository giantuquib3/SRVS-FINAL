const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const syllabi = await prisma.syllabus.findMany({
    include: {
      subject: true,
      department: true,
      versions: true,
    },
    orderBy: { id: 'desc' },
  });

  console.log(`TOTAL SYLLABI IN DB: ${syllabi.length}`);
  syllabi.forEach((s) => {
    console.log(`\nSYLLABUS #${s.id}:`);
    console.log(`  Subject: ${s.subject?.code} - ${s.subject?.title} (ID: ${s.subjectId})`);
    console.log(`  Department: [${s.department?.code}] ${s.department?.name} (ID: ${s.departmentId})`);
    console.log(`  Status: "${s.status}"`);
    console.log(`  CurrentVersionNumber: ${s.currentVersionNumber}`);
    console.log(`  UploadedByUserId: ${s.uploadedByUserId}`);
    console.log(`  ReviewedByUserId: ${s.reviewedByUserId}`);
    console.log(`  Versions (${s.versions.length}):`);
    s.versions.forEach((v) => {
      console.log(`    - Version ID: ${v.id}, Version#: ${v.versionNumber}, approvalStatus: "${v.approvalStatus}", statusAtSave: "${v.statusAtSave}"`);
    });
  });

  // Also check students and their enrollments
  const students = await prisma.student.findMany({
    include: {
      user: {
        include: {
          enrollments: {
            include: { subject: true },
          },
        },
      },
    },
  });

  console.log(`\n\nSTUDENTS IN DB: ${students.length}`);
  students.forEach((st) => {
    console.log(`\nStudent: ${st.fullName} (ID Number: ${st.studentIdNumber}) [Dept: ${st.department}]`);
    console.log(`  User ID: ${st.userId}, DepartmentId: ${st.user.departmentId}`);
    console.log(`  Enrolled Subjects in Profile: "${st.enrolledSubjects}"`);
    console.log(`  Enrollment Records (${st.user.enrollments.length}):`);
    st.user.enrollments.forEach((e) => {
      console.log(`    - Enrollment ID: ${e.id} | Subject: ${e.subject?.code} (ID: ${e.subjectId}, Dept: ${e.subject?.departmentId}) | Status: ${e.status}`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
