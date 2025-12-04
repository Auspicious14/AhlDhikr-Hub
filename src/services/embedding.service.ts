import { GeminiService } from "./gemini.service";
import { HuggingFaceService } from "./huggingface.service";
import { LocalEmbeddingService } from "./local-embedding.service";
import * as dotenv from "dotenv";

dotenv.config();

export type EmbeddingProvider = "gemini" | "huggingface" | "local";

/**
 * Unified embedding service that supports multiple providers
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;
  private service: GeminiService | HuggingFaceService | LocalEmbeddingService;

  constructor(provider?: EmbeddingProvider) {
    // Auto-detect provider from environment or use specified one
    this.provider = provider || this.detectProvider();
    this.service = this.createService();

    console.log(`🔧 Using embedding provider: ${this.provider.toUpperCase()}`);
  }

  /**
   * Auto-detect which provider to use based on available API keys
   */
  private detectProvider(): EmbeddingProvider {
    const envProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();

    // If explicitly set in environment, use that
    if (
      envProvider === "gemini" ||
      envProvider === "huggingface" ||
      envProvider === "local"
    ) {
      return envProvider;
    }

    // Auto-detect based on available API keys
    if (process.env.HUGGINGFACE_API_KEY) {
      return "huggingface";
    }

    if (process.env.GEMINI_API_KEY) {
      return "gemini";
    }

    // Default to local (always works, no API key needed)
    return "local";
  }

  /**
   * Create the appropriate service instance
   */
  private createService():
    | GeminiService
    | HuggingFaceService
    | LocalEmbeddingService {
    switch (this.provider) {
      case "gemini":
        return new GeminiService();
      case "huggingface":
        return new HuggingFaceService();
      case "local":
        return new LocalEmbeddingService();
      default:
        throw new Error(`Unknown embedding provider: ${this.provider}`);
    }
  }

  /**
   * Initialize the service (required for local embeddings)
   */
  async initialize(): Promise<void> {
    if (this.service instanceof LocalEmbeddingService) {
      await this.service.initialize();
    }
  }

  /**
   * Generate embeddings for a given text
   */
  async embedContent(text: string): Promise<number[]> {
    return await this.service.embedContent(text);
  }

  /**
   * Get the current provider name
   */
  getProvider(): string {
    return this.provider;
  }

  /**
   * Get embedding dimension for the current provider
   */
  getEmbeddingDimension(): number {
    if (
      this.service instanceof HuggingFaceService ||
      this.service instanceof LocalEmbeddingService
    ) {
      return this.service.getEmbeddingDimension();
    }
    // Gemini uses 768 dimensions
    return 768;
  }
}
