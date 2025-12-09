// Local embedding service using Transformers.js
// Note: @xenova/transformers is an ES Module, so we use dynamic import

export class LocalEmbeddingService {
  private extractor: any = null;
  private modelName: string;
  private transformers: any = null;

  constructor(modelName: string = "Xenova/bge-m3") {
    this.modelName = modelName;
  }

  /**
   * Initialize the embedding model (downloads on first run)
   */
  async initialize(): Promise<void> {
    if (this.extractor) {
      return; // Already initialized
    }

    try {
      console.log(`📥 Loading local embedding model: ${this.modelName}...`);
      console.log(
        "⏳ (This may take a few minutes on first run to download the model ~90MB)"
      );

      // Dynamic import for ES Module
      this.transformers = await eval('import("@xenova/transformers")');

      // Configure cache directory
      this.transformers.env.cacheDir = "./models";

      // Load the pipeline
      this.extractor = await this.transformers.pipeline(
        "feature-extraction",
        this.modelName
      );

      console.log("✅ Local embedding model loaded successfully!");
    } catch (error: any) {
      console.error("❌ Failed to load local embeddings:", error.message);
      throw new Error(
        "Failed to load local embeddings. Error: " +
          error.message +
          "\n\n" +
          "Troubleshooting:\n" +
          "1. Make sure @xenova/transformers is installed: npm install @xenova/transformers\n" +
          "2. Check your internet connection (needed for first-time model download)\n" +
          "3. Or use a different embedding provider in your .env file:\n" +
          "   EMBEDDING_PROVIDER=huggingface"
      );
    }
  }

  /**
   * Generate embeddings for a given text using local model
   * @param text - The text to embed
   * @returns A vector representation of the text
   */
  async embedContent(text: string): Promise<number[]> {
    if (!this.extractor) {
      await this.initialize();
    }

    try {
      // Generate embeddings
      const output = await this.extractor(text, {
        pooling: "mean",
        normalize: true,
      });

      // Convert tensor to array
      const embedding: number[] = Array.from(output.data) as number[];

      return embedding;
    } catch (error: any) {
      throw new Error(`Local embedding error: ${error.message}`);
    }
  }

  /**
   * Get the dimension of embeddings for the current model
   */
  getEmbeddingDimension(): number {
    const dimensions: { [key: string]: number } = {
      "Xenova/all-MiniLM-L6-v2": 384,
      "Xenova/all-mpnet-base-v2": 768,
      "Xenova/bge-small-en-v1.5": 384,
      "Xenova/bge-m3": 1024,
    };

    return dimensions[this.modelName] || 384;
  }

  /**
   * Batch process multiple texts (more efficient)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.extractor) {
      await this.initialize();
    }

    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embedContent(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}
