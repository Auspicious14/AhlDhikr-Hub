import * as dotenv from "dotenv";
dotenv.config();

import { PostgresEmbeddingRepository } from "../repositories/postgres-embedding.repository";
import { getPostgresShardManager } from "../services/postgres-shard.service";

const run = async () => {
  const shardManager = getPostgresShardManager();
  const repo = new PostgresEmbeddingRepository();

  try {
    const storageUsage = await repo.getStorageUsageBytes();
    const health = await shardManager.healthCheck();

    const defaultThreshold =
      parseFloat(process.env.NEON_SHARD_USAGE_THRESHOLD || "0.8") || 0.8;
    const defaultMaxBytesEnv = process.env.NEON_SHARD_MAX_SIZE_BYTES;
    const defaultMaxBytes = defaultMaxBytesEnv
      ? parseInt(defaultMaxBytesEnv, 10)
      : undefined;

    let hasAlerts = false;

    console.log("Shard storage usage:");
    for (const shard of storageUsage) {
      const envName = `NEON_SHARD_${shard.shardId}_MAX_SIZE_BYTES`;
      const perShardMaxEnv = process.env[envName];
      const maxBytes = perShardMaxEnv
        ? parseInt(perShardMaxEnv, 10)
        : defaultMaxBytes;

      const sizeMb = shard.sizeBytes / (1024 * 1024);
      console.log(
        `  Shard ${shard.shardId} (${shard.database}): ${sizeMb.toFixed(2)} MB`
      );

      if (maxBytes && maxBytes > 0) {
        const usageRatio = shard.sizeBytes / maxBytes;
        if (usageRatio >= defaultThreshold) {
          hasAlerts = true;
          console.log(
            `  ALERT: Shard ${shard.shardId} is at ${(usageRatio * 100).toFixed(
              1
            )}% of configured capacity`
          );
        }
      }
    }

    console.log("");
    console.log("Shard health and query performance:");

    for (const shard of health) {
      const status = shard.active ? "healthy" : "unavailable";
      console.log(
        `  Shard ${shard.id} (${shard.role}) - ${status}, queries=${shard.totalQueries}, avgQueryTime=${shard.avgQueryTimeMs.toFixed(
          2
        )}ms`
      );
      if (shard.lastError) {
        console.log(`    Last error: ${shard.lastError}`);
      }
      if (!shard.active) {
        hasAlerts = true;
      }
    }

    if (hasAlerts) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (error: any) {
    console.error("Failed to monitor shards:", error.message || error);
    process.exitCode = 1;
  } finally {
    await shardManager.shutdown();
  }
};

run();

