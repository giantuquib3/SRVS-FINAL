const { Client } = require('pg');

const databases = [
  {
    name: 'Database 1 (qoxpqhvecjxlsbsshxsm - in .env)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  },
  {
    name: 'Database 2 (goxvhkbwfpffjnqphzpq - in pgAdmin SRVS)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  },
];

async function setupRoleTables(db) {
  console.log(`\n======================================================`);
  console.log(`Setting up Department Head, Faculty & Student tables: ${db.name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: db.url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Drop existing FKs pointing to admin that will now point to specific role tables
    console.log('1. Dropping old foreign keys to re-bind to specific role tables...');
    await client.query(`ALTER TABLE IF EXISTS "courses" DROP CONSTRAINT IF EXISTS "courses_facultyId_fkey";`);
    await client.query(`ALTER TABLE IF EXISTS "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_instructorId_fkey";`);
    await client.query(`ALTER TABLE IF EXISTS "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_reviewedByUserId_fkey";`);
    await client.query(`ALTER TABLE IF EXISTS "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_studentId_fkey";`);

    // 2. Create department_heads table
    console.log('2. Creating "department_heads" table with INTEGER id...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "department_heads" (
        "id" INTEGER NOT NULL,
        "fullName" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "departmentId" TEXT NOT NULL,
        "academicRank" TEXT DEFAULT 'Department Chairperson',
        "officeLocation" TEXT DEFAULT 'Engineering Faculty Office',
        "contactNo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "department_heads_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "department_heads_id_fkey" FOREIGN KEY ("id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "department_heads_departmentId_idx" ON "department_heads"("departmentId");
    `);

    // 3. Create faculty table
    console.log('3. Creating "faculty" table with INTEGER id...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "faculty" (
        "id" INTEGER NOT NULL,
        "fullName" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "departmentId" TEXT NOT NULL,
        "academicRank" TEXT DEFAULT 'Faculty Member',
        "specialization" TEXT,
        "officeLocation" TEXT DEFAULT 'Engineering Faculty Office',
        "contactNo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "faculty_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "faculty_id_fkey" FOREIGN KEY ("id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "faculty_departmentId_idx" ON "faculty"("departmentId");
    `);

    // 4. Create students table
    console.log('4. Creating "students" table with INTEGER id...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "students" (
        "id" INTEGER NOT NULL,
        "fullName" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "departmentId" TEXT NOT NULL,
        "yearLevel" TEXT DEFAULT '1st Year',
        "accountStatus" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "students_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "students_departmentId_idx" ON "students"("departmentId");
    `);

    // 5. Populate department_heads from admin
    console.log('5. Populating "department_heads" from admin table...');
    await client.query(`
      INSERT INTO "department_heads" ("id", "fullName", "email", "departmentId", "academicRank", "officeLocation", "createdAt", "updatedAt")
      SELECT 
        "id", 
        "fullName", 
        "email", 
        COALESCE("departmentId", 'CPE'), 
        COALESCE("academicRank", 'Department Chairperson'), 
        'Engineering Faculty Office',
        "createdAt", 
        "updatedAt"
      FROM "admin"
      WHERE "role" = 'DepartmentHead'
      ON CONFLICT ("id") DO UPDATE
      SET "fullName" = EXCLUDED."fullName",
          "email" = EXCLUDED."email",
          "departmentId" = EXCLUDED."departmentId";
    `);

    // 6. Populate faculty from admin
    console.log('6. Populating "faculty" from admin table...');
    await client.query(`
      INSERT INTO "faculty" ("id", "fullName", "email", "departmentId", "academicRank", "specialization", "officeLocation", "createdAt", "updatedAt")
      SELECT 
        "id", 
        "fullName", 
        "email", 
        COALESCE("departmentId", 'CPE'), 
        COALESCE("academicRank", 'Faculty Member'),
        CASE 
          WHEN "departmentId" = 'CPE' THEN 'Computer Systems & Software Engineering'
          WHEN "departmentId" = 'EE' THEN 'Power & Energy Systems'
          WHEN "departmentId" = 'CE' THEN 'Structural & Geotechnical Engineering'
          WHEN "departmentId" = 'ECE' THEN 'Communications & Electronics'
          ELSE 'General Engineering'
        END,
        'Engineering Faculty Office',
        "createdAt", 
        "updatedAt"
      FROM "admin"
      WHERE "role" = 'Educator'
      ON CONFLICT ("id") DO UPDATE
      SET "fullName" = EXCLUDED."fullName",
          "email" = EXCLUDED."email",
          "departmentId" = EXCLUDED."departmentId";
    `);

    // 7. Populate students from admin
    console.log('7. Populating "students" from admin table...');
    await client.query(`
      INSERT INTO "students" ("id", "fullName", "email", "departmentId", "yearLevel", "accountStatus", "createdAt", "updatedAt")
      SELECT 
        "id", 
        "fullName", 
        "email", 
        COALESCE("departmentId", 'CPE'), 
        COALESCE("yearLevel", '1st Year'),
        COALESCE("accountStatus", 'Active'),
        "createdAt", 
        "updatedAt"
      FROM "admin"
      WHERE "role" = 'Student'
      ON CONFLICT ("id") DO UPDATE
      SET "fullName" = EXCLUDED."fullName",
          "email" = EXCLUDED."email",
          "departmentId" = EXCLUDED."departmentId";
    `);

    // Ensure any students present in enrollments also exist in students table
    await client.query(`
      INSERT INTO "students" ("id", "fullName", "email", "departmentId", "yearLevel", "accountStatus")
      SELECT DISTINCT 
        e."studentId", 
        e."studentName", 
        CONCAT('student', e."studentId", '@usjr.edu.ph'), 
        COALESCE(c."departmentId", 'CPE'), 
        '1st Year', 
        'Active'
      FROM "enrollments" e
      LEFT JOIN "courses" c ON e."courseId" = c."id"
      WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = e."studentId")
      ON CONFLICT ("id") DO NOTHING;
    `);

    // 8. Establish Relational Foreign Keys
    console.log('8. Binding relational foreign keys...');
    
    // courses.facultyId -> faculty.id
    await client.query(`
      ALTER TABLE "courses"
      ADD CONSTRAINT "courses_facultyId_fkey"
      FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // enrollments.studentId -> students.id
    await client.query(`
      ALTER TABLE "enrollments"
      ADD CONSTRAINT "enrollments_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi.instructorId -> faculty.id
    await client.query(`
      ALTER TABLE "syllabi"
      ADD CONSTRAINT "syllabi_instructorId_fkey"
      FOREIGN KEY ("instructorId") REFERENCES "faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi.reviewedByUserId -> department_heads.id
    await client.query(`
      ALTER TABLE "syllabi"
      ADD CONSTRAINT "syllabi_reviewedByUserId_fkey"
      FOREIGN KEY ("reviewedByUserId") REFERENCES "department_heads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // 9. Configure RLS Policies
    console.log('9. Configuring Row Level Security on role tables...');
    for (const table of ['department_heads', 'faculty', 'students']) {
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS "${table}_allow_all" ON "${table}";`);
      await client.query(`
        CREATE POLICY "${table}_allow_all" ON "${table}"
        FOR ALL TO public
        USING (true)
        WITH CHECK (true);
      `);
    }

    // 10. Reload PostgREST schema cache
    console.log('10. Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);

    // Verify row counts
    const { rows: dhCount } = await client.query(`SELECT count(*) FROM "department_heads"`);
    const { rows: facCount } = await client.query(`SELECT count(*) FROM "faculty"`);
    const { rows: studCount } = await client.query(`SELECT count(*) FROM "students"`);
    console.log(`✓ Verification on ${db.name}:`);
    console.log(`  - department_heads: ${dhCount[0].count} rows`);
    console.log(`  - faculty:          ${facCount[0].count} rows`);
    console.log(`  - students:         ${studCount[0].count} rows`);

  } finally {
    await client.end();
  }
}

async function main() {
  for (const db of databases) {
    await setupRoleTables(db);
  }
  console.log('\n======================================================');
  console.log('🎉 ALL ROLE TABLES AND RELATIONSHIPS CREATED ON BOTH DATABASES!');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
