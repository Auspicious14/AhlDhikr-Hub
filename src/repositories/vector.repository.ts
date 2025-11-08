import { HierarchicalNSW } from 'hnswlib-node';
import { Binary, Document } from 'mongodb';
import { connectToDatabase } from '../services/mongo.service';
import { Metadata } from '../models/types';

const DIMENSION = 768; // Dimension for the 'embedding-001' model
const INDEX_COLLECTION = 'vector_index';
const INDEX_ID = 'singleton_islamic_index'; // Use a fixed ID to ensure only one index document

/**
 * Defines the schema for the document that will be stored in MongoDB.
 * Using a specific interface with strong types helps prevent TS errors.
 */
interface IndexDocument extends Document {
  _id: string;
  index_data: Binary;
  metadata: Metadata[];
  updatedAt: Date;
}

export class VectorRepository {
  private index: HierarchicalNSW;

  constructor() {
    this.index = new HierarchicalNSW('cosine', DIMENSION);
  }

  /**
   * Saves the in-memory index and metadata to a MongoDB collection.
   */
  async saveIndex(metadata: Metadata[]): Promise<void> {
    const db = await connectToDatabase();
    // Strongly type the collection with the new interface
    const collection = db.collection<IndexDocument>(INDEX_COLLECTION);

    // Use writeIndexSync to get the index data as a buffer
    const indexData = this.index.writeIndexSync();

    const indexDocument: IndexDocument = {
      _id: INDEX_ID,
      index_data: new Binary(indexData),
      metadata: metadata,
      updatedAt: new Date(),
    };

    await collection.updateOne(
      { _id: INDEX_ID }, // The filter now correctly matches the string _id
      { $set: indexDocument },
      { upsert: true }
    );

    console.log('Vector index and metadata saved to MongoDB.');
  }

  /**
   * Loads the index and metadata from the MongoDB collection into memory.
   */
  async loadIndex(): Promise<{ index: HierarchicalNSW; metadata: Metadata[] } | null> {
    try {
      const db = await connectToDatabase();
      const collection = db.collection<IndexDocument>(INDEX_COLLECTION);

      // The query now correctly uses a string for the _id
      const indexDocument = await collection.findOne({ _id: INDEX_ID });

      if (indexDocument && indexDocument.index_data) {
        const indexDataBuffer = indexDocument.index_data.buffer;

        // Use readIndexSync to load the index from the buffer
        this.index.readIndexSync(indexDataBuffer);

        const metadata = indexDocument.metadata;
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
