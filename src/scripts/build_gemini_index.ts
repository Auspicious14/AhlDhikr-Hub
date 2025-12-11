/**
 * Run this script LOCALLY to build the index.
 * Usage: npx ts-node scripts/build_gemini_index.ts
 */

import * as fs from "fs";
import * as path from "path";
import { GeminiService } from "../services/gemini.service";
import { Metadata } from "../models/types";
import { VectorRepository } from "../repositories/vector.repository";

// Paths to your JSON data files
const QURAN_PATH = path.join(__dirname, "../../data/quran.json");
const HADITH_PATH = path.join(__dirname, "../../data/hadith.json");

// Batch size for Gemini API (Max is 100)
const BATCH_SIZE = 100;
// Delay between batches to be safe with rate limits (in ms)
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Gemini Index Build...");

  const geminiService = new GeminiService();

  // Initialize Repository with Dimension 768 (Gemini)
  const vectorRepo = new VectorRepository(768);

  // 1. Load Data
  console.log("📂 Loading JSON files...");
  // Adjust these parsing logic based on your actual JSON structure
  const quranData = JSON.parse(fs.readFileSync(QURAN_PATH, "utf-8"));
  const hadithData = JSON.parse(fs.readFileSync(HADITH_PATH, "utf-8"));

  // Flatten into a single array of text + metadata
  // Modify 'item.text' or 'item.content' based on your JSON structure
  const allDocuments: { text: string; meta: Metadata }[] = [
    ...quranData.map((item: any) => ({
      text: `${item.surahName} (${item.surahNumber}:${item.ayahNumber}): ${item.englishText}`,
      meta: {
        source: `Quran ${item.surahNumber}:${item.ayahNumber}`,
        text: item.englishText,
        type: "quran",
      },
    })),
    ...hadithData.map((item: any) => ({
      text: `Hadith (${item.book}): ${item.text}`,
      meta: {
        source: `Hadith ${item.book} #${item.number}`,
        text: item.text,
        type: "hadith",
      },
    })),
  ];

  console.log(`📊 Total documents to index: ${allDocuments.length}`);

  // 2. Initialize Index
  // We initialize with the total count so HNSW knows how much memory to allocate
  vectorRepo.initIndex(allDocuments.length);

  // 3. Process in Batches
  let processedCount = 0;

  for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
    const batch = allDocuments.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map((d) => d.text);

    console.log(
      `⚡ Processing batch ${Math.ceil(i / BATCH_SIZE) + 1}/${Math.ceil(
        allDocuments.length / BATCH_SIZE
      )} (${batch.length} items)...`
    );

    try {
      // Get embeddings for the whole batch in ONE call
      const embeddings = await geminiService.embedBatch(batchTexts);

      // Add to vector index
      embeddings.forEach((embedding, index) => {
        const docIndex = processedCount + index;
        vectorRepo.addPoint(embedding, docIndex);
      });

      processedCount += batch.length;

      // Respect Rate Limits
      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`❌ Error in batch starting at index ${i}:`, error);
      // Optional: Add logic here to save progress or retry
      // For now, we break to avoid corrupted indices
      process.exit(1);
    }
  }

  // 4. Extract just the metadata array for saving
  const metadataList = allDocuments.map((d) => d.meta);

  // 5. Save to MongoDB
  console.log("💾 Saving index to MongoDB...");
  await vectorRepo.saveIndex(metadataList);

  console.log("✅ Build Complete! Index is live on MongoDB.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
