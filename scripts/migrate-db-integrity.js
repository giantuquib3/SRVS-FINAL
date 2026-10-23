/**
 * Migration: database integrity rules (prisma/sql/db-integrity.sql).
 *
 *   1. Backs up syllabi, syllabus_versions and users(id, role, accountStatus)
 *      to scripts/backups/*.json
 *   2. Pre-check (read-only): reports how statuses will be normalized and aborts — without
 *      changing anything — if existing data would violate the new constraints.
 *   3. Runs prisma/sql/db-integrity.sql in a single transaction (all-or-nothing):
 *      status normalization and CHECK constraints.
 *
 * Idempotent: running it again just re-applies the same constraints.
 *
 * Usage: node scripts/migrate-db-integrity.js [--check]   (--check = pre-check only)
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use the direct (non-pgbouncer) connection for DDL when available.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const SYLLABUS_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];
const ROLES = ['Admin', 'DepartmentHead', 'Educator', 'Student'];
const ACCOUNT_STATUSES = ['Active', 'PendingApproval', 'Rejected', 'Deactivated'];
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

/** Mirrors the CASE expression in db-integrity.sql. */
function normalizeSyllabusStatus(value) {
  const s = String(value ?? '').trim().toUpperCase();
  return { ACTIVE: 'APPROVED', PENDING: 'SUBMITTED', PENDING_APPROVAL: 'SUBMITTED', 'UNDER REVIEW': 'UNDER_REVIEW' }[s] || s;
}

/** Splits the SQL file into statements, keeping $fn$ ... $fn$ function bodies intact. */
function splitSql(sql) {
  const withoutComments = sql.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
  const statements = [];
  let current = '';
  for (const line of withoutComments.split('\n')) {
    current += line + '\n';
    const dollarQuotes = (current.match(/\$fn\$/g) || []).length;
    if (/;\s*$/.test(line) && dollarQuotes % 2 === 0) {
      const stmt = current.trim().replace(/;\s*$/, '');
      if (stmt && !/^(BEGIN|COMMIT)$/i.test(stmt)) statements.push(stmt);
      current = '';
    }
  }
  if (current.trim()) throw new Error('Unterminated SQL statement at end of file');
  return statements;
}

async function distribution(table, column) {
  return prisma.$queryRawUnsafe(
    `SELECT "${column}" AS value, count(*)::int AS n FROM "${table}" GROUP BY "${column}" ORDER BY 2 DESC`
  );
}

async function preCheck() {
  const problems = [];

  console.log('── Status normalization preview ──');
  for (const [table, column] of [['syllabi', 'status'], ['syllabus_versions', 'approvalStatus'], ['syllabus_versions', 'statusAtSave']]) {
    for (const { value, n } of await distribution(table, column)) {
      const to = normalizeSyllabusStatus(value);
      const note = !SYLLABUS_STATUSES.includes(to) ? '  ✗ NOT ALLOWED' : to !== value ? `  → ${to}` : '';
      console.log(`  ${table}.${column}: ${JSON.stringify(value)} × ${n}${note}`);
      if (!SYLLABUS_STATUSES.includes(to)) problems.push(`${table}.${column} has ${n} row(s) with unknown value ${JSON.stringify(value)}`);
    }
  }

  console.log('\n── Value checks ──');
  const checks = [
    ['users', 'role', ROLES, false],
    ['users', 'accountStatus', ACCOUNT_STATUSES, false],
    ['syllabi', 'semester', SEMESTERS, false],
    ['subjects', 'semester', SEMESTERS, true],
  ];
  for (const [table, column, allowed, nullable] of checks) {
    const bad = (await distribution(table, column)).filter(({ value }) => !(allowed.includes(value) || (nullable && value === null)));
    console.log(`  ${table}.${column}: ${bad.length ? '✗ ' + bad.map((b) => `${JSON.stringify(b.value)} × ${b.n}`).join(', ') : '✓ ok'}`);
    for (const b of bad) problems.push(`${table}.${column} has ${b.n} row(s) with value ${JSON.stringify(b.value)}`);
  }

  return problems;
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  // ── 1. Backup ──────────────────────────────────────────────────────────────
  if (!checkOnly) {
    const backupDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backups = {
      syllabi: `SELECT * FROM "syllabi"`,
      syllabus_versions: `SELECT * FROM "syllabus_versions"`,
      users: `SELECT "id", "role", "accountStatus" FROM "users"`,
    };
    for (const [name, sql] of Object.entries(backups)) {
      const rows = await prisma.$queryRawUnsafe(sql);
      const file = path.join(backupDir, `${name}-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
      console.log(`✓ Backed up ${rows.length} ${name} rows → ${path.relative(process.cwd(), file)}`);
    }
    console.log('');
  }

  // ── 2. Pre-check ───────────────────────────────────────────────────────────
  const problems = await preCheck();
  if (problems.length) {
    console.error('\n✗ Pre-check failed — nothing was changed. Fix these rows first:');
    for (const p of problems) console.error(`  • ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Pre-check passed.');
  if (checkOnly) return;

  // ── 3. Apply in one transaction ────────────────────────────────────────────
  const counts = () =>
    prisma.$queryRawUnsafe(
      `SELECT (SELECT count(*) FROM syllabi)::int AS syllabi, (SELECT count(*) FROM syllabus_versions)::int AS versions,
              (SELECT count(*) FROM users)::int AS users`
    );
  const [before] = await counts();

  const statements = splitSql(fs.readFileSync(path.join(__dirname, '..', 'prisma', 'sql', 'db-integrity.sql'), 'utf8'));
  await prisma.$transaction(async (tx) => {
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
  }, { timeout: 120000 });
  console.log(`✓ Applied ${statements.length} statements from prisma/sql/db-integrity.sql`);

  const [after] = await counts();
  console.log('\n  Row counts before:', before);
  console.log('  Row counts after :', after);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Row counts changed — investigate!');

  const constraints = await prisma.$queryRawUnsafe(
    `SELECT t.relname AS "table", c.conname AS "constraint"
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace
      WHERE c.contype = 'c' AND ns.nspname = 'public' AND t.relname IN ('syllabi','syllabus_versions','users','subjects')
      ORDER BY 1, 2`
  );
  console.log('\n  CHECK constraints in place:');
  console.table(constraints);
  console.log('\n✓ Migration complete');
}

main()
  .catch((e) => {
    console.error('✗ Migration failed (transaction rolled back):', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
