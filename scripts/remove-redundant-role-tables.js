const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'DB 1 (qoxpqhvecjxlsbsshxsm - Primary)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'DB 2 (goxvhkbwfpffjnqphzpq - Secondary)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

async function migrateDatabase(db) {
  console.log(`\n======================================================`);
  console.log(`🚀 Migrating Database: ${db.name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: db.url });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Drop existing FK constraints pointing to role tables
    console.log('1. Dropping old role FK constraints...');
    const dropConstraintsSql = `
      ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_facultyId_fkey";
      ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_instructorId_fkey";
      ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_reviewedByUserId_fkey";
      ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_studentId_fkey";
    `;
    await client.query(dropConstraintsSql);

    // 2. Drop redundant tables
    console.log('2. Dropping redundant tables (department_heads, faculty, students)...');
    const dropTablesSql = `
      DROP TABLE IF EXISTS "department_heads" CASCADE;
      DROP TABLE IF EXISTS "faculty" CASCADE;
      DROP TABLE IF EXISTS "students" CASCADE;
    `;
    await client.query(dropTablesSql);

    // 3. Add direct FK constraints to admin(id)
    console.log('3. Establishing direct foreign keys to admin(id)...');
    const addFksSql = `
      ALTER TABLE "courses"
        ADD CONSTRAINT "courses_facultyId_fkey"
        FOREIGN KEY ("facultyId") REFERENCES "admin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

      ALTER TABLE "syllabi"
        ADD CONSTRAINT "syllabi_instructorId_fkey"
        FOREIGN KEY ("instructorId") REFERENCES "admin"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "syllabi"
        ADD CONSTRAINT "syllabi_reviewedByUserId_fkey"
        FOREIGN KEY ("reviewedByUserId") REFERENCES "admin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

      ALTER TABLE "enrollments"
        ADD CONSTRAINT "enrollments_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "admin"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    await client.query(addFksSql);

    // 4. Ensure RLS on all 6 remaining tables
    console.log('4. Verifying RLS on remaining tables...');
    const coreTables = ['admin', 'courses', 'enrollments', 'syllabi', 'syllabus_versions', 'audit_logs'];
    for (const t of coreTables) {
      await client.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS "permit_all_${t}" ON "${t}";`);
      await client.query(`CREATE POLICY "permit_all_${t}" ON "${t}" FOR ALL USING (true) WITH CHECK (true);`);
    }

    await client.query('COMMIT');
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log(`✅ Successfully migrated ${db.name}!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed on ${db.name}:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

(async () => {
  for (const db of databases) {
    await migrateDatabase(db);
  }
  console.log('\n🎉 ALL DATABASES MIGRATED AND SYNCED SUCCESSFULLY!');
})();
