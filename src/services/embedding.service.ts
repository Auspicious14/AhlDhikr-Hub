import { GeminiService } from "./gemini.service";
import { HuggingFaceService } from "./huggingface.service";
import { LocalEmbeddingService } from "./local-embedding.service";
import * as dotenv from "dotenv";

dotenv.config();

export type EmbeddingProvider = "gemini" | "huggingface" | "local";

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private service: GeminiService | HuggingFaceService | LocalEmbeddingService;

  constructor(provider?: EmbeddingProvider) {
    this.provider = provider || this.detectProvider();
    this.service = this.createService();

    console.log(`🔧 Using embedding provider: ${this.provider.toUpperCase()}`);
  }

  private detectProvider(): EmbeddingProvider {
    const envProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();

    if (
      envProvider === "gemini" ||
      envProvider === "huggingface" ||
      envProvider === "local"
    ) {
      return envProvider;
    }

    if (process.env.HUGGINGFACE_API_KEY) {
      return "huggingface";
    }

    if (process.env.GEMINI_API_KEY) {
      return "gemini";
    }

    return "local";
  }

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
        const localModel = process.env.LOCAL_MODEL || "Xenova/bge-m3";
        return new LocalEmbeddingService(localModel);
      default:
        throw new Error(`Unknown embedding provider: ${this.provider}`);
    }
  }

  async initialize(): Promise<void> {
    if (this.service instanceof LocalEmbeddingService) {
      await this.service.initialize();
    }
  }

  async embedContent(text: string): Promise<number[]> {
    return await this.service.embedContent(text);
  }

  
  async embedQuery(query: string): Promise<number[]> {
    
    if (
      this.service instanceof LocalEmbeddingService ||
      this.service instanceof HuggingFaceService
    ) {
      return await this.service.embedQuery(query);
    }
    
    return await this.service.embedContent(query);
  }

  getProvider(): string {
    return this.provider;
  }

  getEmbeddingDimension(): number {
    if (
      this.service instanceof HuggingFaceService ||
      this.service instanceof LocalEmbeddingService
    ) {
      return this.service.getEmbeddingDimension();
    }
  
    return 768;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.service instanceof LocalEmbeddingService) {
      return await this.service.embedBatch(texts);
    }

    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      embeddings.push(await this.service.embedContent(texts[i]));
      
      if (i < texts.length - 1) {
        await this.delay(100);
      }
    }
    return embeddings;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
