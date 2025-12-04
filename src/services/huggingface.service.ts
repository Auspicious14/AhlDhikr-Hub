import { HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL =
  process.env.HUGGINGFACE_MODEL || "BAAI/bge-small-en-v1.5";

export class HuggingFaceService {
  private hf: HfInference;
  private model: string;

  constructor() {
    if (!HUGGINGFACE_API_KEY) {
      throw new Error(
        "HUGGINGFACE_API_KEY is not set in the environment variables.\n" +
          "Get a free key at: https://huggingface.co/settings/tokens"
      );
    }

    this.hf = new HfInference(HUGGINGFACE_API_KEY);
    this.model = HUGGINGFACE_MODEL;

    console.log(`📦 Hugging Face SDK initialized with model: ${this.model}`);
  }

  /**
   * Generate embeddings for a given text using Hugging Face Inference API
   * @param text - The text to embed
   * @returns A vector representation of the text
   */
  async embedContent(text: string): Promise<number[]> {
    try {
      // Use the official SDK's featureExtraction method
      const result = await this.hf.featureExtraction({
        model: this.model,
        inputs: text,
      });

      // The SDK returns the embedding directly
      let embedding: number[];

      if (Array.isArray(result)) {
        // Check if it's a nested array (some models return [[...]])
        if (Array.isArray(result[0])) {
          embedding = result[0] as number[];
        } else {
          embedding = result as number[];
        }
      } else {
        throw new Error("Unexpected response format from Hugging Face API");
      }

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Empty or invalid embedding received");
      }

      return embedding;
    } catch (error: any) {
      // Handle specific error cases
      if (error.message?.includes("401")) {
        throw new Error(
          "Invalid Hugging Face API key. Please check your HUGGINGFACE_API_KEY in .env file.\n" +
            "Get a free key at: https://huggingface.co/settings/tokens"
        );
      } else if (error.message?.includes("404")) {
        throw new Error(
          `Model '${this.model}' not found. Please check HUGGINGFACE_MODEL in .env file.\n` +
            "Recommended models:\n" +
            "  - BAAI/bge-small-en-v1.5 (384 dim, fast, good for retrieval)\n" +
            "  - sentence-transformers/all-MiniLM-L6-v2 (384 dim, fast)\n" +
            "  - sentence-transformers/all-mpnet-base-v2 (768 dim, better quality)"
        );
      } else if (
        error.message?.includes("503") ||
        error.message?.includes("loading")
      ) {
        // Model is loading
        console.log("⏳ Model is loading, waiting 20 seconds...");
        await this.delay(20000);
        return this.embedContent(text); // Retry once
      } else if (error.message?.includes("429")) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again.\n" +
            "Free tier: 30,000 requests/month\n" +
            "Consider using local embeddings for unlimited requests."
        );
      }

      // Generic error
      throw new Error(
        `Hugging Face API error: ${error.message}\n` +
          "If this persists, try using local embeddings instead:\n" +
          "  EMBEDDING_PROVIDER=local\n" +
          "  npm install @xenova/transformers"
      );
    }
  }

  /**
   * Get the dimension of embeddings for the current model
   */
  getEmbeddingDimension(): number {
    // Common dimensions for popular models
    const dimensions: { [key: string]: number } = {
      "BAAI/bge-small-en-v1.5": 384,
      "sentence-transformers/all-MiniLM-L6-v2": 384,
      "sentence-transformers/all-mpnet-base-v2": 768,
      "BAAI/bge-base-en-v1.5": 768,
      "BAAI/bge-large-en-v1.5": 1024,
    };

    return dimensions[this.model] || 384; // Default to 384
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
