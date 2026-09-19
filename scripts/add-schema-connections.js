const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'DB 1 (qoxpqhvecjxlsbsshxsm - Primary in .env)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'DB 2 (goxvhkbwfpffjnqphzpq - Secondary in pgAdmin)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

const foreignKeys = [
  {
    name: 'courses_facultyId_fkey',
    table: 'courses',
    sql: `
      ALTER TABLE "courses" 
      DROP CONSTRAINT IF EXISTS "courses_facultyId_fkey";
      ALTER TABLE "courses" 
      ADD CONSTRAINT "courses_facultyId_fkey" 
      FOREIGN KEY ("facultyId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
  {
    name: 'enrollments_courseId_fkey',
    table: 'enrollments',
    sql: `
      ALTER TABLE "enrollments" 
      DROP CONSTRAINT IF EXISTS "enrollments_courseId_fkey";
      ALTER TABLE "enrollments" 
      ADD CONSTRAINT "enrollments_courseId_fkey" 
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabi_courseId_fkey',
    table: 'syllabi',
    sql: `
      ALTER TABLE "syllabi" 
      DROP CONSTRAINT IF EXISTS "syllabi_courseId_fkey";
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_courseId_fkey" 
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabi_instructorId_fkey',
    table: 'syllabi',
    sql: `
      ALTER TABLE "syllabi" 
      DROP CONSTRAINT IF EXISTS "syllabi_instructorId_fkey";
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_instructorId_fkey" 
      FOREIGN KEY ("instructorId") REFERENCES "admin"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabi_reviewedByUserId_fkey',
    table: 'syllabi',
    sql: `
      ALTER TABLE "syllabi" 
      DROP CONSTRAINT IF EXISTS "syllabi_reviewedByUserId_fkey";
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_reviewedByUserId_fkey" 
      FOREIGN KEY ("reviewedByUserId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabus_versions_syllabusId_fkey',
    table: 'syllabus_versions',
    sql: `
      ALTER TABLE "syllabus_versions" 
      DROP CONSTRAINT IF EXISTS "syllabus_versions_syllabusId_fkey";
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_syllabusId_fkey" 
      FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabus_versions_editorId_fkey',
    table: 'syllabus_versions',
    sql: `
      ALTER TABLE "syllabus_versions" ADD COLUMN IF NOT EXISTS "editorId" TEXT;
      ALTER TABLE "syllabus_versions" 
      DROP CONSTRAINT IF EXISTS "syllabus_versions_editorId_fkey";
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_editorId_fkey" 
      FOREIGN KEY ("editorId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabus_versions_submittedById_fkey',
    table: 'syllabus_versions',
    sql: `
      ALTER TABLE "syllabus_versions" 
      DROP CONSTRAINT IF EXISTS "syllabus_versions_submittedById_fkey";
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_submittedById_fkey" 
      FOREIGN KEY ("submittedById") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
  {
    name: 'syllabus_versions_reviewedById_fkey',
    table: 'syllabus_versions',
    sql: `
      ALTER TABLE "syllabus_versions" 
      DROP CONSTRAINT IF EXISTS "syllabus_versions_reviewedById_fkey";
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_reviewedById_fkey" 
      FOREIGN KEY ("reviewedById") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
  {
    name: 'audit_logs_userId_fkey',
    table: 'audit_logs',
    sql: `
      ALTER TABLE "audit_logs" 
      DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "audit_logs_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
  },
];

async function applyFks(db) {
  console.log(`\n======================================================`);
  console.log(`Connecting Database Schema Relationships: ${db.name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: db.url });
  await client.connect();

  try {
    for (const fk of foreignKeys) {
      try {
        await client.query(fk.sql);
        console.log(`  ✓ Added Foreign Key: ${fk.name} on ${fk.table}`);
      } catch (err) {
        console.error(`  ⚠️ Error adding ${fk.name}:`, err.message);
      }
    }

    // Reload PostgREST schema cache so Supabase visualizer updates instantly
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log(`  ✓ PostgREST schema reloaded on ${db.name}`);
  } finally {
    await client.end();
  }
}

(async () => {
  for (const db of databases) {
    await applyFks(db);
  }
  console.log(`\n🎉 Successfully connected all database schema relationships on both databases!`);
})();
