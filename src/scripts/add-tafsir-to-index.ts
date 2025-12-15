import { DataRepository } from "../repositories/data.repository";
import { VectorRepository } from "../repositories/vector.repository";
import { Metadata } from "../models/types";
import * as dotenv from "dotenv";
import { EmbeddingService } from "../services/embedding.service";
import {
  connectToDatabase,
  closeDatabaseConnection,
} from "../services/mongo.service";

dotenv.config();

const normalizeVector = (v: number[]): number[] => {
  const magnitude = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  if (magnitude === 0) return v;
  return v.map((val) => val / magnitude);
};

async function rebuildIndexWithTafsir() {
  console.log("🚀 Rebuilding entire index with Quran, Hadith, and Tafsir...");
  console.log("⚠️  This will take a while but ensures consistency.");

  try {
    await connectToDatabase();

    const dataRepository = new DataRepository();
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();

    const dimension = embeddingService.getEmbeddingDimension();
    const vectorRepository = new VectorRepository(dimension);

    // Fetch all data sources
    console.log("📚 Fetching all data sources...");
    const quranVerses = await dataRepository.getQuranVerses();
    const hadiths = await dataRepository.getHadith();
    const tafsirDocs = await dataRepository.getTafsir();

    console.log(`📖 Quran verses: ${quranVerses.length}`);
    console.log(`📖 Hadiths: ${hadiths.length}`);
    console.log(`📖 Tafsir: ${tafsirDocs.length}`);

    // Apply sampling if needed
    const maxDocuments = process.env.MAX_DOCUMENTS_TO_INDEX
      ? parseInt(process.env.MAX_DOCUMENTS_TO_INDEX, 10)
      : Infinity;

    const maxTafsirDocs = process.env.MAX_TAFSIR_DOCUMENTS
      ? parseInt(process.env.MAX_TAFSIR_DOCUMENTS, 10)
      : tafsirDocs.length;

    // Sample proportionally
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
      maxTafsirDocs,
      Math.floor((tafsirDocs.length / totalAvailable) * maxDocuments)
    );

    const sampledQuran = sampleDocuments(quranVerses, quranSampleSize);
    const sampledHadith = sampleDocuments(hadiths, hadithSampleSize);
    const sampledTafsir = tafsirDocs.slice(0, tafsirSampleSize);

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

    console.log(`\n📊 Data Summary:`);
    console.log(`   Total available: ${totalAvailable} documents`);
    console.log(
      `   Quran: ${quranVerses.length} (sampling ${sampledQuran.length})`
    );
    console.log(
      `   Hadith: ${hadiths.length} (sampling ${sampledHadith.length})`
    );
    console.log(
      `   Tafsir: ${tafsirDocs.length} (using ${sampledTafsir.length})`
    );
    console.log(`   Total to index: ${documents.length} documents\n`);

    // Initialize new index
    vectorRepository.initIndex(documents.length);

    const metadata: Metadata[] = [];
    const BATCH_SIZE = 100;
    const DELAY_MS = 100;

    console.log("🔧 Generating embeddings...");

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((d) => d.text);

      if (i > 0 && DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      try {
        const embeddings = await embeddingService.embedBatch(batchTexts);

        for (let j = 0; j < embeddings.length; j++) {
          const globalIndex = i + j;
          const normalizedEmbedding = normalizeVector(embeddings[j]);
          vectorRepository.addPoint(normalizedEmbedding, globalIndex);

          metadata.push({
            id: globalIndex,
            text: batch[j].text,
            source: batch[j].source,
          });
        }

        const progress = Math.min(i + BATCH_SIZE, documents.length);
        console.log(
          `   ✓ Embedded ${progress}/${
            documents.length
          } documents (${Math.round((progress / documents.length) * 100)}%)`
        );

        // Checkpoint every 500 documents
        if (progress % 500 === 0 || progress === documents.length) {
          console.log(`💾 Checkpointing at ${progress} documents...`);
          await vectorRepository.saveIndex(metadata);
        }
      } catch (batchError) {
        console.error(
          `❌ Error processing batch starting at index ${i}:`,
          batchError
        );
        console.log("💾 Saving progress before exit...");
        await vectorRepository.saveIndex(metadata);
        throw batchError;
      }
    }

    console.log("💾 Saving final index...");
    await vectorRepository.saveIndex(metadata);

    console.log(`\n🎉 Successfully built complete index!`);
    console.log(`📈 Total documents indexed: ${metadata.length}`);
    console.log(`   - Quran verses: ${sampledQuran.length}`);
    console.log(`   - Hadiths: ${sampledHadith.length}`);
    console.log(`   - Tafsir entries: ${sampledTafsir.length}`);
  } catch (error) {
    console.error("❌ Error building index with Tafsir:", error);
    throw error;
  } finally {
    await closeDatabaseConnection();
  }
}

function sampleDocuments<T>(documents: T[], sampleSize: number): T[] {
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

if (require.main === module) {
  rebuildIndexWithTafsir()
    .then(() => {
      console.log("✅ Index rebuild with Tafsir completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Failed to rebuild index:", error.message);
      process.exit(1);
    });
}
