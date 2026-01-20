import { Metadata } from "../models/types";
import {
  ShardId,
  getPostgresShardManager,
} from "../services/postgres-shard.service";

interface EmbeddingRow {
  id: number;
  embedding: number[];
  metadata: Metadata;
}

export class PostgresEmbeddingRepository {
  private shardManager = getPostgresShardManager();

  async initializeSchema(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id BIGINT PRIMARY KEY,
        shard_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        text TEXT NOT NULL,
        metadata JSONB NOT NULL,
        embedding DOUBLE PRECISION[] NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_document_embeddings_type
        ON document_embeddings(type);

      CREATE INDEX IF NOT EXISTS idx_document_embeddings_shard_id
        ON document_embeddings(shard_id);
    `;

    // Manually run on shards to handle failures (e.g. full primary shard) gracefully
    const shardIds: ShardId[] = [0, 1, 2];
    
    for (const shardId of shardIds) {
      try {
        await this.shardManager.runOnShard(shardId, createTableSql);
        console.log(`Schema initialized on shard ${shardId}`);
      } catch (error) {
        console.warn(`Failed to initialize schema on shard ${shardId}:`, error);
        // Continue to other shards even if one fails
      }
    }
  }

  async insertBatch(rows: EmbeddingRow[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const byShard = new Map<ShardId, EmbeddingRow[]>();

    for (const row of rows) {
      const shardId = this.shardManager.getShardForDocument(row.id);
      const existing = byShard.get(shardId) || [];
      existing.push(row);
      byShard.set(shardId, existing);
    }

    const tasks: Promise<void>[] = [];

    for (const [shardId, shardRows] of byShard.entries()) {
      const task = this.insertOnShard(shardId, shardRows);
      tasks.push(task);
    }

    await Promise.all(tasks);
  }

  private async insertOnShard(
    shardId: ShardId,
    rows: EmbeddingRow[]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const values: any[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const baseIndex = i * 7;
      const row = rows[i];
      const shardKey = this.shardManager.getShardForDocument(row.id);

      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${
          baseIndex + 4
        }, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`
      );

      values.push(
        row.id,
        shardKey,
        row.metadata.type,
        row.metadata.source,
        row.metadata.text,
        JSON.stringify(row.metadata),
        row.embedding
      );
    }

    const sql = `
      INSERT INTO document_embeddings (
        id,
        shard_id,
        type,
        source,
        text,
        metadata,
        embedding
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (id) DO UPDATE SET
        shard_id = EXCLUDED.shard_id,
        type = EXCLUDED.type,
        source = EXCLUDED.source,
        text = EXCLUDED.text,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = NOW();
    `;

    await this.shardManager.runOnShard(shardId, sql, values);
  }

  async getStorageUsageBytes(): Promise<
    { shardId: ShardId; database: string; sizeBytes: number }[]
  > {
    const results: { shardId: ShardId; database: string; sizeBytes: number }[] =
      [];

    const shardResults = await this.shardManager.runOnAllShards(() => ({
      query:
        "SELECT current_database() AS datname, pg_database_size(current_database())::text AS size",
    }));

    for (const [shardId, result] of shardResults.entries()) {
      const row = result.rows[0];
      const size = parseInt(row.size, 10);
      results.push({
        shardId,
        database: row.datname,
        sizeBytes: Number.isNaN(size) ? 0 : size,
      });
    }

    return results;
  }

  async loadAllEmbeddings(): Promise<EmbeddingRow[]> {
    const all: EmbeddingRow[] = [];

    // Only load from shards 1 and 2 (where we write now)
    // Shard 0 is full and failed schema init, so it has no document_embeddings table
    const activeShardIds: ShardId[] = [1, 2];
    
    for (const shardId of activeShardIds) {
      try {
        const result = await this.shardManager.runOnShard(shardId, "SELECT id, embedding, metadata FROM document_embeddings ORDER BY id ASC");
        for (const row of result.rows) {
          all.push({
            id: row.id,
            embedding: row.embedding,
            metadata: row.metadata,
          });
        }
      } catch (error) {
        console.warn(`Failed to load embeddings from shard ${shardId}:`, error);
      }
    }

    all.sort((a, b) => a.id - b.id);
    return all;
  }

  async getMaxId(): Promise<number> {
    let maxId = 0;
    const activeShardIds: ShardId[] = [1, 2];

    for (const shardId of activeShardIds) {
      try {
        const result = await this.shardManager.runOnShard(shardId, "SELECT MAX(id) as max_id FROM document_embeddings");
        const val = parseInt(result.rows[0].max_id, 10);
        if (!isNaN(val) && val > maxId) {
          maxId = val;
        }
      } catch (error) {
        console.warn(`Failed to get max ID from shard ${shardId}:`, error);
      }
    }
    return maxId;
  }

  async getExistingDocumentIds(): Promise<Set<number>> {
    const ids = new Set<number>();
    const activeShardIds: ShardId[] = [1, 2];

    for (const shardId of activeShardIds) {
      try {
        const result = await this.shardManager.runOnShard(shardId, "SELECT id FROM document_embeddings");
        for (const row of result.rows) {
          ids.add(Number(row.id));
        }
      } catch (error) {
        console.warn(`Failed to get IDs from shard ${shardId}:`, error);
      }
    }
    return ids;
  }
}
