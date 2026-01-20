
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function monitor() {
  const shard1Url = process.env.NEON_DB_SECONDARY1_URL;
  const shard2Url = process.env.NEON_DB_SECONDARY2_URL;

  if (!shard1Url || !shard2Url) {
    console.error("Secondary URLs not set");
    return;
  }

  const pool1 = new Pool({ connectionString: shard1Url, ssl: { rejectUnauthorized: false } });
  const pool2 = new Pool({ connectionString: shard2Url, ssl: { rejectUnauthorized: false } });

  try {
    const client1 = await pool1.connect();
    const client2 = await pool2.connect();

    try {
      const res1 = await client1.query("SELECT COUNT(*) FROM document_embeddings");
      const res2 = await client2.query("SELECT COUNT(*) FROM document_embeddings");

      const count1 = parseInt(res1.rows[0].count, 10);
      const count2 = parseInt(res2.rows[0].count, 10);

      console.log(`[${new Date().toISOString()}] Migration Progress:`);
      console.log(`Shard 1: ${count1} documents`);
      console.log(`Shard 2: ${count2} documents`);
      console.log(`Total Migrated: ${count1 + count2} documents`);

    } finally {
      client1.release();
      client2.release();
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool1.end();
    await pool2.end();
  }
}

monitor();
