
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const shards = [
  { name: "Primary", url: process.env.NEON_DB_PRIMARY_URL },
  { name: "Secondary1", url: process.env.NEON_DB_SECONDARY1_URL },
  { name: "Secondary2", url: process.env.NEON_DB_SECONDARY2_URL },
];

async function checkShard(name: string, url: string | undefined) {
  if (!url) {
    console.log(`[${name}] No URL configured.`);
    return;
  }

  console.log(`[${name}] Connecting...`);
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size;");
      console.log(`[${name}] Size: ${res.rows[0].size}`);
      
      const tables = await client.query(`
        SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as total_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
      `);
      
      console.log(`[${name}] Tables:`);
      tables.rows.forEach(row => {
        console.log(`  - ${row.relname}: ${row.total_size}`);
      });

    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`[${name}] Error: ${err.message}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const shard of shards) {
    await checkShard(shard.name, shard.url);
  }
}

main();
