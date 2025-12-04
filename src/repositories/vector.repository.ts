import { HierarchicalNSW } from "hnswlib-node";
import { Binary, Document } from "mongodb";
import * as fs from "fs/promises";
import * as path from "path";
import { connectToDatabase } from "../services/mongo.service";
import { Metadata } from "../models/types";

import * as os from "os";

// Default dimension (can be overridden in constructor)
const DEFAULT_DIMENSION = 768; // Gemini's embedding-001 model
const INDEX_COLLECTION = "vector_index";
const INDEX_ID = "singleton_islamic_index";
// Use os.tmpdir() for cross-platform compatibility
const TMP_INDEX_PATH = path.join(os.tmpdir(), "islamic_index.bin");

interface IndexDocument extends Document {
  _id: string;
  index_data: Binary;
  metadata: Metadata[];
  dimension: number; // Store dimension in DB
  updatedAt: Date;
}

export class VectorRepository {
  private index: HierarchicalNSW;
  private dimension: number;

  constructor(dimension?: number) {
    this.dimension = dimension || DEFAULT_DIMENSION;
    this.index = new HierarchicalNSW("cosine", this.dimension);
    console.log(
      `📐 Vector repository initialized with dimension: ${this.dimension}`
    );
  }

  /**
   * Saves the in-memory index to MongoDB by first writing it to a temporary file.
   */
  async saveIndex(metadata: Metadata[]): Promise<void> {
    const db = await connectToDatabase();
    const collection = db.collection<IndexDocument>(INDEX_COLLECTION);

    // 1. Write the index to the temporary filesystem
    await this.index.writeIndex(TMP_INDEX_PATH);

    // 2. Read the file back into a buffer
    const indexDataBuffer = await fs.readFile(TMP_INDEX_PATH);

    const indexDocument: IndexDocument = {
      _id: INDEX_ID,
      index_data: new Binary(indexDataBuffer),
      metadata: metadata,
      dimension: this.dimension,
      updatedAt: new Date(),
    };

    // 3. Save the buffer to MongoDB
    await collection.updateOne(
      { _id: INDEX_ID },
      { $set: indexDocument },
      { upsert: true }
    );

    // 4. Clean up the temporary file
    await fs.unlink(TMP_INDEX_PATH);

    console.log("Vector index and metadata saved to MongoDB.");
  }

  /**
   * Loads the index from MongoDB by writing the stored buffer to a temporary file.
   */
  async loadIndex(): Promise<{
    index: HierarchicalNSW;
    metadata: Metadata[];
  } | null> {
    try {
      const db = await connectToDatabase();
      const collection = db.collection<IndexDocument>(INDEX_COLLECTION);

      const indexDocument = await collection.findOne({ _id: INDEX_ID });

      if (indexDocument && indexDocument.index_data) {
        const indexDataBuffer = indexDocument.index_data.buffer;

        // 1. Write the buffer from DB to a temporary file
        await fs.writeFile(TMP_INDEX_PATH, indexDataBuffer);

        // 2. Load the index from the temporary file
        await this.index.readIndex(TMP_INDEX_PATH);

        // 3. Clean up the temporary file
        await fs.unlink(TMP_INDEX_PATH);

        const metadata = indexDocument.metadata;
        console.log("Vector index and metadata loaded from MongoDB.");
        return { index: this.index, metadata };
      }

      console.log("Could not find index in MongoDB.");
      return null;
    } catch (error) {
      console.error("Error loading index from MongoDB:", error);
      return null;
    }
  }

  initIndex(numPoints: number): void {
    this.index.initIndex(numPoints);
  }

  addPoint(embedding: number[], id: number): void {
    this.index.addPoint(embedding, id);
  }

  search(embedding: number[], k: number): number[] {
    const { neighbors } = this.index.searchKnn(embedding, k);
    return neighbors;
  }
}
