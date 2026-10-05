const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('   VERIFYING SUPABASE DATABASE SCHEMA (POSTGRESQL)  ');
  console.log('====================================================\n');

  // 1. Check Tables
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Found ${tables.length} tables/views in public schema:`);
  console.table(tables);

  // 2. Check each table columns & row counts
  for (const t of tables) {
    const tableName = t.table_name;
    const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::text as count FROM "${tableName}";`);
    const count = countRes[0]?.count || 0;

    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `);

    console.log(`\n Table: "${tableName}" | Rows: ${count}`);
    console.table(cols);
  }

  // 3. Check Foreign Keys
  const fks = await prisma.$queryRawUnsafe(`
    SELECT
      cl.relname AS table_name,
      con.conname AS constraint_name,
      clf.relname AS foreign_table_name,
      pg_get_constraintdef(con.oid) AS constraint_definition
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class clf ON clf.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = con.connamespace
    WHERE con.contype = 'f' AND ns.nspname = 'public'
    ORDER BY cl.relname, con.conname;
  `);

  console.log(`\n Foreign Key Constraints in Supabase (${fks.length}):`);
  console.table(fks);
}

main()
  .catch((err) => {
    console.error('Error verifying Supabase database:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
