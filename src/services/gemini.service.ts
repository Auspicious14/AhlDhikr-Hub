import {
  GoogleGenerativeAI,
  GenerativeModel,
  TaskType,
} from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

export class GeminiService {
  private embeddingModel: GenerativeModel;
  private generativeModel: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // Model for Embeddings (768 dimensions)
    this.embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

    // Model for RAG generation (Fast & Cheap)
    this.generativeModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
  }

  /**
   * Embeds a single query (User Question)
   * Optimized for Vercel Runtime
   */
  async embedQuery(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent({
        content: { parts: [{ text }], role: "USER" },
        taskType: TaskType.RETRIEVAL_QUERY,
      });
      return result.embedding.values;
    } catch (error) {
      console.error("Gemini Embedding Error:", error);
      throw error;
    }
  }

  /**
   * Embeds a list of documents in BATCHES.
   * CRITICAL: Using batchEmbedContents reduces API calls by 100x.
   * * @param texts Array of strings to embed
   * @returns Array of embedding arrays
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      // The API supports up to 100 requests per batch
      // We process them all in one network call
      const requests = texts.map((t) => ({
        content: { parts: [{ text: t }], role: "USER" },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      }));

      const result = await this.embeddingModel.batchEmbedContents({
        requests: requests,
      });

      if (!result.embeddings) return [];
      return result.embeddings.map((e) => e.values);
    } catch (error) {
      console.error("Batch Embedding Error:", error);
      throw error;
    }
  }

  /**
   * Generates the answer using the retrieved context
   */
  async generateAnswer(question: string, context: string[]): Promise<string> {
    const systemPrompt = `You are an Islamic scholar AI. Answer strictly using the provided sources.
- Cite sources format: [Source: ...].
- If unsure based on sources, say 'I don't have enough information in the sources'.
- Translate Arabic terms on first use.
- Be respectful and precise.`;

    const prompt = [
      systemPrompt,
      "--- SOURCES START ---",
      ...context.map((c, i) => `Source ${i + 1}: ${c}`),
      "--- SOURCES END ---",
      `Question: ${question}`,
    ].join("\n\n");

    try {
      const result = await this.generativeModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      throw new Error("Failed to generate answer.");
    }
  }
}
