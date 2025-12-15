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

    this.embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

    this.generativeModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
  }

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

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
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

  async generateAnswer(question: string, context: string[]): Promise<string> {
    const systemPrompt = `You are a knowledgeable Islamic Scholar Assistant.
    
    YOUR KNOWLEDGE BASE:
    You have been provided with specific excerpts from the Quran, Hadith, Tasfir and Seerah (Biography).

    INSTRUCTIONS:
    1. **Prioritize Explicit Text:** If the answer is found directly in the provided [Context], cite it as [Source: ...].
    2. **Synthesize Facts:** If the user asks a factual question (e.g., "How many wives?", "When was the Battle of Badr?"), look for "Seerah" or "Historical Consensus" in the provided context.
    3. **Handle Gaps Gracefully:** - If the context contains related hadith but NOT the exact answer (e.g., mention of a wife, but not the total number), DO NOT guess.
       - Instead, state: "The specific sources provided generally discuss [Topic found in context], but do not explicitly state [Missing Detail]."
    4. **Tone:** Respectful, precise, and academic.

    CONTEXT provided for this question:
    ${context.join("\n\n")}

    Question: ${question}`;
    const prompt = [
      systemPrompt,
      "Here are the sources:",
      ...context.map((c, i) => `Source ${i + 1}: ${c}`),
      `\nQuestion: ${question}`,
    ].join("\n\n");

    try {
      const result = await this.generativeModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating answer from Gemini:", error);
      throw new Error("Failed to generate answer.");
    }
  }

  async *generateAnswerStream(
    question: string,
    context: string[]
  ): AsyncGenerator<string> {
    const systemPrompt = `You are a knowledgeable Islamic Scholar Assistant.
    
    YOUR KNOWLEDGE BASE:
    You have been provided with specific excerpts from the Quran, Hadith, Tasir and Seerah (Biography).

    INSTRUCTIONS:
    1. **Prioritize Explicit Text:** If the answer is found directly in the provided [Context], cite it as [Source: ...].
    2. **Synthesize Facts:** If the user asks a factual question (e.g., "How many wives?", "When was the Battle of Badr?"), look for "Seerah" or "Historical Consensus" in the provided context.
    3. **Handle Gaps Gracefully:** - If the context contains related hadith but NOT the exact answer (e.g., mention of a wife, but not the total number), DO NOT guess.
       - Instead, state: "The specific sources provided generally discuss [Topic found in context], but do not explicitly state [Missing Detail]."
    4. **Tone:** Respectful, precise, and academic.

    CONTEXT provided for this question:
    ${context.join("\n\n")}

    Question: ${question}`;
    const prompt = [
      systemPrompt,
      "Here are the sources:",
      ...context.map((c, i) => `Source ${i + 1}: ${c}`),
      `\nQuestion: ${question}`,
    ].join("\n\n");

    try {
      const result = await this.generativeModel.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error("Error streaming answer from Gemini:", error);
      throw new Error("Failed to stream answer.");
    }
  }
}
