const { Client } = require('pg');

async function syncLogs() {
  const c1 = new Client({
    connectionString: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  const c2 = new Client({
    connectionString: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  await c1.connect();
  await c2.connect();

  const logs = await c1.query('SELECT * FROM audit_logs ORDER BY id;');
  for (const l of logs.rows) {
    await c2.query(`
      INSERT INTO audit_logs (id, "userId", "userDisplayName", "actionType", "resultStatus", description, "entityType", "entityId", "ipAddress", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;
    `, [l.id, l.userId, l.userDisplayName, l.actionType, l.resultStatus, l.description, l.entityType, l.entityId, l.ipAddress, l.createdAt]);
  }

  // Update audit_logs sequence in DB2
  await c2.query(`SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs));`);

  const count1 = await c1.query('SELECT COUNT(*)::text as c FROM audit_logs;');
  const count2 = await c2.query('SELECT COUNT(*)::text as c FROM audit_logs;');
  console.log(`DB1 audit logs: ${count1.rows[0].c} | DB2 audit logs: ${count2.rows[0].c}`);

  await c1.end();
  await c2.end();
}

syncLogs().catch(console.error);
