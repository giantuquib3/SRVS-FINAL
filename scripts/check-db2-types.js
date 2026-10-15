const { Client } = require('pg');

async function checkTableTypes() {
  const client = new Client({
    connectionString: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('DB2 Tables & Types:');
  console.table(res.rows);

  // If view, get definition
  const viewDef = await client.query(`SELECT pg_get_viewdef('public.users'::regclass, true);`);
  console.log('users view definition:', viewDef.rows[0]);

  await client.end();
}

checkTableTypes().catch(console.error);
