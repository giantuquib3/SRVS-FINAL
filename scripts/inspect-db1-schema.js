const { Client } = require('pg');

async function getDetailedSchema(url, name) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log(`\n================ SCHEMA OF ${name} ================`);
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  for (const t of tables.rows) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${t.table_name}'
      ORDER BY ordinal_position;
    `);
    console.log(`\nTable "${t.table_name}":`);
    console.table(cols.rows);
  }

  const fks = await client.query(`
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
  console.log(`\nForeign Keys in ${name} (${fks.rows.length}):`);
  console.table(fks.rows);

  await client.end();
}

async function main() {
  const url1 = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
  await getDetailedSchema(url1, 'Database 1 (Primary: qoxpqhvecjxlsbsshxsm)');
}

main().catch(console.error);
