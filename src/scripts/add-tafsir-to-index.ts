import * as dotenv from "dotenv";
import { DataRepository } from "../repositories/data.repository";
import { VectorRepository } from "../repositories/vector.repository";
import { EmbeddingService } from "../services/embedding.service";
import { VectorService } from "../services/vector.service";

dotenv.config();

async function rebuildIndexWithTafsir(): Promise<void> {
  console.log("🚀 Rebuilding vector index (including Tafsir) using VectorService...");

  const dataRepository = new DataRepository();
  const embeddingService = new EmbeddingService();

  const dimension = embeddingService.getEmbeddingDimension();
  const vectorRepository = new VectorRepository(dimension);

  const vectorService = new VectorService(
    dataRepository,
    vectorRepository,
    embeddingService
  );

  await vectorService.buildIndex();
}

if (require.main === module) {
  rebuildIndexWithTafsir()
    .then(() => {
      console.log("✅ Index rebuild with Tafsir completed!");
      process.exit(0);
    })
    .catch((error: any) => {
      console.error("❌ Failed to rebuild index:", error?.message || error);
      process.exit(1);
    });
}
