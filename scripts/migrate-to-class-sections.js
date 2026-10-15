/**
 * Migration: introduce `class_sections` and convert `enrollments` into a
 * Student <-> ClassSection junction table (Option B).
 *
 * Data preserving:
 *   1. Backs up enrollments, syllabi and subjects to scripts/backups/*.json
 *   2. Creates class_sections from every distinct (subject, academicYear, semester, section)
 *      found in syllabi + enrollments. Instructor is taken from the syllabus author, otherwise
 *      from a faculty user whose fullName matches subjects.professorName.
 *   3. Adds enrollments.id (SERIAL PK) + enrollments.classSectionId and backfills it.
 *   4. Drops the old denormalized enrollment columns (studentName, subjectId, semester, academicYear, section).
 *   5. Adds syllabi.classSectionId and backfills it.
 * Everything from step 2 onwards runs in a single transaction (all-or-nothing).
 *
 * Usage: node scripts/migrate-to-class-sections.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    table,
    column
  );
  return rows.length > 0;
}

async function main() {
  if (!(await columnExists('enrollments', 'subjectId'))) {
    console.log('✓ enrollments.subjectId no longer exists — migration already applied. Nothing to do.');
    return;
  }

  // ── 1. Backup ──────────────────────────────────────────────────────────────
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const table of ['enrollments', 'syllabi', 'subjects']) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    const file = path.join(backupDir, `${table}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    console.log(`✓ Backed up ${rows.length} ${table} rows → ${path.relative(process.cwd(), file)}`);
  }

  const before = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM enrollments`);

  // ── 2-5. Schema + data changes in one transaction ─────────────────────────
  const statements = [
    // class_sections table
    `CREATE TABLE "class_sections" (
       "id" SERIAL NOT NULL,
       "subjectId" INTEGER NOT NULL,
       "instructorId" INTEGER,
       "academicYear" TEXT NOT NULL,
       "semester" TEXT NOT NULL,
       "section" TEXT NOT NULL DEFAULT 'A',
       "capacity" INTEGER NOT NULL DEFAULT 40,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL,
       CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
     )`,
    `CREATE UNIQUE INDEX "class_sections_subjectId_academicYear_semester_section_key"
       ON "class_sections"("subjectId", "academicYear", "semester", "section")`,
    `CREATE INDEX "class_sections_instructorId_idx" ON "class_sections"("instructorId")`,
    `ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_subjectId_fkey"
       FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_instructorId_fkey"
       FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

    // Sections from syllabi first (instructor = syllabus author)
    `INSERT INTO "class_sections" ("subjectId", "academicYear", "semester", "section", "instructorId", "updatedAt")
     SELECT DISTINCT ON ("subjectId", "academicYear", "semester", "section")
            "subjectId", "academicYear", "semester", "section", "instructorId", CURRENT_TIMESTAMP
       FROM "syllabi"
      ORDER BY "subjectId", "academicYear", "semester", "section", "updatedAt" DESC
     ON CONFLICT DO NOTHING`,

    // Then sections from enrollments (instructor = faculty matching subjects.professorName, if any)
    `INSERT INTO "class_sections" ("subjectId", "academicYear", "semester", "section", "instructorId", "updatedAt")
     SELECT DISTINCT e."subjectId", e."academicYear", e."semester", e."section",
            (SELECT u."id" FROM "users" u
              WHERE u."role" IN ('Educator', 'DepartmentHead')
                AND lower(trim(u."fullName")) = lower(trim(s."professorName"))
              ORDER BY u."id" LIMIT 1),
            CURRENT_TIMESTAMP
       FROM "enrollments" e
       JOIN "subjects" s ON s."id" = e."subjectId"
     ON CONFLICT DO NOTHING`,

    // Enrollments: new surrogate PK + classSectionId
    `ALTER TABLE "enrollments" ADD COLUMN "classSectionId" INTEGER`,
    `UPDATE "enrollments" e SET "classSectionId" = cs."id"
       FROM "class_sections" cs
      WHERE cs."subjectId" = e."subjectId" AND cs."academicYear" = e."academicYear"
        AND cs."semester" = e."semester" AND cs."section" = e."section"`,
    `ALTER TABLE "enrollments" ALTER COLUMN "classSectionId" SET NOT NULL`,
    `ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_pkey"`,
    `ALTER TABLE "enrollments" ADD COLUMN "id" SERIAL NOT NULL`,
    `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")`,
    `ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_subjectId_fkey"`,
    `DROP INDEX IF EXISTS "enrollments_subjectId_idx"`,
    `DROP INDEX IF EXISTS "enrollments_studentId_idx"`,
    `ALTER TABLE "enrollments"
       DROP COLUMN "studentName",
       DROP COLUMN "subjectId",
       DROP COLUMN "semester",
       DROP COLUMN "academicYear",
       DROP COLUMN "section"`,
    `CREATE UNIQUE INDEX "enrollments_studentId_classSectionId_key" ON "enrollments"("studentId", "classSectionId")`,
    `CREATE INDEX "enrollments_classSectionId_idx" ON "enrollments"("classSectionId")`,
    `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_classSectionId_fkey"
       FOREIGN KEY ("classSectionId") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

    // Syllabi: link to class section
    `ALTER TABLE "syllabi" ADD COLUMN "classSectionId" INTEGER`,
    `UPDATE "syllabi" sy SET "classSectionId" = cs."id"
       FROM "class_sections" cs
      WHERE cs."subjectId" = sy."subjectId" AND cs."academicYear" = sy."academicYear"
        AND cs."semester" = sy."semester" AND cs."section" = sy."section"`,
    `CREATE INDEX "syllabi_classSectionId_idx" ON "syllabi"("classSectionId")`,
    `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_classSectionId_fkey"
       FOREIGN KEY ("classSectionId") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  ];

  await prisma.$transaction(statements.map((sql) => prisma.$executeRawUnsafe(sql)));

  const [after] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM enrollments)::int AS enrollments,
            (SELECT count(*) FROM class_sections)::int AS class_sections,
            (SELECT count(*) FROM class_sections WHERE "instructorId" IS NOT NULL)::int AS sections_with_instructor,
            (SELECT count(*) FROM syllabi WHERE "classSectionId" IS NOT NULL)::int AS linked_syllabi`
  );
  console.log('\n✓ Migration complete');
  console.log(`  Enrollments before/after : ${before[0].n} / ${after.enrollments}`);
  console.log(`  Class sections created   : ${after.class_sections} (${after.sections_with_instructor} with instructor)`);
  console.log(`  Syllabi linked to section: ${after.linked_syllabi}`);
  if (before[0].n !== after.enrollments) throw new Error('Enrollment row count changed — investigate!');
}

main()
  .catch((e) => {
    console.error('✗ Migration failed (transaction rolled back):', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
