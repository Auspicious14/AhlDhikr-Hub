// test-brute-force-search.ts

import { connectToDatabase } from "./services/mongo.service";
import { VectorRepository } from "./repositories/vector.repository";
import { EmbeddingService } from "./services/embedding.service";

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function normalizeVector(v: number[]): number[] {
  const magnitude = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  if (magnitude === 0) return v;
  return v.map((val) => val / magnitude);
}

async function bruteForceSearch() {
  await connectToDatabase();

  const embeddingService = new EmbeddingService("local");
  await embeddingService.initialize();

  const vectorRepo = new VectorRepository(1024);
  const loaded = await vectorRepo.loadIndex();

  if (!loaded) {
    console.log("❌ No index found!");
    return;
  }

  const { metadata } = loaded;

  console.log("\n=== BRUTE FORCE SEARCH TEST ===\n");

  const query = "What are the five pillars of Islam?";
  console.log(`Query: "${query}"\n`);

  // Get query embedding using the NEW embedQuery method
  console.log("Getting query embedding...");
  const queryEmbed = await embeddingService.embedQuery(query);
  const normalizedQuery = normalizeVector(queryEmbed);

  console.log(`Query embedding dimension: ${queryEmbed.length}`);
  console.log(
    `First 5 values: [${queryEmbed
      .slice(0, 5)
      .map((v) => v.toFixed(4))
      .join(", ")}]\n`
  );

  // Brute force: calculate similarity with ALL documents
  console.log(
    "Computing similarities with all documents (this may take a moment)...\n"
  );

  interface ScoredDoc {
    id: number;
    score: number;
    source: string;
    text: string;
  }

  const similarities: ScoredDoc[] = [];

  // You need to get the actual embeddings from your index
  // For now, let's just search using HNSW with high ef
  console.log("Using HNSW search with ef=500 (high recall)...");

  // Set very high ef for maximum recall
  const results = vectorRepo.search(normalizedQuery, 10);

  console.log("\n📊 TOP 10 RESULTS FROM HNSW:\n");
  results.forEach((id, i) => {
    const doc = metadata[id];
    if (doc) {
      console.log(`${i + 1}. Score: [from HNSW]`);
      console.log(`   Source: ${doc.source}`);
      console.log(`   Text: ${doc.text.substring(0, 150)}...\n`);
    }
  });

  // Now let's manually check documents that SHOULD match
  console.log("\n=== MANUAL CHECK: Documents containing 'pillar' ===\n");

  const pillarDocs = metadata.filter((m) =>
    m.text.toLowerCase().includes("pillar")
  );

  console.log(`Found ${pillarDocs.length} documents containing "pillar"`);
  pillarDocs.slice(0, 5).forEach((doc) => {
    console.log(`\n- ${doc.source}`);
    console.log(`  ${doc.text.substring(0, 200)}...`);
  });

  process.exit(0);
}

bruteForceSearch();
