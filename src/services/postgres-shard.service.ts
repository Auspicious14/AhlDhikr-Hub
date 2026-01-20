import { Pool, PoolClient, QueryConfig, QueryResult } from "pg";

export type ShardId = 0 | 1 | 2;

interface ShardConfig {
  id: ShardId;
  role: "primary" | "secondary";
  connectionString: string;
  maxPoolSize: number;
}

interface ShardMetrics {
  totalQueries: number;
  totalQueryTimeMs: number;
  lastQueryAt?: Date;
  lastError?: string;
}

interface ShardState {
  config: ShardConfig;
  pool: Pool;
  metrics: ShardMetrics;
  active: boolean;
}

export interface ShardQueryOptions {
  timeoutMs?: number;
}

export interface ShardHealth {
  id: ShardId;
  role: "primary" | "secondary";
  active: boolean;
  lastError?: string;
  totalQueries: number;
  avgQueryTimeMs: number;
}

class PostgresShardManager {
  private shards: Map<ShardId, ShardState> = new Map();
  private initialized = false;

  initializeFromEnv(): void {
    if (this.initialized) {
      return;
    }

    const primaryUrl = process.env.NEON_DB_PRIMARY_URL;
    const secondary1Url = process.env.NEON_DB_SECONDARY1_URL;
    const secondary2Url = process.env.NEON_DB_SECONDARY2_URL;

    const shardConfigs: ShardConfig[] = [];

    if (primaryUrl) {
      shardConfigs.push({
        id: 0,
        role: "primary",
        connectionString: primaryUrl,
        maxPoolSize: this.getPoolSizeFromEnv("NEON_DB_PRIMARY_POOL_SIZE"),
      });
    }

    if (secondary1Url) {
      shardConfigs.push({
        id: 1,
        role: "secondary",
        connectionString: secondary1Url,
        maxPoolSize: this.getPoolSizeFromEnv("NEON_DB_SECONDARY1_POOL_SIZE"),
      });
    }

    if (secondary2Url) {
      shardConfigs.push({
        id: 2,
        role: "secondary",
        connectionString: secondary2Url,
        maxPoolSize: this.getPoolSizeFromEnv("NEON_DB_SECONDARY2_POOL_SIZE"),
      });
    }

    if (shardConfigs.length === 0) {
      throw new Error(
        "No Neon shard URLs configured. Set NEON_DB_PRIMARY_URL and optional secondary URLs."
      );
    }

    for (const config of shardConfigs) {
      const pool = new Pool({
        connectionString: config.connectionString,
        max: config.maxPoolSize,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 30_000,
      });

      this.shards.set(config.id, {
        config,
        pool,
        active: true,
        metrics: {
          totalQueries: 0,
          totalQueryTimeMs: 0,
        },
      });
    }

    this.initialized = true;
  }

