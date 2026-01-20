# Sharded Neon Postgres Setup

This project can optionally store document embeddings in a sharded PostgreSQL setup using three Neon database instances. MongoDB and the in-memory HNSW index remain the primary search backend; Neon provides durable, horizontally scalable storage for embeddings and metadata.

## Overview

- Embeddings are written to multiple Neon databases during the `npm run build-index` process.
- Documents are assigned a global numeric id. The shard for a document is chosen by `id % N`, where `N` is the number of configured shards.
- Each shard stores a `document_embeddings` table with the same schema.
- A shared sharding and connection layer manages connection pooling, routing, basic health checks, and monitoring.

To enable Neon sharding, set `ENABLE_SHARDED_POSTGRES=true` and the shard connection strings in your environment.

## Connection String Management

Configure the three Neon instances using environment variables. Do not hard-code connection strings or passwords in the codebase.

Required variables:

- `NEON_DB_PRIMARY_URL` – connection string for the primary Neon instance.
- `NEON_DB_SECONDARY1_URL` – connection string for secondary instance 1.
- `NEON_DB_SECONDARY2_URL` – connection string for secondary instance 2.

Each value should be a standard PostgreSQL connection string with SSL enabled, similar to:

`postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require&channel_binding=require`

Optional pool sizing:

- `NEON_DB_PRIMARY_POOL_SIZE` – max connections in the primary pool (default: 10).
- `NEON_DB_SECONDARY1_POOL_SIZE` – max connections in secondary 1 pool (default: 10).
- `NEON_DB_SECONDARY2_POOL_SIZE` – max connections in secondary 2 pool (default: 10).

These are used by the shared connection manager in `src/services/postgres-shard.service.ts`.

## Sharding Architecture

### Logical Shards

Each Neon instance represents a logical shard. The number of active shards is determined by how many URLs are configured:

- If only `NEON_DB_PRIMARY_URL` is set, all documents go to the primary shard.
- If primary plus one secondary are set, documents are distributed evenly across two shards.
- If all three URLs are set, documents are distributed evenly across three shards.

Shard ids are assigned as:

- Shard 0 – primary instance.
- Shard 1 – secondary instance 1.
- Shard 2 – secondary instance 2.

The shard manager computes `shardId = abs(documentId) % activeShardCount` using the sorted list of configured shard ids, so distribution remains even as long as the set of shards does not change.

### Table Schema

Each shard stores the same table:

- Location: `sql/sharded_embeddings_schema.sql`
- Runtime creator: `PostgresEmbeddingRepository.initializeSchema()`

Schema:

- `id BIGINT PRIMARY KEY` – global document id (matches the in-memory index).
- `shard_id INTEGER NOT NULL` – shard that owns the document (for diagnostics).
- `type TEXT NOT NULL` – document type (quran, hadith, tafsir, dua, seerah).
- `source TEXT NOT NULL` – human-readable source string.
- `text TEXT NOT NULL` – full text used for embedding.
- `metadata JSONB NOT NULL` – full structured metadata for the document.
- `embedding DOUBLE PRECISION[] NOT NULL` – embedding vector stored as a numeric array.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:

- `idx_document_embeddings_type` on `type`
- `idx_document_embeddings_shard_id` on `shard_id`

The application uses the same schema on every shard; you can extend it if needed as long as changes are applied to all Neon instances.

## Build-Index Integration

The existing `npm run build-index` command now supports writing into Neon alongside MongoDB and the HNSW index.

### Enabling Neon Sharding

1. Set the Neon URLs and pool sizes in `.env`:

   - `NEON_DB_PRIMARY_URL=postgresql://...`
   - `NEON_DB_SECONDARY1_URL=postgresql://...`
   - `NEON_DB_SECONDARY2_URL=postgresql://...`
   - `ENABLE_SHARDED_POSTGRES=true`

2. Build the project:

   - `npm run build`

3. Build or resume the index:

   - `npm run build-index`

When `ENABLE_SHARDED_POSTGRES=true`:

- `VectorService.buildIndex()` initializes the sharded schema via `PostgresEmbeddingRepository.initializeSchema()`.
- During embedding, each batch of documents is:
  - Embedded via the configured provider.
  - Added to the in-memory HNSW index.
  - Recorded in MongoDB for index persistence and metadata.
  - Sent to `PostgresEmbeddingRepository.insertBatch`, which:
    - Groups by shard using `getShardForDocument(id)`.
    - Executes a multi-row `INSERT ... ON CONFLICT (id) DO UPDATE` per shard.

### Continuation After Initial 33k Documents

Continuation is handled at two levels:

- HNSW/Mongo: `VectorService` uses the current index size to resume where it left off, skipping already-embedded documents and appending new ones.
- Neon: the `document_embeddings` table uses `ON CONFLICT (id) DO UPDATE`, so rerunning a build or resuming after failure safely upserts existing rows and inserts new ones without duplicates.

This allows you to:

- Build the first 33k documents.
- Later extend the dataset (for example by adding more Tafsir, Seerah, or Duas).
- Rerun `npm run build-index` and only new documents are added.

## Failover And Consistency

### Shard Health And Failover

The shard manager in `src/services/postgres-shard.service.ts` maintains one connection pool per shard and tracks basic health:

