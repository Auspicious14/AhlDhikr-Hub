import { HierarchicalNSW } from 'hnswlib-node';
import { Binary } from 'mongodb';
import { connectToDatabase } from '../services/mongo.service';
import { Metadata } from '../models/types';

const DIMENSION = 768; // Dimension for the 'embedding-001' model
const INDEX_COLLECTION = 'vector_index';
const INDEX_ID = 'singleton_islamic_index'; // Use a fixed ID to ensure only one index document

export class VectorRepository {
  private index: HierarchicalNSW;

  constructor() {
    // The index is always initialized in memory for searching.
    this.index = new HierarchicalNSW('cosine', DIMENSION);
  }

  /**
   * Saves the in-memory index and metadata to a MongoDB collection.
   * The index is serialized to a buffer and stored in a single document.
   * @param metadata The metadata array to save alongside the index.
   */
  async saveIndex(metadata: Metadata[]): Promise<void> {
    const db = await connectToDatabase();
    const collection = db.collection(INDEX_COLLECTION);

    // Serialize the index to a buffer
    const indexData = await this.index.writeIndex();

    // Create a document containing both the index buffer and the metadata
    const indexDocument = {
      _id: INDEX_ID,
      index_data: new Binary(indexData),
      metadata: metadata,
      updatedAt: new Date(),
    };

    // Use updateOne with upsert to either create a new document or replace the existing one
    await collection.updateOne(
      { _id: INDEX_ID },
      { $set: indexDocument },
      { upsert: true }
    );

    console.log('Vector index and metadata saved to MongoDB.');
  }

  /**
   * Loads the index and metadata from the MongoDB collection into memory.
   * @returns A promise that resolves with the index and metadata, or null if not found.
   */
  async loadIndex(): Promise<{ index: HierarchicalNSW; metadata: Metadata[] } | null> {
    try {
      const db = await connectToDatabase();
      const collection = db.collection(INDEX_COLLECTION);
      const indexDocument = await collection.findOne({ _id: INDEX_ID });

      if (indexDocument && indexDocument.index_data) {
        // The index_data is stored as a BSON Binary type, get the buffer from it.
        const indexDataBuffer = indexDocument.index_data.buffer;

        // Load the index from the buffer
        await this.index.readIndex(indexDataBuffer, false);

        const metadata = indexDocument.metadata as Metadata[];
        console.log('Vector index and metadata loaded from MongoDB.');
        return { index: this.index, metadata };
      }

      console.log('Could not find index in MongoDB.');
      return null;
    } catch (error) {
      console.error('Error loading index from MongoDB:', error);
      return null;
    }
  }

  /**
   * Initializes a new in-memory index with a given capacity.
   * @param numPoints The maximum number of points the index can hold.
   */
  initIndex(numPoints: number): void {
    this.index.initIndex(numPoints);
  }

  /**
   * Adds a new point (embedding) to the in-memory index.
   * @param embedding The vector embedding.
   * @param id The unique identifier for the point.
   */
  addPoint(embedding: number[], id: number): void {
    this.index.addPoint(embedding, id);
  }

  /**
   * Searches the in-memory index for the k-nearest neighbors to a query embedding.
   * @param embedding The query vector embedding.
   * @param k The number of neighbors to retrieve.
   * @returns An array of identifiers for the nearest neighbors.
   */
  search(embedding: number[], k: number): number[] {
    const { neighbors } = this.index.searchKnn(embedding, k);
    return neighbors;
  }
}
