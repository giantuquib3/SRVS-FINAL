const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectCounts() {
  const courses = await prisma.course.count();
  const enrollments = await prisma.enrollment.count();
  const syllabi = await prisma.syllabus.count();
  const syllabusVersions = await prisma.syllabusVersion.count();
  console.log({ courses, enrollments, syllabi, syllabusVersions });
}

inspectCounts().finally(() => prisma.$disconnect());
