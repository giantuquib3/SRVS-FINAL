const { Client } = require('pg');

async function inspectDb(url, name) {
  // Strip query params and pass ssl object
  const cleanUrl = url.split('?')[0];
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`\n========================================`);
    console.log(`CONNECTED TO: ${name}`);
    console.log(`========================================`);

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    for (const row of res.rows) {
      const t = row.table_name;
      try {
        const countRes = await client.query(`SELECT COUNT(*)::text as c FROM "${t}";`);
        const colRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = '${t}';
        `);
        console.log(`Table: "${t}" | Rows: ${countRes.rows[0].c} | Columns: ${colRes.rows.length}`);
      } catch (err) {
        console.log(`Table: "${t}" | Error: ${err.message}`);
      }
    }
  } catch (e) {
    console.error(`Failed to connect to ${name}:`, e.message);
  } finally {
    try { await client.end(); } catch(e){}
  }
}

async function main() {
  const url1 = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
  const url2 = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

  await inspectDb(url1, 'Database 1 (Primary in .env: qoxpqhvecjxlsbsshxsm)');
  await inspectDb(url2, 'Database 2 (Secondary / Dashboard in User Link: goxvhkbwfpffjnqphzpq)');
}

main();
