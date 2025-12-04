import { DataRepository } from "../repositories/data.repository";
import { VectorRepository } from "../repositories/vector.repository";
import { EmbeddingService } from "./embedding.service";
import { Metadata } from "../models/types";
import { connectToDatabase, closeDatabaseConnection } from "./mongo.service";

let isIndexLoaded = false;
let metadata: Metadata[] = [];

// Helper to normalize vectors for cosine similarity
const normalizeVector = (v: number[]): number[] => {
  const magnitude = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  if (magnitude === 0) return v;
  return v.map((val) => val / magnitude);
};

export class VectorService {
  private dataRepository: DataRepository;
  private vectorRepository: VectorRepository;
  private embeddingService: EmbeddingService;

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
      // Ensure the database is connected before trying to build
      await connectToDatabase();

      // Initialize embedding service (required for local embeddings)
      await this.embeddingService.initialize();

      const quranVerses = await this.dataRepository.getQuranVerses();
      const hadiths = await this.dataRepository.getHadith();

      // Get max documents limit from environment (default to 1000 to avoid quota issues)
      const maxDocuments = process.env.MAX_DOCUMENTS_TO_INDEX
        ? parseInt(process.env.MAX_DOCUMENTS_TO_INDEX, 10)
        : 1000;

      // Get delay between requests (default to 100ms to respect rate limits)
      const delayMs = process.env.EMBEDDING_DELAY_MS
        ? parseInt(process.env.EMBEDDING_DELAY_MS, 10)
        : 100;

      // Sample documents intelligently - take proportional samples from both sources
      const totalAvailable = quranVerses.length + hadiths.length;
      const quranSampleSize = Math.min(
        quranVerses.length,
        Math.floor((quranVerses.length / totalAvailable) * maxDocuments)
      );
      const hadithSampleSize = Math.min(
        hadiths.length,
        maxDocuments - quranSampleSize
      );

      // Sample evenly distributed documents
      const sampledQuran = this.sampleDocuments(quranVerses, quranSampleSize);
      const sampledHadith = this.sampleDocuments(hadiths, hadithSampleSize);

      const documents = [
        ...sampledQuran.map((v) => ({
          text: v.text,
          source: `Quran ${v.surah.englishName}:${v.number}`,
        })),
        ...sampledHadith.map((h) => ({
          text: h.hadith_english,
          source: `Hadith (${h.by_book})`,
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
      console.log(`   Processing: ${documents.length} documents`);
      console.log(`   Delay between requests: ${delayMs}ms`);

      metadata = []; // Reset metadata
      this.vectorRepository.initIndex(documents.length);

      console.log(
        `\n🚀 Generating embeddings for ${documents.length} documents...`
      );
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];

        // Add delay to respect rate limits (except for first request)
        if (i > 0 && delayMs > 0) {
          await this.delay(delayMs);
        }

        const embedding = await this.embeddingService.embedContent(doc.text);
        const normalizedEmbedding = normalizeVector(embedding);
        this.vectorRepository.addPoint(normalizedEmbedding, i);
        metadata.push({ id: i, text: doc.text, source: doc.source });

        if ((i + 1) % 50 === 0) {
          console.log(
            `   ✓ Embedded ${i + 1}/${documents.length} documents (${Math.round(
              ((i + 1) / documents.length) * 100
            )}%)`
          );
        }
      }
    } catch (error) {
      console.error(
        "ERROR: Failed to build vector index. This is a critical error.",
        error
      );
      console.warn(
        "An empty vector index will be created. The application will run, but Q&A functionality will be severely limited."
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

      metadata = [];
      this.vectorRepository.initIndex(0); // Initialize an empty index
    }

    await this.vectorRepository.saveIndex(metadata);
    isIndexLoaded = true;
    console.log(`Index built with ${metadata.length} documents.`);
  }

  async loadIndex(): Promise<void> {
    if (isIndexLoaded) {
      console.log("Index is already loaded in memory.");
      return;
    }

    // Connect to the database before attempting to load the index
    await connectToDatabase();

    const loaded = await this.vectorRepository.loadIndex();
    if (loaded) {
      metadata = loaded.metadata;
      isIndexLoaded = true;
      console.log(
        `Successfully loaded index with ${metadata.length} documents from MongoDB.`
      );
    } else {
      // If no index is found in the database, initialize an empty one.
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
      throw new Error(
        "Index is not loaded. Please ensure the server is initialized correctly."
      );
    }

    if (metadata.length === 0) {
      console.warn(
        "Search performed on an empty index. No results will be returned."
      );
      return [];
    }

    const queryEmbedding = await this.embeddingService.embedContent(query);
    const normalizedQueryEmbedding = normalizeVector(queryEmbedding);
    const neighborIds = this.vectorRepository.search(
      normalizedQueryEmbedding,
      k
    );

    return neighborIds.map((id) => metadata[id]).filter(Boolean);
  }

  // Helper method to sample documents evenly
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

  // Helper method to add delay between requests
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Support direct execution for building the index via CLI
if (require.main === module) {
  if (process.argv[2] === "build") {
    const dataRepo = new DataRepository();
    const embeddingService = new EmbeddingService();

    // Get the embedding dimension from the service
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
        // Close the database connection gracefully after the script runs
        return closeDatabaseConnection();
      })
      .catch((error) => {
        console.error("Failed to build index:", error.message);
        process.exit(1);
      });
  }
}
