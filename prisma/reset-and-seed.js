const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Cleaning all tables in PostgreSQL for user-input mode...');
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        srvs_syllabus_versions, 
        srvs_syllabi, 
        srvs_subjects, 
        students, 
        faculty, 
        department_heads, 
        admins 
      CASCADE;
    `);
    console.log('✓ All tables truncated cleanly (0 rows in all tables).');
  } catch (err) {
    console.error('Truncate error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
