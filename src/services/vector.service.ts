import { DataRepository } from '../repositories/data.repository';
import { VectorRepository } from '../repositories/vector.repository';
import { GeminiService } from './gemini.service';
import { Metadata } from '../models/types';
import { connectToDatabase, closeDatabaseConnection } from './mongo.service';

let isIndexLoaded = false;
let metadata: Metadata[] = [];

// Helper to normalize vectors for cosine similarity
const normalizeVector = (v: number[]): number[] => {
  const magnitude = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  if (magnitude === 0) return v;
  return v.map(val => val / magnitude);
};

export class VectorService {
  private dataRepository: DataRepository;
  private vectorRepository: VectorRepository;
  private geminiService: GeminiService;

  constructor(
    dataRepository: DataRepository,
    vectorRepository: VectorRepository,
    geminiService: GeminiService
  ) {
    this.dataRepository = dataRepository;
    this.vectorRepository = vectorRepository;
    this.geminiService = geminiService;
  }

  async buildIndex(): Promise<void> {
    console.log('Building vector index...');

    try {
      // Ensure the database is connected before trying to build
      await connectToDatabase();

      const quranVerses = await this.dataRepository.getQuranVerses();
      const hadiths = await this.dataRepository.getHadith();

      const documents = [
        ...quranVerses.map(v => ({ text: v.text, source: `Quran ${v.surah.englishName}:${v.number}` })),
        ...hadiths.map(h => ({ text: h.hadith_english, source: `Hadith (${h.by_book})` })),
      ];

      metadata = []; // Reset metadata
      this.vectorRepository.initIndex(documents.length);

      console.log(`Generating embeddings for ${documents.length} documents...`);
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const embedding = await this.geminiService.embedContent(doc.text);
        const normalizedEmbedding = normalizeVector(embedding);
        this.vectorRepository.addPoint(normalizedEmbedding, i);
        metadata.push({ id: i, text: doc.text, source: doc.source });
        if ((i + 1) % 100 === 0) {
          console.log(`Embedded ${i + 1}/${documents.length} documents...`);
        }
      }
    } catch (error) {
      console.error('ERROR: Failed to build vector index. This is a critical error.', error);
      console.warn('An empty vector index will be created. The application will run, but Q&A functionality will be severely limited.');

      if (error instanceof Error) {
        if (error.message.includes('MONGODB_URI')) {
          console.error('The database connection string seems to be missing or invalid. Please check your MONGODB_URI environment variable.');
        } else if (error.message.includes('HADITH_API_KEY')) {
          console.error('The Hadith API key is missing. Please check your HADITH_API_KEY environment variable.');
        } else if (error.message.includes('GEMINI_API_KEY')) {
            console.error('The Gemini API key is missing. Please check your GEMINI_API_KEY environment variable.');
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
      console.log('Index is already loaded in memory.');
      return;
    }

    // Connect to the database before attempting to load the index
    await connectToDatabase();

    const loaded = await this.vectorRepository.loadIndex();
    if (loaded) {
      metadata = loaded.metadata;
      isIndexLoaded = true;
      console.log(`Successfully loaded index with ${metadata.length} documents from MongoDB.`);
    } else {
      // If no index is found in the database, initialize an empty one.
      console.warn('WARNING: No index found in the database. Initializing an empty index.');
      console.warn('The application will run, but search functionality will be disabled until a valid index is built.');
      console.warn('To fix this, run "npm run build-index" with the required environment variables set.');
      metadata = [];
      this.vectorRepository.initIndex(0);
      isIndexLoaded = true;
    }
  }

  async search(query: string, k: number = 5): Promise<Metadata[]> {
    if (!isIndexLoaded) {
      throw new Error('Index is not loaded. Please ensure the server is initialized correctly.');
    }

    if (metadata.length === 0) {
      console.warn('Search performed on an empty index. No results will be returned.');
      return [];
    }

    const queryEmbedding = await this.geminiService.embedContent(query);
    const normalizedQueryEmbedding = normalizeVector(queryEmbedding);
    const neighborIds = this.vectorRepository.search(normalizedQueryEmbedding, k);

    return neighborIds.map(id => metadata[id]).filter(Boolean);
  }
}

// Support direct execution for building the index via CLI
if (require.main === module) {
  if (process.argv[2] === 'build') {
    const dataRepo = new DataRepository();
    const vectorRepo = new VectorRepository();
    const geminiService = new GeminiService();
    const vectorService = new VectorService(dataRepo, vectorRepo, geminiService);

    vectorService.buildIndex()
      .then(() => {
        console.log('Index build process finished.');
        // Close the database connection gracefully after the script runs
        return closeDatabaseConnection();
      })
      .catch(error => {
        console.error("Failed to build index:", error.message);
        process.exit(1);
      });
  }
}
