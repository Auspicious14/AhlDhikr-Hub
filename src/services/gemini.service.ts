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
    const systemPrompt = `You are an Islamic scholar AI. Your purpose is to answer questions about Islam, but only using the provided sources.
- Cite your sources verbatim using the format [Source: ...].
- If the provided texts do not contain the answer, you must state 'I don't have enough information in the sources to answer this question.'.
- On the first use of an Arabic term, provide the English translation, for example: 'Sahih (Authentic)'.
- Do not use any information you were not given.`;

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
    const systemPrompt = `You are an Islamic scholar AI. Your purpose is to answer questions about Islam, but only using the provided sources.
- Cite your sources verbatim using the format [Source: ...].
- If the provided texts do not contain the answer, you must state 'I don't know'.
- On the first use of an Arabic term, provide the English translation, for example: 'Sahih (Authentic)'.
- Do not use any information you were not given.`;

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
