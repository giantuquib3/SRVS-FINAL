/**
 * Migration: add status / academicYear / semester / enrolledById to student_subjects
 * (prisma/sql/student-subjects-columns.sql).
 *
 *   1. Backs up student_subjects to scripts/backups/*.json
 *   2. Runs the SQL and restores each existing row's academic year / semester / status from the
 *      enrollments + class_sections backup taken when class sections were removed.
 *   3. Verifies the row count is unchanged before committing (one transaction).
 *
 * Usage: node scripts/migrate-student-subjects-columns.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const BACKUP_STAMP = '2026-10-22T18-13-32-331Z'; // backup written by migrate-to-student-subjects.js

/** Splits the SQL file into statements (no function bodies in this file). */
function splitSql(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));
}

/** (studentId, subjectId) -> { academicYear, semester, status } from the pre-migration backup. */
function termsFromBackup() {
  const dir = path.join(__dirname, 'backups');
  const enrFile = path.join(dir, `enrollments-${BACKUP_STAMP}.json`);
  const csFile = path.join(dir, `class_sections-${BACKUP_STAMP}.json`);
  if (!fs.existsSync(enrFile) || !fs.existsSync(csFile)) {
    console.log('⚠ Class-section backup not found — existing rows keep the column defaults.');
    return [];
  }
  const sections = Object.fromEntries(JSON.parse(fs.readFileSync(csFile, 'utf8')).map((c) => [c.id, c]));
  return JSON.parse(fs.readFileSync(enrFile, 'utf8'))
    .map((e) => ({ e, cs: sections[e.classSectionId] }))
    .filter(({ cs }) => cs)
    .map(({ e, cs }) => ({
      studentId: e.studentId,
      subjectId: cs.subjectId,
      academicYear: cs.academicYear,
      semester: cs.semester,
      status: String(e.status || 'ENROLLED').toUpperCase(),
    }));
}

async function main() {
  const [{ exists }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS exists FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'student_subjects' AND column_name = 'enrolledById'`
  );
  if (exists) {
    console.log('✓ student_subjects already has the new columns — nothing to do.');
    return;
  }

  // ── 1. Backup ──────────────────────────────────────────────────────────────
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM student_subjects ORDER BY id`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(__dirname, 'backups', `student_subjects-${stamp}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  console.log(`✓ Backed up ${rows.length} student_subjects rows → ${path.relative(process.cwd(), file)}`);

  const terms = termsFromBackup();
  const statements = splitSql(fs.readFileSync(path.join(__dirname, '..', 'prisma', 'sql', 'student-subjects-columns.sql'), 'utf8'));

  // ── 2. Apply + backfill + verify in one transaction ─────────────────────────
  let restored = 0;
  await prisma.$transaction(async (tx) => {
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
    for (const t of terms) {
      restored += await tx.$executeRawUnsafe(
        `UPDATE student_subjects SET "academicYear" = $1, "semester" = $2, "status" = $3
          WHERE "studentId" = $4 AND "subjectId" = $5`,
        t.academicYear, t.semester, t.status, t.studentId, t.subjectId
      );
    }
    const [after] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM student_subjects`);
    if (after.n !== rows.length) throw new Error(`Row count changed (${rows.length} → ${after.n}) — rolling back.`);
  }, { timeout: 120000 });

  console.log(`✓ Applied ${statements.length} statements; restored the term of ${restored} existing row(s) from the backup`);

  const summary = await prisma.$queryRawUnsafe(
    `SELECT "academicYear", semester, status, count(*)::int AS n FROM student_subjects GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`
  );
  console.table(summary);
  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'student_subjects' ORDER BY ordinal_position`
  );
  console.table(columns);
  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname AS "constraint", pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE conrelid = 'public.student_subjects'::regclass ORDER BY 1`
  );
  console.table(constraints);
  console.log('✓ Migration complete');
}

main()
  .catch((e) => {
    console.error('✗ Migration failed (transaction rolled back):', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
