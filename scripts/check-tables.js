const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('Tables found:', tables.map(t => t.table_name));

  for (const t of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::text as c FROM "${t.table_name}";`);
      const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${t.table_name}" LIMIT 2;`);
      console.log(`\nTable: "${t.table_name}" | Count: ${count[0].c}`);
      console.log('Columns:', Object.keys(sample[0] || {}));
    } catch (e) {
      console.log(`Table: "${t.table_name}" | Error: ${e.message}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
