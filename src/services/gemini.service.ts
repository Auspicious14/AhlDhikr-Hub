import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

export class GeminiService {
  private embeddingModel: GenerativeModel;
  private generativeModel: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set in the environment variables."
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    // Use gemini-2.5-flash-lite for fast responses
    this.generativeModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
  }

  async embedContent(text: string): Promise<number[]> {
    const result = await this.embeddingModel.embedContent(text);
    return result.embedding.values;
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

  /**
   * Generate answer with streaming support
   * Yields chunks of text as they arrive from Gemini
   */
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

      // Stream the response chunks
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
