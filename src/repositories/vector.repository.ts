import { HierarchicalNSW } from "hnswlib-node";
import { Binary, Document, GridFSBucket, ObjectId } from "mongodb";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { connectToDatabase } from "../services/mongo.service";
import { Metadata } from "../models/types";
import * as os from "os";

// Default dimension (can be overridden in constructor)
const DEFAULT_DIMENSION = 768; // Gemini's embedding-001 model
const INDEX_COLLECTION = "vector_index";
const INDEX_ID = "singleton_islamic_index";
const GRIDFS_BUCKET_NAME = "vector_index_files";
// Use os.tmpdir() for cross-platform compatibility
const TMP_INDEX_PATH = path.join(os.tmpdir(), "islamic_index.bin");

interface IndexDocument extends Document {
  _id: string;
  vectorFileId?: ObjectId; // Reference to GridFS file
  metadata: Metadata[];
  dimension: number;
  updatedAt: Date;
  // Legacy field support (optional)
  index_data?: Binary;
}

export class VectorRepository {
  private index: HierarchicalNSW;
  private dimension: number;

  constructor(dimension?: number) {
    this.dimension = dimension || DEFAULT_DIMENSION;
    this.index = new HierarchicalNSW("cosine", this.dimension);
    // this.index.setEf(100);
    console.log(
      `📐 Vector repository initialized with dimension: ${this.dimension}`
    );
  }

  /**
   * Saves the in-memory index to MongoDB using GridFS for the binary file.
   */
  async saveIndex(metadata: Metadata[]): Promise<void> {
    const db = await connectToDatabase();
    const collection = db.collection<IndexDocument>(INDEX_COLLECTION);
    const bucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET_NAME });

    console.log("Saving index to disk...");
    // 1. Write the index to the temporary filesystem
    await this.index.writeIndex(TMP_INDEX_PATH);

    // 2. Upload the file to GridFS
    console.log("Uploading index to GridFS...");
    const readStream = fs.createReadStream(TMP_INDEX_PATH);
    const uploadStream = bucket.openUploadStream("islamic_index.bin", {
      metadata: {
        dimension: this.dimension,
        updatedAt: new Date(),
      },
    });

    const uploadPromise = new Promise<ObjectId>((resolve, reject) => {
      readStream
        .pipe(uploadStream)
        .on("error", reject)
        .on("finish", () => {
          resolve(uploadStream.id);
        });
    });

    const fileId = await uploadPromise;
    console.log(`Index uploaded with File ID: ${fileId}`);

    // 3. Clean up old files (optional but good practice)
    // Find the previous index document to get the old file ID
    const oldDoc = await collection.findOne({ _id: INDEX_ID });
    if (oldDoc && oldDoc.vectorFileId) {
      try {
        await bucket.delete(oldDoc.vectorFileId);
        console.log("Deleted old index file from GridFS.");
      } catch (e) {
        console.warn("Could not delete old index file (might not exist):", e);
      }
    }

    // 4. Save metadata and file reference to MongoDB
    const indexDocument: IndexDocument = {
      _id: INDEX_ID,
      vectorFileId: fileId,
      metadata: metadata,
      dimension: this.dimension,
      updatedAt: new Date(),
    };

    // Remove legacy field if it exists in the update
    // @ts-ignore
    delete indexDocument.index_data;

    await collection.updateOne(
      { _id: INDEX_ID },
      { $set: indexDocument, $unset: { index_data: "" } },
      { upsert: true }
    );

    // 5. Clean up the temporary file
    await fsPromises.unlink(TMP_INDEX_PATH);

    console.log("Vector index and metadata saved to MongoDB.");
  }

  /**
   * Loads the index from MongoDB (GridFS or legacy Binary).
   */
  async loadIndex(): Promise<{
    index: HierarchicalNSW;
    metadata: Metadata[];
  } | null> {
    try {
      const db = await connectToDatabase();
      const collection = db.collection<IndexDocument>(INDEX_COLLECTION);
      const bucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET_NAME });

      const indexDocument = await collection.findOne({ _id: INDEX_ID });

      if (!indexDocument) {
        console.log("Could not find index document in MongoDB.");
        return null;
      }

      // Check for GridFS file
      if (indexDocument.vectorFileId) {
        console.log("Downloading index from GridFS...");
        const downloadStream = bucket.openDownloadStream(
          indexDocument.vectorFileId
        );
        const writeStream = fs.createWriteStream(TMP_INDEX_PATH);

        await new Promise<void>((resolve, reject) => {
          downloadStream
            .pipe(writeStream)
            .on("error", reject)
            .on("finish", () => resolve());
        });

        // Load the index from the temporary file
        await this.index.readIndex(TMP_INDEX_PATH);

        // Clean up
        await fsPromises.unlink(TMP_INDEX_PATH);

        const metadata = indexDocument.metadata;
        console.log("Vector index and metadata loaded from MongoDB (GridFS).");
        return { index: this.index, metadata };
      }
      // Fallback for legacy Binary format
      else if (indexDocument.index_data) {
        console.log("Loading legacy index format...");
        const indexDataBuffer = indexDocument.index_data.buffer;

        await fsPromises.writeFile(TMP_INDEX_PATH, indexDataBuffer);
        await this.index.readIndex(TMP_INDEX_PATH);
        await fsPromises.unlink(TMP_INDEX_PATH);

        const metadata = indexDocument.metadata;
        console.log("Vector index and metadata loaded from MongoDB (Legacy).");
        return { index: this.index, metadata };
      }

      console.log("Index document found but no vector data.");
      return null;
    } catch (error) {
      console.error("Error loading index from MongoDB:", error);
      return null;
    }
  }

  initIndex(numPoints: number): void {
    // If index is already initialized with a different size, we might need to resize or re-init
    // hnswlib-node resizeIndex is available in newer versions, but initIndex resets it.
    // For building from scratch, initIndex is fine.
    try {
      this.index.initIndex(numPoints);
    } catch (e) {
      // If already initialized, we might need to recreate it if we want to reset
      this.index = new HierarchicalNSW("cosine", this.dimension);
      this.index.initIndex(numPoints);
    }
  }

  addPoint(embedding: number[], id: number): void {
    this.index.addPoint(embedding, id);
  }

  // vector.repository.ts
  search(embedding: number[], k: number): number[] {
    try {
      // Keep high ef for good recall
      this.index.setEf(Math.max(k * 20, 100));

      const { neighbors } = this.index.searchKnn(embedding, k);
      return neighbors;
    } catch (e) {
      console.error("Error searching index:", e);
      return [];
    }
  }

  getCurrentCount(): number {
    return this.index.getCurrentCount();
  }
}
