// check-index-content.ts

import { VectorRepository } from "./repositories/vector.repository";
import { connectToDatabase } from "./services/mongo.service";

async function checkIndexContent() {
  await connectToDatabase();

  const vectorRepo = new VectorRepository(1024);
  const loaded = await vectorRepo.loadIndex();

  if (!loaded) {
    console.log("❌ No index found!");
    return;
  }

  const { metadata } = loaded;

  console.log(`\n📚 Total indexed documents: ${metadata.length}\n`);

  // Search for relevant keywords
  const keywords = [
    "pillar",
    "pillars",
    "salah",
    "prayer",
    "zakat",
    "charity",
    "sawm",
    "fasting",
    "ramadan",
    "hajj",
    "pilgrimage",
    "shahada",
    "testimony",
  ];

  console.log(
    "🔎 Searching for documents containing pillar-related keywords:\n"
  );

  keywords.forEach((keyword) => {
    const matches = metadata.filter((m) =>
      m.text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matches.length > 0) {
      console.log(`✅ "${keyword}": Found ${matches.length} documents`);
      // Show first match
      const first = matches[0];
      console.log(`   Example: ${first.source}`);
      console.log(`   Text: ${first.text.substring(0, 150)}...\n`);
    } else {
      console.log(`❌ "${keyword}": No documents found\n`);
    }
  });

  // Check if specific important verses are indexed
  console.log("\n📖 Checking for key verses about pillars:\n");

  const keyVerses = [
    { ref: "2:177", text: "righteousness" }, // Mentions prayer, charity
    { ref: "2:183", text: "fasting" }, // About Ramadan
    { ref: "9:5", text: "prayer" }, // About Salah
    { ref: "22:27", text: "hajj" }, // About Hajj
  ];

  keyVerses.forEach((verse) => {
    const found = metadata.find(
      (m) =>
        m.source.includes(verse.ref) ||
        m.text.toLowerCase().includes(verse.text)
    );

    if (found) {
      console.log(`✅ Found verse containing "${verse.text}"`);
      console.log(`   ${found.source}`);
      console.log(`   ${found.text.substring(0, 100)}...\n`);
    } else {
      console.log(`❌ Verse about "${verse.text}" not found\n`);
    }
  });

  process.exit(0);
}

checkIndexContent();
