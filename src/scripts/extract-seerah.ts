import * as fs from "fs/promises";
import * as path from "path";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

interface SeerahEntry {
  topic: string;
  content: string;
  source: string;
}

async function extractSeerahFromPDF() {
  const pdfPath = process.argv[2] || "./sealed-nectar.pdf";
  const outputPath = process.argv[3] || "./data/seerah.json";

  console.log(`📖 Reading PDF: ${pdfPath}`);

  const dataBuffer = await fs.readFile(pdfPath);
  const pdfData = await new PDFParse({
    data: dataBuffer,
  });
  const fullText = await pdfData.getText();

  console.log(`📄 Total pages: ${fullText.pages}`);
  console.log(`📝 Total text length: ${fullText.text.length} characters`);

  // Split into chunks (Gemini has ~1M token limit, but let's be safe)
  const CHUNK_SIZE = 30000; // characters per chunk
  const chunks: string[] = [];

  for (let i = 0; i < fullText.text.length; i += CHUNK_SIZE) {
    chunks.push(fullText.text.slice(i, i + CHUNK_SIZE));
  }

  console.log(`✂️ Split into ${chunks.length} chunks for processing`);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const allEntries: SeerahEntry[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`🤖 Processing chunk ${i + 1}/${chunks.length}...`);

    const prompt = `You are extracting structured knowledge from "The Sealed Nectar" (Ar-Raheeq Al-Makhtum), a biography of Prophet Muhammad (peace be upon him).

Extract key facts, events, and information from this text chunk. For each piece of information, create a JSON object with:
- "topic": A clear, searchable topic (e.g., "Birth of the Prophet", "Battle of Badr", "Treaty of Hudaybiyyah")
- "content": The factual content (2-4 sentences max, clear and concise)
- "source": Always "Ar-Raheeq Al-Makhtum (The Sealed Nectar)"

Guidelines:
- Focus on historical facts, dates, names, events
- Keep content concise and factual
- Avoid repetition
- Each entry should be self-contained and searchable
- Extract 5-15 entries per chunk depending on content density

Return ONLY valid JSON array format, no markdown, no explanation:
[
  {
    "topic": "...",
    "content": "...",
    "source": "Ar-Raheeq Al-Makhtum (The Sealed Nectar)"
  }
]

Text chunk to process:
${chunks[i]}`;

    try {
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Error processing chunk ${i + 1}:`, error);
      console.error("Continuing with next chunk...");
    }
  }

  console.log(`\n📊 Total entries extracted: ${allEntries.length}`);

  // Remove duplicates based on topic
  const uniqueEntries = Array.from(
    new Map(
      allEntries.map((entry) => [entry.topic.toLowerCase(), entry])
    ).values()
  );

  console.log(`🧹 After deduplication: ${uniqueEntries.length} unique entries`);

  // Save to JSON
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(chunks, null, 2));

  console.log(`✅ Saved to: ${outputPath}`);
  console.log(`\n📝 Sample entries:`);
  console.log(JSON.stringify(uniqueEntries.slice(0, 3), null, 2));
}

if (require.main === module) {
  extractSeerahFromPDF()
    .then(() => {
      console.log("\n✅ Seerah extraction completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Failed to extract Seerah:", error);
      process.exit(1);
    });
}

export { extractSeerahFromPDF };
