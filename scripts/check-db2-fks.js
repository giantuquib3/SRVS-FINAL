const { Client } = require('pg');

async function checkFks() {
  const client = new Client({
    connectionString: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

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

  console.log('DB2 Foreign Keys:', fks.rows);
  await client.end();
}

checkFks().catch(console.error);
