
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function checkSchema() {
  const sourceUrl = process.env.NEON_DB_PRIMARY_URL;
  if (!sourceUrl) {
    throw new Error("NEON_DB_PRIMARY_URL is not set");
  }

  const pool = new Pool({
    connectionString: sourceUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    try {
      // Check indexes
      const res = await client.query(`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'documents_backup';
      `);
      
      console.log("Indexes on documents_backup:");
      res.rows.forEach(row => {
        console.log(`- ${row.indexname}: ${row.indexdef}`);
      });

      // Check table size
      const count = await client.query("SELECT COUNT(*) FROM documents_backup");
      console.log(`Total rows: ${count.rows[0].count}`);

    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkSchema();
