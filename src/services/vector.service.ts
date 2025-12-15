import { DataRepository } from "../repositories/data.repository";
import { VectorRepository } from "../repositories/vector.repository";
import { EmbeddingService } from "./embedding.service";
import { Metadata } from "../models/types";
import { connectToDatabase, closeDatabaseConnection } from "./mongo.service";

let isIndexLoaded = false;
let metadata: Metadata[] = [];

const normalizeVector = (v: number[]): number[] => {
  const magnitude = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  if (magnitude === 0) return v;
  return v.map((val) => val / magnitude);
};

export class VectorService {
  private dataRepository: DataRepository;
  private vectorRepository: VectorRepository;
  private embeddingService: EmbeddingService;
  private readonly BATCH_SIZE = 50;
  private readonly CHECKPOINT_INTERVAL = 500;

  constructor(
    dataRepository: DataRepository,
    vectorRepository: VectorRepository,
    embeddingService: EmbeddingService
  ) {
    this.dataRepository = dataRepository;
    this.vectorRepository = vectorRepository;
    this.embeddingService = embeddingService;
  }

  async buildIndex(): Promise<void> {
    console.log("Building vector index...");

    try {
      await connectToDatabase();

      await this.embeddingService.initialize();

      const quranVerses = await this.dataRepository.getQuranVerses();
      const hadiths = await this.dataRepository.getFullHadith();
      const tafsirDocs = await this.dataRepository.getTafsir();

      const maxDocuments = process.env.MAX_DOCUMENTS_TO_INDEX
        ? parseInt(process.env.MAX_DOCUMENTS_TO_INDEX, 10)
        : Infinity;

      const delayMs = process.env.EMBEDDING_DELAY_MS
        ? parseInt(process.env.EMBEDDING_DELAY_MS, 10)
        : 100;

      const totalAvailable =
        quranVerses.length + hadiths.length + tafsirDocs.length;
      const quranSampleSize = Math.min(
        quranVerses.length,
        Math.floor((quranVerses.length / totalAvailable) * maxDocuments)
      );
      const hadithSampleSize = Math.min(
        hadiths.length,
        Math.floor((hadiths.length / totalAvailable) * maxDocuments)
      );
      const tafsirSampleSize = Math.min(
        tafsirDocs.length,
        maxDocuments - quranSampleSize - hadithSampleSize
      );

      const sampledQuran = this.sampleDocuments(quranVerses, quranSampleSize);
      const sampledHadith = this.sampleDocuments(hadiths, hadithSampleSize);
      const sampledTafsir = this.sampleDocuments(tafsirDocs, tafsirSampleSize);

      const documents = [
        ...sampledQuran.map((v) => ({
          text: v.text,
          source: `Quran ${v.surah.englishName} ${v.surah.number}:${v.numberInSurah}`,
        })),
        ...sampledHadith.map((h) => ({
          text: h.hadith_english,
          source: `Hadith (${h.by_book})`,
        })),
        ...sampledTafsir.map((t) => ({
          text: t.text,
          source: t.source,
        })),
      ];

      console.log(`📊 Data Summary:`);
      console.log(`   Total available: ${totalAvailable} documents`);
      console.log(
        `   Quran verses: ${quranVerses.length} (sampling ${sampledQuran.length})`
      );
      console.log(
        `   Hadiths: ${hadiths.length} (sampling ${sampledHadith.length})`
      );
      console.log(
        `   Tafsir documents: ${tafsirDocs.length} (sampling ${sampledTafsir.length})`
      );
      console.log(`   Processing: ${documents.length} documents`);
      console.log(`   Batch Size: ${this.BATCH_SIZE}`);

      let startIndex = 0;
      const existingIndex = await this.vectorRepository.loadIndex();

      if (existingIndex) {
        const currentCount = this.vectorRepository.getCurrentCount();
        if (currentCount > 0 && currentCount < documents.length) {
          console.log(
            `🔄 Resuming from checkpoint: ${currentCount}/${documents.length} documents already indexed.`
          );
          metadata = existingIndex.metadata;
          startIndex = currentCount;
        } else if (currentCount >= documents.length) {
          console.log(
            `✅ Index already complete (${currentCount} documents). Use --force to rebuild.`
          );
          metadata = existingIndex.metadata;
          isIndexLoaded = true;
          return;
        } else {
          console.log("Starting fresh index build...");
          metadata = [];
          this.vectorRepository.initIndex(documents.length);
        }
      } else {
        metadata = [];
        this.vectorRepository.initIndex(documents.length);
      }

      console.log(
        `\n🚀 Generating embeddings for ${
          documents.length - startIndex
        } remaining documents...`
      );

      for (let i = startIndex; i < documents.length; i += this.BATCH_SIZE) {
        const batch = documents.slice(i, i + this.BATCH_SIZE);
        const batchTexts = batch.map((d) => d.text);

        if (i > 0 && delayMs > 0) {
          await this.delay(delayMs);
        }

        try {
          const embeddings = await this.embeddingService.embedBatch(batchTexts);

          for (let j = 0; j < embeddings.length; j++) {
            const globalIndex = i + j;
            const normalizedEmbedding = normalizeVector(embeddings[j]);
            this.vectorRepository.addPoint(normalizedEmbedding, globalIndex);

            if (metadata.length <= globalIndex) {
              metadata.push({
                id: globalIndex,
                text: batch[j].text,
                source: batch[j].source,
              });
            } else {
              metadata[globalIndex] = {
                id: globalIndex,
                text: batch[j].text,
                source: batch[j].source,
              };
            }
          }

          const progress = Math.min(i + this.BATCH_SIZE, documents.length);
          console.log(
            `   ✓ Embedded ${progress}/${
              documents.length
            } documents (${Math.round((progress / documents.length) * 100)}%)`
          );

          if (
            progress % this.CHECKPOINT_INTERVAL === 0 ||
            progress === documents.length
          ) {
            console.log(`💾 Checkpointing at ${progress} documents...`);
            await this.vectorRepository.saveIndex(metadata);
          }
        } catch (batchError) {
          console.error(
            `❌ Error processing batch starting at index ${i}:`,
            batchError
          );
          console.log("💾 Saving progress before exit...");
          await this.vectorRepository.saveIndex(metadata);
          throw batchError;
        }
      }
    } catch (error) {
      console.error(
        "ERROR: Failed to build vector index. This is a critical error.",
        error
      );

      if (error instanceof Error) {
        if (error.message.includes("MONGODB_URI")) {
          console.error(
            "The database connection string seems to be missing or invalid. Please check your MONGODB_URI environment variable."
          );
        } else if (error.message.includes("HADITH_API_KEY")) {
          console.error(
            "The Hadith API key is missing. Please check your HADITH_API_KEY environment variable."
          );
        } else if (error.message.includes("GEMINI_API_KEY")) {
          console.error(
            "The Gemini API key is missing. Please check your GEMINI_API_KEY environment variable."
          );
        }
      }
    }

    await this.vectorRepository.saveIndex(metadata);
    isIndexLoaded = true;
    console.log(`Index built and saved with ${metadata.length} documents.`);
  }