- If a connection-level error occurs (for example a terminated or refused connection), the shard is marked inactive.
- Subsequent operations skip the inactive shard and report an error if that shard is required.
- Health checks can be invoked via `healthCheck()` or the monitoring script described below.

This design is intended to:

- Detect and isolate failed Neon instances.
- Prevent repeated connection attempts to an unhealthy shard.
- Allow the rest of the shards to continue serving writes and reads.

Because each shard is a separate Neon database, the application does not attempt two-phase commits or cross-shard transactions. Consistency guarantees are:

- Per-shard operations are transactional (PostgreSQL guarantees).
- Each document id maps deterministically to a single owning shard.
- Duplicate ids are prevented per shard by the primary key and resolved via upsert semantics.

If a shard is unavailable during a build-index run, writes targeting that shard fail and the overall build should be treated as failed. After restoring the shard, rerun `npm run build-index` to reconcile.

### Data Consistency Across Shards

- Each document is stored exactly once in Neon, on the shard determined by its global id.
- No cross-shard duplicates are created by the application.
- The `metadata` column stores the full structured metadata; MongoDB continues to be the main system of record for the vector index.

For critical deployments, consider periodically exporting shard data or using Neon branching/backups to protect against accidental data loss.

## Monitoring And Capacity Tracking

The repository includes a script to monitor shard health, storage usage, and basic query performance.

### Environment Variables

- `NEON_SHARD_USAGE_THRESHOLD` – fraction of capacity at which to raise an alert (default: `0.8`).
- `NEON_SHARD_MAX_SIZE_BYTES` – default maximum bytes per shard (optional).
- `NEON_SHARD_0_MAX_SIZE_BYTES` – override for shard 0 (optional).
- `NEON_SHARD_1_MAX_SIZE_BYTES` – override for shard 1 (optional).
- `NEON_SHARD_2_MAX_SIZE_BYTES` – override for shard 2 (optional).

### Running The Monitor

Script:

- `npm run monitor-shards`

Behavior:

- For each shard, queries `pg_database_size(current_database())` to compute storage usage in bytes.
- Compares usage to configured capacity and logs an alert if usage exceeds `NEON_SHARD_USAGE_THRESHOLD` of the limit.
- Runs a health check that:
  - Executes `SELECT 1` on each shard.
  - Measures average query time per shard.
  - Reports whether each shard is healthy or unavailable and shows the last error if present.
- Exits with:
  - Code `0` if all shards are within capacity and healthy.
  - Code `1` if any shard is near capacity or marked unhealthy.

You can plug this script into external monitoring (cron, task scheduler, CI, or orchestration) and alert on non-zero exit codes or specific log patterns.

## Scaling Procedures

### Adding More Documents

- The build-index process already samples and balances across Quran, hadith, tafsir, duas, and Seerah.
- To scale to more than 33k documents:
  - Ensure Neon plan limits and `NEON_SHARD_MAX_SIZE_BYTES` values are adjusted.
  - Run `npm run build-index` with an increased `MAX_DOCUMENTS_TO_INDEX` if you wish to embed more documents from the available datasets.

The sharding layer will automatically distribute new documents across the configured shards using `id % N`.

### Adding Or Removing Shards

Adding a new Neon instance:

1. Provision a new Neon database.
2. Apply `sql/sharded_embeddings_schema.sql` to the new database.
3. Add its connection string and optional pool size to `.env`:
   - For a fourth shard you would need to extend the code to support another `ShardId`.
4. Restart the application or rerun the build process.

Important: Because the shard id is computed as `id % N`, changing the number of shards changes the mapping of document ids to shards. Before changing the shard count, you should plan a data migration that:

- Reads all documents from existing shards.
- Recomputes the shard id for each document using the new shard count.
- Writes documents to the new shard layout.

Until such a migration is implemented, treat the number of shards as fixed.

Removing a shard:

- Remove the corresponding `NEON_DB_*_URL` from `.env`.
- Migrate the data off that shard first to avoid orphaned documents.
- After removal, the shard manager will stop routing new writes to that shard.

## Recovery From Accidental Deletions

Recommended recovery strategy:

1. If documents are accidentally deleted from Neon but still exist in MongoDB:
   - Restore or rebuild the Neon tables by rerunning `npm run build-index` with `ENABLE_SHARDED_POSTGRES=true`.
   - The build process will recompute embeddings and upsert them into the correct shards.

2. If entire Neon databases are dropped:
   - Recreate them in Neon.
   - Apply `sql/sharded_embeddings_schema.sql`.
   - Ensure the environment variables still point to the correct databases.
   - Rerun `npm run build-index` to repopulate from the source datasets.

3. For catastrophic loss of both Neon and MongoDB:
   - Rebuild the datasets from the original APIs and data sources using the existing scripts in `src/repositories/data.repository.ts`.
   - Rerun `npm run build-index` to regenerate both the HNSW index in MongoDB and the sharded Neon data.

4. Neon-native backups:
   - For production, use Neon branches, logical backups, or snapshots as an additional safety net beyond the application-level rebuild process.

By combining rebuildable embeddings with Neon snapshots and the monitoring script, you can detect capacity and availability issues early and recover quickly from accidental deletions.