  private getPoolSizeFromEnv(envName: string): number {
    const value = process.env[envName];
    if (!value) {
      return 10;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 10;
    }
    return parsed;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initializeFromEnv();
    }
  }

  getShardForDocument(docId: number): ShardId {
    this.ensureInitialized();
    // Exclude Shard 0 (Primary) because it is full (over 512MB limit)
    // Only use Secondary shards (1 and 2)
    const availableShardIds = Array.from(this.shards.keys())
      .filter((id) => id !== 0)
      .sort();

    if (availableShardIds.length === 0) {
      throw new Error("No active shards configured (Shard 0 excluded).");
    }
    const index = Math.abs(docId) % availableShardIds.length;
    return availableShardIds[index] as ShardId;
  }

  async runOnShard(
    shardId: ShardId,
    query: string | QueryConfig,
    params: any[] = [],
    options: ShardQueryOptions = {}
  ): Promise<QueryResult> {
    this.ensureInitialized();
    const shard = this.shards.get(shardId);
    if (!shard) {
      throw new Error(`Shard ${shardId} is not configured.`);
    }
    if (!shard.active) {
      throw new Error(`Shard ${shardId} is marked as inactive.`);
    }

    const startedAt = Date.now();
    let client: PoolClient | undefined;

    try {
      client = await shard.pool.connect();

      if (options.timeoutMs && options.timeoutMs > 0) {
        await client.query(`SET statement_timeout TO ${options.timeoutMs}`);
      }

      const result =
        typeof query === "string"
          ? await client.query(query, params)
          : await client.query(query);

      const elapsed = Date.now() - startedAt;
      shard.metrics.totalQueries += 1;
      shard.metrics.totalQueryTimeMs += elapsed;
      shard.metrics.lastQueryAt = new Date();
      shard.metrics.lastError = undefined;

      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startedAt;
      shard.metrics.totalQueries += 1;
      shard.metrics.totalQueryTimeMs += elapsed;
      shard.metrics.lastQueryAt = new Date();
      shard.metrics.lastError = error?.message || String(error);

      const message = error?.message || "";
      const isConnectionError =
        message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") ||
        message.includes("terminating connection") ||
        message.includes("Connection terminated unexpectedly");

      if (isConnectionError) {
        shard.active = false;
        console.error(
          `Shard ${shardId} marked inactive due to connection error: ${message}`
        );
      }

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async runOnAllShards(
    queryFactory: (shardId: ShardId) => { query: string | QueryConfig; params?: any[] }
  ): Promise<Map<ShardId, QueryResult>> {
    this.ensureInitialized();

    const results = new Map<ShardId, QueryResult>();
    const promises: Promise<void>[] = [];

    for (const [shardId, shard] of this.shards.entries()) {
      if (!shard.active) {
        continue;
      }

      const { query, params = [] } = queryFactory(shardId);

      const promise = this.runOnShard(shardId, query, params).then(
        (result) => {
          results.set(shardId, result);
        }
      );

      promises.push(promise);
    }

    await Promise.all(promises);
    return results;
  }

  async healthCheck(timeoutMs: number = 5000): Promise<ShardHealth[]> {
    this.ensureInitialized();

    const health: ShardHealth[] = [];
    const checks: Promise<void>[] = [];

    for (const [shardId, shard] of this.shards.entries()) {
      const promise = (async () => {
        if (!shard.active) {
          health.push({
            id: shardId,
            role: shard.config.role,
            active: false,
            lastError: shard.metrics.lastError,
            totalQueries: shard.metrics.totalQueries,
            avgQueryTimeMs:
              shard.metrics.totalQueries === 0
                ? 0
                : shard.metrics.totalQueryTimeMs / shard.metrics.totalQueries,
          });
          return;
        }

        const startedAt = Date.now();
        try {
          await this.runOnShard(shardId, "SELECT 1", [], { timeoutMs });
          const elapsed = Date.now() - startedAt;

          health.push({
            id: shardId,
            role: shard.config.role,
            active: true,
            lastError: shard.metrics.lastError,
            totalQueries: shard.metrics.totalQueries,
            avgQueryTimeMs:
              shard.metrics.totalQueries === 0
                ? elapsed
                : shard.metrics.totalQueryTimeMs / shard.metrics.totalQueries,
          });
        } catch (error: any) {
          const message = error?.message || String(error);
          health.push({
            id: shardId,
            role: shard.config.role,
            active: false,
            lastError: message,
            totalQueries: shard.metrics.totalQueries,
            avgQueryTimeMs:
              shard.metrics.totalQueries === 0
                ? 0
                : shard.metrics.totalQueryTimeMs / shard.metrics.totalQueries,
          });
        }
      })();

      checks.push(promise);
    }

    await Promise.all(checks);
    return health.sort((a, b) => a.id - b.id);
  }

  async shutdown(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const shard of this.shards.values()) {
      tasks.push(shard.pool.end());
    }
    await Promise.all(tasks);
    this.shards.clear();
    this.initialized = false;
  }
}

let shardManager: PostgresShardManager | null = null;

export const getPostgresShardManager = (): PostgresShardManager => {
  if (!shardManager) {
    shardManager = new PostgresShardManager();
  }
  return shardManager;
};