  async loadIndex(): Promise<void> {
    if (isIndexLoaded) {
      console.log("Index is already loaded in memory.");
      return;
    }

    await connectToDatabase();

    const loaded = await this.vectorRepository.loadIndex();
    if (loaded) {
      metadata = loaded.metadata;
      isIndexLoaded = true;
      console.log(
        `Successfully loaded index with ${metadata.length} documents from MongoDB.`
      );
    } else {
      console.warn(
        "WARNING: No index found in the database. Initializing an empty index."
      );
      console.warn(
        "The application will run, but search functionality will be disabled until a valid index is built."
      );
      console.warn(
        'To fix this, run "npm run build-index" with the required environment variables set.'
      );
      metadata = [];
      this.vectorRepository.initIndex(0);
      isIndexLoaded = true;
    }
  }

  async search(query: string, k: number = 5): Promise<Metadata[]> {
    if (!isIndexLoaded) {
      throw new Error("Index is not loaded.");
    }

    if (metadata.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingService.embedQuery(query);
    const normalizedQueryEmbedding = normalizeVector(queryEmbedding);
    const neighborIds = this.vectorRepository.search(
      normalizedQueryEmbedding,
      k
    );

    return neighborIds.map((id) => metadata[id]).filter(Boolean);
  }

  private sampleDocuments<T>(documents: T[], sampleSize: number): T[] {
    if (sampleSize >= documents.length) {
      return documents;
    }

    const step = documents.length / sampleSize;
    const sampled: T[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(i * step);
      sampled.push(documents[index]);
    }

    return sampled;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  if (process.argv[2] === "build") {
    const dataRepo = new DataRepository();
    const embeddingService = new EmbeddingService();

    const dimension = embeddingService.getEmbeddingDimension();
    const vectorRepo = new VectorRepository(dimension);

    const vectorService = new VectorService(
      dataRepo,
      vectorRepo,
      embeddingService
    );

    vectorService
      .buildIndex()
      .then(() => {
        console.log("Index build process finished.");
        return closeDatabaseConnection();
      })
      .catch((error) => {
        console.error("Failed to build index:", error.message);
        process.exit(1);
      });
  }
}
