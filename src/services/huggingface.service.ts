import { FeatureExtractionOutput, HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
// Use BGE-M3 to match your local embeddings (1024 dimensions)
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || "BAAI/bge-m3";

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
   * Generate embeddings for DOCUMENTS (during indexing)
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
      return this.handleError(error);
    }
  }

  /**
   * Generate embeddings for QUERIES (during search)
   * Adds instruction prefix for BGE models
   * @param query - The query text to embed
   * @returns A vector representation of the query
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      // Add instruction prefix for BGE models (critical for accuracy!)
      const instructedQuery = `Represent this sentence for searching relevant passages: ${query}`;

      const result = await this.hf.featureExtraction({
        model: this.model,
        inputs: instructedQuery,
      });

      let embedding: number[];

      if (Array.isArray(result)) {
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
      return this.handleError(error);
    }
  }

  /**
   * Centralized error handling
   */
  private async handleError(error: any): Promise<never> {
    // Handle specific error cases
    if (
      error.message?.includes("401") ||
      error.message?.includes("Invalid token")
    ) {
      throw new Error(
        "Invalid Hugging Face API key. Please check your HUGGINGFACE_API_KEY in .env file.\n" +
          "Get a free key at: https://huggingface.co/settings/tokens"
      );
    }

    if (error.message?.includes("404")) {
      throw new Error(
        `Model '${this.model}' not found. Please check HUGGINGFACE_MODEL in .env file.\n` +
          "Recommended models (with dimensions):\n" +
          "  - BAAI/bge-m3 (1024 dim, best for multilingual, matches your local setup)\n" +
          "  - BAAI/bge-small-en-v1.5 (384 dim, fast, English only)\n" +
          "  - sentence-transformers/all-MiniLM-L6-v2 (384 dim, fast)\n" +
          "  - sentence-transformers/all-mpnet-base-v2 (768 dim, better quality)"
      );
    }

    if (
      error.message?.includes("503") ||
      error.message?.includes("loading") ||
      error.message?.includes("currently loading")
    ) {
      // Model is loading - retry with exponential backoff
      console.log("⏳ Model is loading, waiting and retrying...");

      let retries = 3;
      let delay = 10000; // Start with 10 seconds

      for (let i = 0; i < retries; i++) {
        console.log(`   Retry ${i + 1}/${retries} after ${delay / 1000}s...`);
        await this.delay(delay);

        try {
          // Retry the original request
          const result = await this.hf.featureExtraction({
            model: this.model,
            inputs: error.originalInput || "",
          });

          let embedding: FeatureExtractionOutput;
          if (Array.isArray(result)) {
            embedding = Array.isArray(result[0]) ? result[0] : result;
          } else {
            throw new Error("Unexpected format");
          }

          return embedding as never;
        } catch (retryError) {
          if (i === retries - 1) {
            // Last retry failed
            throw new Error(
              "Model is still loading after multiple retries.\n" +
                "This can happen with large models on first use.\n" +
                "Please try again in a few minutes or use a smaller model:\n" +
                "  HUGGINGFACE_MODEL=BAAI/bge-small-en-v1.5"
            );
          }
          delay *= 2; // Exponential backoff
        }
      }
    }

    if (
      error.message?.includes("429") ||
      error.message?.includes("rate limit")
    ) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again.\n" +
          "Free tier: 1,000 requests/day\n" +
          "If you need more, consider:\n" +
          "  1. Using local embeddings (unlimited)\n" +
          "  2. Upgrading to HuggingFace Pro ($9/month for 10,000 requests/day)"
      );
    }

    // Generic error
    throw new Error(
      `Hugging Face API error: ${error.message}\n` +
        "If this persists, try:\n" +
        "  1. Check your API key is valid\n" +
        "  2. Try a different model (BAAI/bge-small-en-v1.5)\n" +
        "  3. Use local embeddings: EMBEDDING_PROVIDER=local"
    );
  }

  /**
   * Get the dimension of embeddings for the current model
   */
  getEmbeddingDimension(): number {
    const dimensions: { [key: string]: number } = {
      // BGE models (best for retrieval)
      "BAAI/bge-m3": 1024,
      "BAAI/bge-large-en-v1.5": 1024,
      "BAAI/bge-base-en-v1.5": 768,
      "BAAI/bge-small-en-v1.5": 384,

      // Sentence transformers
      "sentence-transformers/all-MiniLM-L6-v2": 384,
      "sentence-transformers/all-mpnet-base-v2": 768,

      // Multilingual E5
      "intfloat/multilingual-e5-large": 1024,
      "intfloat/multilingual-e5-base": 768,
      "intfloat/multilingual-e5-small": 384,
    };

    return dimensions[this.model] || 1024; // Default to 1024 for BGE-M3
  }

  /**
   * Helper to add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
