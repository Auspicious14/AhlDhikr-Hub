// Local embedding service using Transformers.js
// This is optional - only works if @xenova/transformers is installed

export class LocalEmbeddingService {
  private extractor: any = null;
  private modelName: string;
  private transformers: any = null;

  constructor(modelName: string = "Xenova/all-MiniLM-L6-v2") {
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
      // Dynamic import to make @xenova/transformers optional
      this.transformers = await import("@xenova/transformers");

      // Configure transformers.js to use local cache
      this.transformers.env.cacheDir = "./models";

      console.log(`Loading local embedding model: ${this.modelName}...`);
      console.log(
        "(This may take a few minutes on first run to download the model)"
      );

      this.extractor = await this.transformers.pipeline(
        "feature-extraction",
        this.modelName
      );

      console.log("✓ Local embedding model loaded successfully!");
    } catch (error) {
      throw new Error(
        "Failed to load local embeddings. Please install @xenova/transformers:\n" +
          "  npm install @xenova/transformers\n\n" +
          "Or use a different embedding provider (huggingface or gemini) in your .env file."
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
    } catch (error) {
      throw new Error(`Local embedding error: ${error}`);
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
