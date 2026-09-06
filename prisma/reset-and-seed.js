const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAndSeed() {
  console.log('🔄 Cleaning old tables in PostgreSQL...');
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        srvs_notifications, 
        srvs_audit_logs, 
        srvs_syllabus_versions, 
        srvs_syllabi, 
        srvs_enrollments, 
        srvs_courses, 
        srvs_users, 
        srvs_departments 
      CASCADE;
    `);
    console.log('✓ Tables truncated cleanly.');
  } catch (err) {
    console.error('Truncate error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🌱 Running seed script with natural primary keys...');
  require('./seed.js');
}

resetAndSeed();
