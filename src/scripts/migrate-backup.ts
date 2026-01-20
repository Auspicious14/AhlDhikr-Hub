
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { PostgresEmbeddingRepository } from "../repositories/postgres-embedding.repository";
import { getPostgresShardManager } from "../services/postgres-shard.service";

dotenv.config();

const BATCH_SIZE = 50; // Reduced to improve stability
const RETRY_DELAY = 5000;
const CONNECTION_TIMEOUT = 60000; // Increased to 60s

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrate() {
  console.log("Starting migration from documents_backup (Shard 0) to document_embeddings (Shard 1/2)...");

  // Initialize Repository
  const targetRepo = new PostgresEmbeddingRepository();
  await targetRepo.initializeSchema();

  const sourceUrl = process.env.NEON_DB_PRIMARY_URL;
  if (!sourceUrl) {
    throw new Error("NEON_DB_PRIMARY_URL is not set");
  }

  let sourcePool = new Pool({
    connectionString: sourceUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT,
    ssl: { rejectUnauthorized: false },
    // Add keepalive to prevent connection drops
    keepAlive: true,
  });

  // Track global progress
  let totalDocs = 0;
  
  try {
    // Get total count once
    const tempClient = await sourcePool.connect();
    try {
      const countRes = await tempClient.query("SELECT COUNT(*) FROM documents_backup");
      totalDocs = parseInt(countRes.rows[0].count, 10);
      console.log(`Total documents to migrate: ${totalDocs}`);
    } finally {
      tempClient.release();
    }
  } catch (e) {
    console.warn("Could not get total count, proceeding anyway...");
  }

  try {
    while (true) {
      try {
        // Get max ID from target to resume
        let lastId = await targetRepo.getMaxId();
        console.log(`Resuming migration from ID: ${lastId}`);
        
        let sessionProcessed = 0;

        const client = await sourcePool.connect();
        
        try {
          while (true) {
            const startTime = Date.now();
            const res = await client.query(`
              SELECT id, text, metadata, embedding, created_at 
              FROM documents_backup 
              WHERE id > $1
              ORDER BY id ASC
              LIMIT $2
            `, [lastId, BATCH_SIZE]);

            const queryTime = Date.now() - startTime;

            if (res.rows.length === 0) {
              console.log("No more documents to migrate.");
              return; // Done
            }

            const rowsToInsert = res.rows.map(row => {
              let embedding: number[];
              if (typeof row.embedding === 'string') {
                try {
                  embedding = JSON.parse(row.embedding);
                } catch (e) {
                  embedding = row.embedding
                    .replace('[', '')
                    .replace(']', '')
                    .split(',')
                    .map((n: string) => parseFloat(n));
                }
              } else {
                embedding = row.embedding;
              }

              const metadata = row.metadata;
              const id = parseInt(row.id, 10);
              
              if (id > lastId) lastId = id;

              return {
                id: id,
                embedding: embedding,
                metadata: {
                  ...metadata,
                  text: row.text,
                  source: metadata.source || `Unknown-${row.id}`,
                  type: metadata.type || 'unknown',
                }
              };
            });

            const insertStartTime = Date.now();
            await targetRepo.insertBatch(rowsToInsert);
            const insertTime = Date.now() - insertStartTime;

            sessionProcessed += res.rows.length;
            
            // Calculate progress percentage (assuming IDs are roughly proportional to count)
            // Or just use lastId / maxId if we knew maxId, but we know totalDocs.
            // Since we don't know if IDs are contiguous, we'll just show ID.
            
            console.log(`[${new Date().toISOString()}] Batch done. Last ID: ${lastId}. ` +
              `Read: ${queryTime}ms, Write: ${insertTime}ms. ` +
              `Session: ${sessionProcessed} docs.`);
          }
        } finally {
          client.release();
        }
        
        break; 

      } catch (error: any) {
        console.error(`Migration error: ${error.message}`);
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        
        if (error.message.includes("Connection terminated") || 
            error.message.includes("timeout") || 
            error.message.includes("closed")) {
           await sourcePool.end().catch(() => {});
           sourcePool = new Pool({
            connectionString: sourceUrl,
            connectionTimeoutMillis: CONNECTION_TIMEOUT,
            ssl: { rejectUnauthorized: false },
            keepAlive: true
          });
        }
        
        await sleep(RETRY_DELAY);
      }
    }

  } finally {
    await sourcePool.end();
  }
}

migrate();
