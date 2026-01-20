
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function checkTargetSchema() {
  const shard1Url = process.env.NEON_DB_SECONDARY1_URL;
  if (!shard1Url) {
    throw new Error("NEON_DB_SECONDARY1_URL is not set");
  }

  const pool = new Pool({
    connectionString: shard1Url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    try {
      // Check column type
      const res = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'document_embeddings' AND column_name = 'embedding';
      `);
      
      console.log("Column type on Shard 1:");
      console.table(res.rows);

      // Check indexes
      const indexes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'document_embeddings';
      `);
      console.log("Indexes on Shard 1:");
      indexes.rows.forEach(r => console.log(r.indexdef));

    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkTargetSchema();
