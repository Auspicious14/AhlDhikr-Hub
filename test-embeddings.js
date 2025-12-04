#!/usr/bin/env node

/**
 * Test script to verify embedding providers are working correctly
 * Run with: node test-embeddings.js
 */

require("dotenv").config();

async function testEmbeddings() {
  console.log("🧪 Testing Embedding Providers\n");
  console.log("================================\n");

  // Test 1: Check environment variables
  console.log("📋 Step 1: Checking environment variables...");
  const provider = process.env.EMBEDDING_PROVIDER || "auto-detect";
  console.log(`   Provider: ${provider}`);

  if (process.env.HUGGINGFACE_API_KEY) {
    console.log("   ✅ Hugging Face API key found");
  } else {
    console.log("   ⚠️  Hugging Face API key not found");
  }

  if (process.env.GEMINI_API_KEY) {
    console.log("   ✅ Gemini API key found");
  } else {
    console.log("   ⚠️  Gemini API key not found");
  }

  console.log("");

  // Test 2: Try to load embedding service
  console.log("📋 Step 2: Loading embedding service...");
  try {
    const { EmbeddingService } = require("./dist/services/embedding.service");
    const embeddingService = new EmbeddingService();
    console.log(`   ✅ Embedding service loaded`);
    console.log(`   Provider selected: ${embeddingService.getProvider()}`);
    console.log("");

    // Test 3: Initialize service
    console.log("📋 Step 3: Initializing service...");
    await embeddingService.initialize();
    console.log("   ✅ Service initialized successfully");
    console.log("");

    // Test 4: Generate a test embedding
    console.log("📋 Step 4: Generating test embedding...");
    const testText = "This is a test sentence for embedding generation.";
    const startTime = Date.now();
    const embedding = await embeddingService.embedContent(testText);
    const endTime = Date.now();

    console.log(`   ✅ Embedding generated successfully`);
    console.log(`   Dimension: ${embedding.length}`);
    console.log(`   Time taken: ${endTime - startTime}ms`);
    console.log(
      `   First 5 values: [${embedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}...]`
    );
    console.log("");

    // Test 5: Summary
    console.log("================================");
    console.log("✅ All tests passed!");
    console.log("");
    console.log("Your embedding service is working correctly.");
    console.log(`You can now run: npm run build-index`);
    console.log("");
  } catch (error) {
    console.error("   ❌ Error:", error.message);
    console.log("");
    console.log("================================");
    console.log("❌ Tests failed!");
    console.log("");
    console.log("Troubleshooting:");
    console.log("1. Make sure you have built the project: npm run build");
    console.log("2. Check your .env file has the correct API keys");
    console.log(
      "3. If using local embeddings, install: npm install @xenova/transformers"
    );
    console.log("");
    process.exit(1);
  }
}

// Run tests
testEmbeddings().catch(console.error);
