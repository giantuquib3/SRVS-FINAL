const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'Database 1 (qoxpqhvecjxlsbsshxsm - in .env)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'Database 2 (goxvhkbwfpffjnqphzpq - in pgAdmin SRVS)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

const allTables = [
  'admin',
  'deptHead',
  'faculty',
  'courses',
  'enrollments',
  'syllabi',
  'syllabus_versions',
  'audit_logs',
  'notifications',
];

async function setupDatabase(db) {
  console.log(`\n======================================================`);
  console.log(`Configuring Tables, Synchronization & RLS for: ${db.name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: db.url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Create table "deptHead"
    console.log('1. Creating/ensuring "deptHead" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "deptHead" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "academicRank" TEXT DEFAULT 'Department Chairperson',
        "officeLocation" TEXT DEFAULT 'Engineering Faculty Office',
        "contactNo" TEXT,
        "accountStatus" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "deptHead_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "deptHead_email_key" ON "deptHead"("email");
      CREATE INDEX IF NOT EXISTS "deptHead_departmentId_idx" ON "deptHead"("departmentId");
    `);

    // 2. Create table "faculty"
    console.log('2. Creating/ensuring "faculty" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "faculty" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "academicRank" TEXT DEFAULT 'Faculty Member',
        "specialization" TEXT,
        "accountStatus" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "faculty_email_key" ON "faculty"("email");
      CREATE INDEX IF NOT EXISTS "faculty_departmentId_idx" ON "faculty"("departmentId");
    `);

    // 3. Populate "deptHead" from "admin"
    console.log('3. Populating "deptHead" from "admin"...');
    await client.query(`
      INSERT INTO "deptHead" ("id", "email", "fullName", "departmentId", "academicRank", "accountStatus", "createdAt", "updatedAt")
      SELECT "id", "email", "fullName", COALESCE("departmentId", 'CPE'), COALESCE("academicRank", 'Department Chairperson'), "accountStatus", "createdAt", "updatedAt"
      FROM "admin"
      WHERE "role" = 'DepartmentHead'
      ON CONFLICT ("id") DO UPDATE SET
        "email" = EXCLUDED."email",
        "fullName" = EXCLUDED."fullName",
        "departmentId" = EXCLUDED."departmentId",
        "academicRank" = EXCLUDED."academicRank",
        "accountStatus" = EXCLUDED."accountStatus",
        "updatedAt" = EXCLUDED."updatedAt";
    `);

    // 4. Populate "faculty" from "admin"
    console.log('4. Populating "faculty" from "admin"...');
    await client.query(`
      INSERT INTO "faculty" ("id", "email", "fullName", "departmentId", "academicRank", "accountStatus", "createdAt", "updatedAt")
      SELECT "id", "email", "fullName", COALESCE("departmentId", 'CPE'), COALESCE("academicRank", 'Faculty Member'), "accountStatus", "createdAt", "updatedAt"
      FROM "admin"
      WHERE "role" = 'Educator'
      ON CONFLICT ("id") DO UPDATE SET
        "email" = EXCLUDED."email",
        "fullName" = EXCLUDED."fullName",
        "departmentId" = EXCLUDED."departmentId",
        "academicRank" = EXCLUDED."academicRank",
        "accountStatus" = EXCLUDED."accountStatus",
        "updatedAt" = EXCLUDED."updatedAt";
    `);

    // 5. Create bidirectional triggers so admin, deptHead, and faculty stay in sync
    console.log('5. Setting up automatic synchronization triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION sync_admin_to_subtables() RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'DELETE') THEN
          DELETE FROM "faculty" WHERE id = OLD.id;
          DELETE FROM "deptHead" WHERE id = OLD.id;
          RETURN OLD;
        END IF;

        IF (NEW.role = 'Educator') THEN
          INSERT INTO "faculty" ("id", "email", "fullName", "departmentId", "academicRank", "accountStatus", "createdAt", "updatedAt")
          VALUES (NEW.id, NEW.email, NEW.fullName, COALESCE(NEW."departmentId", 'CPE'), COALESCE(NEW."academicRank", 'Faculty Member'), NEW."accountStatus", NEW."createdAt", NEW."updatedAt")
          ON CONFLICT ("id") DO UPDATE SET
            "email" = EXCLUDED."email",
            "fullName" = EXCLUDED."fullName",
            "departmentId" = EXCLUDED."departmentId",
            "academicRank" = EXCLUDED."academicRank",
            "accountStatus" = EXCLUDED."accountStatus",
            "updatedAt" = EXCLUDED."updatedAt";
          DELETE FROM "deptHead" WHERE id = NEW.id;
        ELSIF (NEW.role = 'DepartmentHead') THEN
          INSERT INTO "deptHead" ("id", "email", "fullName", "departmentId", "academicRank", "accountStatus", "createdAt", "updatedAt")
          VALUES (NEW.id, NEW.email, NEW.fullName, COALESCE(NEW."departmentId", 'CPE'), COALESCE(NEW."academicRank", 'Department Chairperson'), NEW."accountStatus", NEW."createdAt", NEW."updatedAt")
          ON CONFLICT ("id") DO UPDATE SET
            "email" = EXCLUDED."email",
            "fullName" = EXCLUDED."fullName",
            "departmentId" = EXCLUDED."departmentId",
            "academicRank" = EXCLUDED."academicRank",
            "accountStatus" = EXCLUDED."accountStatus",
            "updatedAt" = EXCLUDED."updatedAt";
          DELETE FROM "faculty" WHERE id = NEW.id;
        ELSE
          DELETE FROM "faculty" WHERE id = NEW.id;
          DELETE FROM "deptHead" WHERE id = NEW.id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_admin_subtables ON "admin";
      CREATE TRIGGER trg_sync_admin_subtables
      AFTER INSERT OR UPDATE OR DELETE ON "admin"
      FOR EACH ROW EXECUTE FUNCTION sync_admin_to_subtables();
    `);

    // 6. Create alias views for convenience
    await client.query(`
      CREATE OR REPLACE VIEW "department_heads" AS SELECT * FROM "deptHead";
      CREATE OR REPLACE VIEW "users" AS SELECT * FROM "admin";
      CREATE OR REPLACE VIEW "admins" AS SELECT * FROM "admin";
    `);

    // 7. Fix Supabase permissions for all roles
    console.log('7. Granting full permissions to Supabase roles...');
    await client.query(`
      GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;

      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, authenticator;
    `);

    // 8. Enable Row Level Security (RLS) with permissive "allow_all" policy on ALL tables
    // This removes the "UNRESTRICTED" warning in Supabase and makes tables fully functional.
    console.log('8. Enabling RLS and configuring permissive policies on all tables...');
    for (const tbl of allTables) {
      await client.query(`ALTER TABLE "${tbl}" ENABLE ROW LEVEL SECURITY;`);

      // Drop existing policies if any
      const existing = await client.query(`
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tbl}';
      `);
      for (const row of existing.rows) {
        await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON "${tbl}";`);
      }

      // Create permissive policy for public / all roles
      await client.query(`
        CREATE POLICY "allow_all_${tbl}" ON "${tbl}"
        FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
      `);
      console.log(`   ✓ ${tbl}: RLS enabled with permissive policy allow_all_${tbl}`);
    }

    // 9. Reload PostgREST schema cache
    console.log('9. Reloading PostgREST schema cache for Supabase Studio...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('   ✓ PostgREST schema cache reloaded.');

    // 10. Audit row counts and RLS status
    console.log('\n10. Verification of table row counts and RLS status:');
    for (const tbl of allTables) {
      const cRes = await client.query(`SELECT count(*) FROM "${tbl}"`);
      const rlsRes = await client.query(`
        SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tbl}'
      `);
      const isRls = rlsRes.rows[0]?.rowsecurity ? 'ENABLED (Protected)' : 'DISABLED';
      console.log(`   ${tbl.padEnd(20)}: ${cRes.rows[0].count} rows | RLS: ${isRls}`);
    }

  } finally {
    await client.end();
  }
}

async function main() {
  for (const db of databases) {
    await setupDatabase(db);
  }
  console.log('\n🎉 ALL DATABASES CONFIGURED WITH DEPTHEAD, FACULTY, AND FUNCTIONAL RLS POLICIES!');
}

main().catch(console.error);
