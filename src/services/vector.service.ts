import { DataRepository } from '../repositories/data.repository';
import { VectorRepository } from '../repositories/vector.repository';
import { GeminiService } from './gemini.service';
import { Metadata } from '../models/types';

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

    await this.vectorRepository.saveIndex(metadata);
    isIndexLoaded = true;
    console.log(`Index built with ${documents.length} documents.`);
  }

  async loadIndex(): Promise<void> {
    if (isIndexLoaded) {
      console.log('Index is already loaded in memory.');
      return;
    }

    const loaded = await this.vectorRepository.loadIndex();
    if (loaded) {
      metadata = loaded.metadata;
      isIndexLoaded = true;
    } else {
      // In a production environment like Render, we should not build the index on startup.
      // The index should be pre-built and included in the deployment.
      console.error('CRITICAL: Index files not found. The application cannot start.');
      console.error('Please run "npm run build-index" locally and commit the generated files.');
      process.exit(1); // Exit the process with an error code
    }
  }

  async search(query: string, k: number = 5): Promise<Metadata[]> {
    if (!isIndexLoaded) {
      // This should not happen in production if loadIndex is called on startup.
      throw new Error('Index is not loaded. Please ensure the server is initialized correctly.');
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
    vectorService.buildIndex().catch(console.error);
  }
}
