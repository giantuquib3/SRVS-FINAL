/**
 * Migration: replace class_sections + enrollments with student_subjects
 * (prisma/sql/student-subjects.sql).
 *
 *   1. Backs up enrollments, class_sections and syllabi to scripts/backups/*.json
 *   2. Pre-check (read-only): aborts — without changing anything — if the existing
 *      enrollments cannot be copied 1:1 into student_subjects.
 *   3. Runs the SQL in a single transaction and verifies the copied row count
 *      BEFORE committing; any mismatch rolls everything back.
 *
 * Usage: node scripts/migrate-to-student-subjects.js [--check]   (--check = pre-check only)
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use the direct (non-pgbouncer) connection for DDL when available.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

/** Splits the SQL file into statements, keeping $fn$ ... $fn$ function bodies intact. */
function splitSql(sql) {
  const withoutComments = sql.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
  const statements = [];
  let current = '';
  for (const line of withoutComments.split('\n')) {
    current += line + '\n';
    const dollarQuotes = (current.match(/\$fn\$/g) || []).length;
    if (/;\s*(--.*)?$/.test(line) && dollarQuotes % 2 === 0) {
      const stmt = current.trim().replace(/;\s*(--.*)?$/, '');
      if (stmt && !/^(BEGIN|COMMIT)$/i.test(stmt)) statements.push(stmt);
      current = '';
    }
  }
  if (current.trim()) throw new Error('Unterminated SQL statement at end of file');
  return statements;
}

async function tableExists(name) {
  const [row] = await prisma.$queryRawUnsafe(`SELECT to_regclass($1)::text AS t`, `public.${name}`);
  return row.t !== null;
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  if ((await tableExists('student_subjects')) && !(await tableExists('enrollments'))) {
    console.log('✓ student_subjects exists and enrollments is gone — migration already applied. Nothing to do.');
    return;
  }
  if (await tableExists('student_subjects')) {
    throw new Error('Both student_subjects and enrollments exist — inspect the database manually before continuing.');
  }

  // ── 1. Pre-check ────────────────────────────────────────────────────────────
  const problems = [];
  const [counts] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM enrollments)::int AS enrollments,
            (SELECT count(*) FROM class_sections)::int AS class_sections,
            (SELECT count(*) FROM syllabi WHERE "classSectionId" IS NOT NULL)::int AS syllabi_linked,
            (SELECT count(*) FROM (SELECT DISTINCT e."studentId", cs."subjectId"
                                     FROM enrollments e JOIN class_sections cs ON cs.id = e."classSectionId") x)::int AS pairs`
  );
  console.log('── Current data ──');
  console.log(`  enrollments: ${counts.enrollments}, class_sections: ${counts.class_sections}, syllabi linked to a section: ${counts.syllabi_linked}`);
  console.log(`  distinct (student, subject) pairs to copy: ${counts.pairs}`);

  const statuses = await prisma.$queryRawUnsafe(`SELECT status, count(*)::int AS n FROM enrollments GROUP BY 1 ORDER BY 2 DESC`);
  console.log(`  enrollment statuses: ${statuses.map((s) => `${s.status} × ${s.n}`).join(', ') || 'none'}`);
  const nonEnrolled = statuses.filter((s) => s.status !== 'ENROLLED').reduce((sum, s) => sum + s.n, 0);
  if (nonEnrolled) console.log(`  ⚠ ${nonEnrolled} non-ENROLLED row(s) will become plain associations (status is not kept; see backup)`);

  console.log('\n── Checks ──');
  const orphans = await prisma.$queryRawUnsafe(
    `SELECT e.id FROM enrollments e LEFT JOIN class_sections cs ON cs.id = e."classSectionId" WHERE cs.id IS NULL`
  );
  console.log(`  Enrollments without a class section: ${orphans.length ? '✗ ' + orphans.length : '✓ none'}`);
  if (orphans.length) problems.push(`${orphans.length} enrollment(s) reference a missing class section`);

  const dupes = await prisma.$queryRawUnsafe(
    `SELECT e."studentId", cs."subjectId", count(*)::int AS n
       FROM enrollments e JOIN class_sections cs ON cs.id = e."classSectionId"
      GROUP BY 1, 2 HAVING count(*) > 1`
  );
  console.log(`  Student enrolled in the same subject more than once: ${dupes.length ? `⚠ ${dupes.length} (merged into one row each)` : '✓ none'}`);
  if (dupes.length) console.table(dupes);

  const nonStudents = await prisma.$queryRawUnsafe(
    `SELECT e."studentId", u.role FROM enrollments e JOIN users u ON u.id = e."studentId" WHERE u.role <> 'Student'`
  );
  console.log(`  Enrollees who are not Students: ${nonStudents.length ? '✗ ' + nonStudents.length : '✓ none'}`);
  if (nonStudents.length) problems.push(`${nonStudents.length} enrollment(s) belong to non-Student users`);

  if (problems.length) {
    console.error('\n✗ Pre-check failed — nothing was changed:');
    for (const p of problems) console.error(`  • ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Pre-check passed.');
  if (checkOnly) return;

  // ── 2. Backup ───────────────────────────────────────────────────────────────
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const table of ['enrollments', 'class_sections', 'syllabi']) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    const file = path.join(backupDir, `${table}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    console.log(`✓ Backed up ${rows.length} ${table} rows → ${path.relative(process.cwd(), file)}`);
  }

  // ── 3. Apply + verify in one transaction ───────────────────────────────────
  const statements = splitSql(fs.readFileSync(path.join(__dirname, '..', 'prisma', 'sql', 'student-subjects.sql'), 'utf8'));
  await prisma.$transaction(async (tx) => {
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
    const [after] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM student_subjects`);
    if (after.n !== counts.pairs) {
      throw new Error(`student_subjects has ${after.n} rows, expected ${counts.pairs} — rolling back.`);
    }
  }, { timeout: 120000 });
  console.log(`\n✓ Applied ${statements.length} statements from prisma/sql/student-subjects.sql`);

  const [result] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM student_subjects)::int AS student_subjects,
            to_regclass('public.enrollments')::text AS enrollments_table,
            to_regclass('public.class_sections')::text AS class_sections_table,
            (SELECT count(*) FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'syllabi' AND column_name = 'classSectionId')::int AS syllabi_classSectionId`
  );
  console.log(`  student_subjects rows        : ${result.student_subjects} (expected ${counts.pairs})`);
  console.log(`  enrollments table            : ${result.enrollments_table ?? 'dropped'}`);
  console.log(`  class_sections table         : ${result.class_sections_table ?? 'dropped'}`);
  console.log(`  syllabi.classSectionId column: ${result.syllabi_classSectionId ? 'still present' : 'dropped'}`);

  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname AS "constraint", pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE conrelid = 'public.student_subjects'::regclass ORDER BY 1`
  );
  console.log('\n  student_subjects constraints:');
  console.table(constraints);
  console.log('\n✓ Migration complete');
}

main()
  .catch((e) => {
    console.error('✗ Migration failed (transaction rolled back):', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
